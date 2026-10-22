import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

/**
 * Crash + performance monitoring (brief "Quality bar": Sentry, no PII in logs).
 *
 * The DSN comes from `EXPO_PUBLIC_SENTRY_DSN` (EAS env / `.env.*.local`) — never hard-coded. Without
 * it the SDK is initialised disabled, so local and CI builds send nothing. Source-map upload needs
 * `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` at build time (see `app.config.ts`).
 *
 * Privacy: `sendDefaultPii` is off, the user context is the account id only (no email / name), and
 * `beforeSend` / `beforeBreadcrumb` scrub anything that looks like an email, a phone number or a
 * bearer token from messages, breadcrumbs and request URLs. Customers' data never leaves the app
 * through this channel.
 */

export const SENTRY_DSN: string = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Candidate runs of digits / separators; `isPhone` keeps 10–15 digits and rejects ISO dates. */
const PHONE = /(?<![\d/])\+?\d[\d\s().-]{7,}\d(?![\d/])/g;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
function isPhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '').length;
  return digits >= 10 && digits <= 15 && !ISO_DATE.test(candidate);
}
const BEARER = /bearer\s+[a-z0-9._-]+/gi;
const TOKEN_QUERY = /([?&](?:token|access_token|refresh_token|code)=)[^&#]+/gi;
/** Storage paths and media file names embed `<userId>/<jobId>/<ts>_<name>` — keep the ids, drop the file name. */
const MEDIA_NAME = /(\/storage\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/)[^\s"']+/gi;

/** Removes emails, phone numbers, bearer tokens and token query strings from a string. */
export function scrub(value: string): string {
  return value.replace(BEARER, 'Bearer [redacted]').replace(TOKEN_QUERY, '$1[redacted]').replace(EMAIL, '[email]').replace(PHONE, (m) => (isPhone(m) ? '[phone]' : m)).replace(MEDIA_NAME, '$1[file]');
}

function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 6 || value == null) return value;
  if (typeof value === 'string') return scrub(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /^(authorization|cookie|set-cookie|password|token|refresh_token|access_token)$/i.test(k) ? '[redacted]' : scrubDeep(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

/** `beforeSend`: drops request bodies / headers, scrubs text fields. Exported for tests. */
export function sanitizeEvent<E extends Sentry.ErrorEvent>(event: E): E {
  if (event.request) event.request = { url: event.request.url ? scrub(event.request.url) : undefined };
  if (event.message) event.message = scrub(event.message);
  if (event.exception?.values) for (const v of event.exception.values) if (v.value) v.value = scrub(v.value);
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((b) => sanitizeBreadcrumb(b)).filter((b): b is Sentry.Breadcrumb => !!b);
  if (event.extra) event.extra = scrubDeep(event.extra);
  if (event.contexts) event.contexts = scrubDeep(event.contexts);
  if (event.user) event.user = { id: event.user.id };
  return event;
}

/** `beforeBreadcrumb`: console lines are dropped (they are developer logs), the rest is scrubbed. */
export function sanitizeBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (crumb.category === 'console') return null;
  const out: Sentry.Breadcrumb = { ...crumb };
  if (out.message) out.message = scrub(out.message);
  if (out.data) out.data = scrubDeep(out.data);
  return out;
}

export const monitoring = {
  enabled: SENTRY_DSN.length > 0,

  /** Called once at module scope in the root layout, before any screen renders. */
  init(): void {
    Sentry.init({
      dsn: SENTRY_DSN || undefined,
      enabled: SENTRY_DSN.length > 0,
      debug: false,
      sendDefaultPii: false,
      release: Constants.expoConfig?.version ? `hausboss-mobile@${Constants.expoConfig.version}` : undefined,
      dist: (Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber)?.toString(),
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: __DEV__ ? 0 : 0.2,
      enableAutoSessionTracking: true,
      attachScreenshot: false,
      attachViewHierarchy: false,
      maxBreadcrumbs: 50,
      integrations: [Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() })],
      beforeSend: (event) => sanitizeEvent(event),
      beforeBreadcrumb: (crumb) => sanitizeBreadcrumb(crumb),
    });
  },

  /** Account id only — enough to group crashes per user, no email or name. */
  setUser(userId: string | null): void {
    Sentry.setUser(userId ? { id: userId } : null);
  },

  setContext(key: string, value: Record<string, unknown> | null): void {
    Sentry.setContext(key, value);
  },

  captureError(error: unknown, extra?: Record<string, unknown>): void {
    if (error instanceof Error) Sentry.captureException(error, extra ? { extra } : undefined);
    else Sentry.captureMessage(scrub(String(error)), extra ? { extra, level: 'error' } : { level: 'error' });
  },

  /** Wraps the root component (error boundary + app-start tracing). */
  wrap: Sentry.wrap,
};
