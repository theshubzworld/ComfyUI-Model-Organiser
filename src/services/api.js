/**
 * src/services/api.js
 * Central API base URL resolver.
 * 
 * - In local dev (Vite), requests go to /api/* which Vite proxies to localhost:3001
 * - In production (Vercel), requests go to /api/* directly (Vercel serverless functions)
 * 
 * This means ALL fetch calls in the app should use /api/... relative URLs.
 */

export const API_BASE = '/api';

export function apiUrl(path) {
  return `${API_BASE}/${path.replace(/^\//, '')}`;
}
