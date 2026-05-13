import axios from 'axios';
import { reauthenticateSockets } from './socket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL && window.location.hostname !== 'localhost') {
  console.warn('NEXT_PUBLIC_API_URL is not set - using localhost fallback');
}

// In-memory access token — never written to localStorage (XSS protection)
let _accessToken: string | null = null;
export function setAccessToken(token: string): void { _accessToken = token; }
export function getAccessToken(): string | null { return _accessToken; }
export function clearAccessToken(): void { _accessToken = null; }

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

// ETag cache: maps request URL → { etag, data }
// Allows the client to send If-None-Match on repeat GET requests so the server
// can respond 304 Not Modified (no body) instead of resending the full payload.
const etagStore = new Map<string, { etag: string; data: unknown }>();

api.interceptors.request.use((config) => {
  const token = _accessToken;
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
          .post('/api/bff/refresh', {})
          .then(({ data }) => {
            setAccessToken(data.accessToken);
            reauthenticateSockets();
            return data.accessToken as string;
          })
          .catch((err) => {
            clearAccessToken();
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

/** POST to a same-origin BFF route (no baseURL, preserves err.response pattern) */
export async function bffPost<T = any>(path: string, body?: unknown): Promise<{ data: T }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data: T = await res.json();
  if (!res.ok) {
    const err: any = new Error((data as any).error || 'Request failed');
    err.response = { data };
    throw err;
  }
  return { data };
}

export default api;
