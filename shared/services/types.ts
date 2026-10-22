/**
 * Common result shape for every service call.
 *
 * The `{ data, error }` tuple the existing components
 * already destructure (PROJECT_HANDOFF §13 "Error behaviour"): nothing throws
 * across the service boundary and `error.message` is safe to render in a toast.
 */

export interface ServiceError {
  message: string;
  code?: string;
  cause?: unknown;
}

export interface ServiceResult<T> {
  data: T | null;
  error: ServiceError | null;
}

export function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

export function fail<T = never>(message: string, code?: string, cause?: unknown): ServiceResult<T> {
  return { data: null, error: { message, code, cause } };
}

/** Narrow an unknown thrown value / API error into a ServiceError. */
export function toServiceError(err: unknown, fallback = 'Something went wrong'): ServiceError {
  if (!err) return { message: fallback };
  if (typeof err === 'string') return { message: err };
  if (typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; error?: unknown; error_description?: unknown; details?: unknown };
    const message =
      (typeof e.message === 'string' && e.message) ||
      (typeof e.error_description === 'string' && e.error_description) ||
      (typeof e.error === 'string' && e.error) ||
      (typeof e.details === 'string' && e.details) ||
      fallback;
    return { message, code: typeof e.code === 'string' ? e.code : undefined, cause: err };
  }
  return { message: fallback, cause: err };
}

/**
 * Run an API call and turn any thrown `ApiError` / network failure into a
 * ServiceResult (nothing throws across the service boundary).
 */
export async function fromApi<T>(run: () => Promise<T>, fallback?: string): Promise<ServiceResult<T>> {
  try {
    return { data: await run(), error: null };
  } catch (err) {
    const e = err as { message?: string; code?: string; status?: number };
    return { data: null, error: { message: e?.message || fallback || 'Something went wrong', code: e?.code, cause: err } };
  }
}

/** Like `fromApi` but maps the payload before returning it. */
export async function fromApiMap<T, R>(run: () => Promise<T>, map: (value: T) => R, fallback?: string): Promise<ServiceResult<R>> {
  const result = await fromApi(run, fallback);
  return result.error ? { data: null, error: result.error } : ok(map(result.data as T));
}

/** Wrap a `{ data, error }`-style response (or a thrown error) into a ServiceResult. */
export async function wrap<T>(
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
  fallback?: string,
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await run();
    if (error) return { data: null, error: toServiceError(error, fallback) };
    return { data: data as T, error: null };
  } catch (err) {
    return { data: null, error: toServiceError(err, fallback) };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Sentinel job_id used by audit rows that do not belong to a job (§15). */
export const SENTINEL_JOB_ID = '00000000-0000-0000-0000-000000000000';

export function originUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}
