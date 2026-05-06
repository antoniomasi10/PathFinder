import axios from 'axios';
import { reauthenticateSockets } from './socket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL && window.location.hostname !== 'localhost') {
  console.warn('NEXT_PUBLIC_API_URL is not set - using localhost fallback');
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

// ETag cache: maps request URL → { etag, data }
// Allows the client to send If-None-Match on repeat GET requests so the server
// can respond 304 Not Modified (no body) instead of resending the full payload.
const etagStore = new Map<string, { etag: string; data: unknown }>();

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.method?.toLowerCase() === 'get' && config.url) {
    const cached = etagStore.get(config.url);
    if (cached) config.headers['If-None-Match'] = cached.etag;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    // Store ETag for future conditional requests
    const etag = response.headers['etag'];
    if (etag && response.config.method?.toLowerCase() === 'get' && response.config.url) {
      etagStore.set(response.config.url, { etag, data: response.data });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 304 Not Modified — data hasn't changed, return the locally cached body
    if (error.response?.status === 304 && originalRequest?.url) {
      const cached = etagStore.get(originalRequest.url);
      if (cached) {
        return { ...error.response, status: 200, data: cached.data };
      }
    }

    // Rate limited — wait and retry once
    if (error.response?.status === 429 && !originalRequest._rateLimitRetry) {
      originalRequest._rateLimitRetry = true;
      const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return api(originalRequest);
    }

    // Token expired — refresh and retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        reauthenticateSockets();
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
