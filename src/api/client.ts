import { API_URL } from '~/lib/env';
import { clearSession, getSession, isExpired, setRefresher, setSession, type Session } from './session';

/**
 * HTTP client for the HausBoss API (`docs/API.md`) — a port of the web app's
 * `src/api/client.ts` with the same guarantees:
 *
 * - JSON in/out, `Authorization: Bearer <access_token>` from the session store.
 * - A 401 triggers ONE refresh (`POST /auth/refresh`, single-flight across
 *   concurrent requests) and a retry; a server rejection clears the session,
 *   a network failure keeps it.
 * - Every failure becomes an `ApiError` whose `message` is safe to render.
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** `true` (default) attaches the bearer token when a session exists; `false` never sends one. */
  auth?: boolean;
  headers?: Record<string, string>;
  /** Milliseconds before the request is abandoned (default 20 s). */
  timeoutMs?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;
  constructor(message: string, status: number, code = 'api', body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export const OFFLINE_MESSAGE = 'You appear to be offline. Check your connection and try again.';
export const UNREACHABLE_MESSAGE = 'Could not reach the server. Please try again.';
export const TIMEOUT_MESSAGE = 'The server took too long to answer. Please try again.';

let baseUrl = API_URL;
/** Tests and the diagnostics screen can point the client elsewhere. */
export function configureApi(options: { baseUrl?: string }): void {
  if (options.baseUrl) baseUrl = options.baseUrl.replace(/\/$/, '');
}
export function apiBase(): string {
  return `${baseUrl}/api`;
}

// Connectivity is fed by NetInfo (see AppProviders); defaults to online.
let online = true;
export function setOnline(value: boolean): void {
  online = value;
}
export function isOnline(): boolean {
  return online;
}

export function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const base = /^https?:\/\//.test(path) ? path : `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function errorFromBody(status: number, body: unknown, fallback = 'Request failed'): ApiError {
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; error?: unknown; code?: unknown };
    const message = Array.isArray(b.message) ? b.message.join('; ') : typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : fallback;
    const code = typeof b.code === 'string' ? b.code : typeof b.error === 'string' ? b.error.toLowerCase().replace(/\s+/g, '_') : String(status);
    return new ApiError(message, status, code, body);
  }
  if (typeof body === 'string' && body.trim() && !/^<!doctype/i.test(body)) return new ApiError(body.slice(0, 200), status, String(status), body);
  return new ApiError(fallback, status, String(status), body);
}

// ---------------------------------------------------------------------------
// Refresh (single-flight)
// ---------------------------------------------------------------------------

export type RefreshOutcome = { ok: true; session: Session } | { ok: false; reason: 'none' | 'network' | 'rejected' };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Rotate the refresh token (single-flight). A network failure keeps the current
 * session (`reason: 'network'`); only a server rejection clears it.
 */
export function refreshSessionDetailed(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;
  const current = getSession();
  if (!current?.refresh_token) return Promise.resolve({ ok: false, reason: 'none' });
  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    try {
      const res = await doFetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      }, 15_000);
      const body = await parseBody(res);
      if (!res.ok) {
        // The token may have been rotated by a concurrent call that already stored a newer session.
        const latest = getSession();
        if (latest && latest.refresh_token !== current.refresh_token && !isExpired(latest)) return { ok: true, session: latest };
        if (res.status >= 500) return { ok: false, reason: 'network' };
        clearSession('SIGNED_OUT');
        return { ok: false, reason: 'rejected' };
      }
      const session = body as Session;
      setSession(session, 'TOKEN_REFRESHED');
      return { ok: true, session };
    } catch {
      return { ok: false, reason: 'network' }; // offline / unreachable — keep the current session
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function refreshSession(): Promise<Session | null> {
  const out = await refreshSessionDetailed();
  return out.ok ? out.session : null;
}

setRefresher(refreshSession);

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

async function authHeader(useAuth: boolean): Promise<Record<string, string>> {
  if (!useAuth) return {};
  let session = getSession();
  if (session && isExpired(session)) session = (await refreshSession()) ?? getSession() ?? session;
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function doFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outerSignal = init.signal;
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (outerSignal?.aborted) throw new ApiError('Request cancelled', 0, 'aborted', err);
    if (controller.signal.aborted) throw new ApiError(TIMEOUT_MESSAGE, 0, 'timeout', err);
    if (__DEV__) console.warn('[api] network error', init.method, url, err instanceof Error ? err.message : String(err));
    throw new ApiError(online ? UNREACHABLE_MESSAGE : OFFLINE_MESSAGE, 0, 'network', err);
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  const url = buildUrl(path, options.query);
  const method = options.method ?? (options.body !== undefined ? 'POST' : 'GET');
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const timeoutMs = options.timeoutMs ?? (isForm ? 120_000 : 20_000);

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json', ...(await authHeader(useAuth)), ...(options.headers ?? {}) };
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (isForm) body = options.body as FormData;
      else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }
    return doFetch(url, { method, headers, body, signal: options.signal }, timeoutMs);
  };

  let res = await send();
  if (res.status === 401 && useAuth && getSession()) {
    const out = await refreshSessionDetailed();
    if (out.ok) res = await send();
    else if (out.reason === 'rejected') clearSession('SIGNED_OUT');
    // 'network': keep the session; the original 401 is reported below and the next request retries.
  }

  const payload = await parseBody(res);
  if (!res.ok) throw errorFromBody(res.status, payload);
  return payload as T;
}

/** Multipart upload helper (`POST /media/upload`). */
export async function uploadFile<T>(path: string, form: FormData, options: Omit<ApiRequestOptions, 'body' | 'method'> = {}): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'POST', body: form });
}

export const api = {
  get: <T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) => apiFetch<T>(path, { ...options, method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) => apiFetch<T>(path, { ...options, method: 'PUT', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) => apiFetch<T>(path, { ...options, method: 'PATCH', body: body ?? {} }),
  delete: <T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
  upload: uploadFile,
};
