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

// Single in-flight refresh promise shared across all concurrent 401 responses.
// Without this, multiple expired requests would each try to refresh simultaneously,
// causing all but the first to fail because the refresh token is single-use.
let refreshPromise: Promise<string> | null = null;

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

    // Token expired — refresh and retry (all concurrent 401s share one refresh call)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
          .then(({ data }) => {
            localStorage.setItem('accessToken', data.accessToken);
            reauthenticateSockets();
            return data.accessToken as string;
          })
          .catch((err) => {
            localStorage.removeItem('accessToken');
            throw err;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
