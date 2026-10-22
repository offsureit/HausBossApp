/**
 * Build-time environment (EXPO_PUBLIC_* variables are inlined by Expo).
 * Production default: https://hausboss.app, which proxies /api, /realtime and /storage.
 */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/$/, '');

/** Base URL of the HausBaus server (no trailing slash). */
export const API_URL: string = clean(process.env.EXPO_PUBLIC_API_URL) || 'https://hausboss.app';

/** Socket.IO origin; defaults to the API server. */
export const REALTIME_URL: string = clean(process.env.EXPO_PUBLIC_REALTIME_URL) || API_URL;

/** Public, permanent media URL for a storage path (`<userId>/<jobId>/<ts>_<name>`). */
export function storageUrl(path: string): string {
  return `${API_URL}/storage/${path.replace(/^\/+/, '')}`;
}

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?\//i;

/**
 * URL to load a media item from on the device. Stored URLs are permanent public links built by
 * the server from STORAGE_PUBLIC_URL; a local dev server emits `http://localhost:3105/...`, which
 * is unreachable from a phone or emulator, so those are rebuilt from the path against API_URL.
 */
export function resolveMediaUrl(item: { url?: string | null; path?: string | null }): string {
  const url = item.url?.trim() ?? '';
  if (item.path && (!url || LOOPBACK.test(url))) return storageUrl(item.path);
  return url;
}
