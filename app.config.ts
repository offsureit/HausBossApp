import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with values that must never be committed (shell or EAS env / secrets):
 * - GOOGLE_MAPS_ANDROID_KEY / GOOGLE_MAPS_IOS_KEY — native map keys (Android key restricted to the
 *   package + SHA-1, iOS key to the bundle id). Without one the map renders blank tiles.
 * - SENTRY_ORG / SENTRY_PROJECT (+ SENTRY_AUTH_TOKEN) — adds the Sentry config plugin so release
 *   builds upload source maps and native debug files. The runtime DSN is EXPO_PUBLIC_SENTRY_DSN.
 * - EAS_PROJECT_ID — written to `extra.eas.projectId` (what `eas init` would store) for push tokens.
 * - EXPO_PUBLIC_API_URL starting with http:// (local / staging servers): release builds get
 *   `usesCleartextTraffic` so Android lets them talk to it. Production (https) never sets it.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_KEY?.trim();
  const iosKey = process.env.GOOGLE_MAPS_IOS_KEY?.trim();
  const plugins = [...(config.plugins ?? [])];
  if (androidKey || iosKey) plugins.push(['react-native-maps', { ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}), ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}) }]);
  const sentryOrg = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();
  if (sentryOrg && sentryProject) plugins.push(['@sentry/react-native/expo', { organization: sentryOrg, project: sentryProject, url: process.env.SENTRY_URL?.trim() || 'https://sentry.io/' }]);
  const easProjectId = process.env.EAS_PROJECT_ID?.trim();
  const extra = { ...config.extra, maps: { android: !!androidKey, ios: !!iosKey } } as Record<string, unknown>;
  if (easProjectId) extra.eas = { ...((config.extra?.eas as Record<string, unknown> | undefined) ?? {}), projectId: easProjectId };
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  if (/^http:\/\//i.test(apiUrl)) {
    // SDK 58 writes the manifest flag through expo-build-properties, not `android.usesCleartextTraffic`.
    const i = plugins.findIndex((p) => Array.isArray(p) && p[0] === 'expo-build-properties');
    const opts = (i >= 0 ? (plugins[i] as [string, { android?: Record<string, unknown> }])[1] : {}) ?? {};
    const entry: [string, Record<string, unknown>] = ['expo-build-properties', { ...opts, android: { ...(opts.android ?? {}), usesCleartextTraffic: true } }];
    if (i >= 0) plugins[i] = entry; else plugins.push(entry);
  }
  return {
    ...config,
    name: config.name ?? 'HausBoss',
    slug: config.slug ?? 'hausboss',
    plugins,
    // Read at runtime so the app can fall back when no native map key is configured.
    extra,
  };
};
