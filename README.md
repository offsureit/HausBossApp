# HausBoss Mobile (Expo / React Native)

The native iOS + Android app for HausBoss. It talks to the **existing** HausBoss API and Socket.IO
realtime server (the `server/` folder of the quick-job-tracker repo, API docs there) — no backend is duplicated here.
The brief is `docs/MOBILE_APP_PROMPT.md`; the plan and phase reports are `docs/MOBILE_APP_PLAN.md`.

## Layout

```
src/app/            Expo Router routes (file = screen; _layout = navigator)
  (auth)/           login, forgot-password            — only while signed out
  (app)/            tabs: today · calendar · dashboard · chat · messages · more — only while signed in
src/api/            session store (Keychain / Keystore), HTTP client with single-flight refresh, Socket.IO
src/services/       one module per API area (jobs, customers, messages, activity, estimates, media, categories, locations)
src/features/       providers + hooks (auth, company, jobs, team, customers, locations, media, settings, toast)
src/components/     ui kit (Text, Button, Card, TextField, Sheet, Select, Tabs, Toast, …), jobs/, calendar/, dashboard/, customers/
src/theme/          colour / type / spacing tokens (same values as the web `src/index.css`), ThemeProvider
src/motion/         the motion system (durations, easing, springs, stagger, Reduce Motion)
```

### Shared code with the web app

Pure business logic is shared with the web app: the files under `shared/` are copies of the same files in the web
repo's `src/` and must stay identical (diff them when the web rules change):

| Alias | Points to | Holds |
|---|---|---|
| `@/…` | `./shared/…` (copied from the web app's `src/`) | types (`@/types`, `@/api/dbTypes`), `@/services/adapters/*` (job / company / employee mappers), `@/utils/*` (status rules, names, time maths, schedule window), `@/services/types` |
| `~/…` | `./src/…` (this app) | everything mobile |

`metro.config.js` and `tsconfig.json` define both aliases. `shared/` must stay identical to the same files in the
web repo (`src/…`); diff them when the web rules change. Only modules without browser or React
imports may be shared (the web `services/*Service.ts` files use the web HTTP client, so the mobile
`src/services/*` mirror their calls through `~/api/client`).

## Run

```bash
npm install
cp .env.example .env.development.local      # EXPO_PUBLIC_API_URL (emulator: http://10.0.2.2:3105)
npm run android                             # builds the dev client and installs it (Android SDK required)
npm run ios                                 # macOS + Xcode
npm run start:dev-client                    # Metro for an installed dev client
```

The app needs a **development build** (`expo-dev-client`): MMKV, Secure Store, maps, background
location and push are native modules that Expo Go does not ship. Production builds: `eas build`.

Environment (bundled, public): `EXPO_PUBLIC_API_URL` (default `https://hausboss.app`),
`EXPO_PUBLIC_REALTIME_URL` (defaults to the API URL).

Native keys (build-time, from EAS secrets or the shell — never committed): `GOOGLE_MAPS_ANDROID_KEY`
and `GOOGLE_MAPS_IOS_KEY` enable the Dashboard map (`app.config.ts` adds the react-native-maps plugin
only when they are set; without them the app shows a "Map not configured" card and everything else works).

Permissions requested: location (foreground, while a job is active and for "On My Way"), camera and
photo library (job photos and chat attachments).

## Check

```bash
npm run typecheck && npm run lint && npm test
```

## Phase 4 notes (native, offline, push)

- `src/services/backgroundLocation.ts` is imported by the root layout for its side effect: it defines the
  `hausboss.location` task at module scope, which is what lets Android start it headless.
- Push tokens need `extra.eas.projectId` in the app config (`npx eas-cli init`) and FCM / APNs credentials on the EAS
  project. Without them `pushService.getPushToken()` reports `no-project` and the app stays on socket notifications.
- The offline queue lives in MMKV under `hb.offline.queue`; photos picked offline are copied to
  `Paths.document/offline-media/`. `OfflineBanner` shows counts and Retry / Discard for refused changes.
- Universal links: `src/app/+native-intent.ts` → `src/lib/deepLinks.ts`. Add new public paths there, in `app.json`
  (`android.intentFilters`) and in `public/.well-known/*` of the web app.

## Phase 5 notes (quality, release)

- **Tests**: `npm test` — services, role matrix (`features/auth/__tests__/roles.test.ts`), status rules
  (`components/jobs/__tests__/primaryAction.test.ts`), the offline queue, deep links, push routing, PII scrubbing
  (`lib/__tests__/monitoring.test.ts`) and a WCAG AA contrast check over both themes (`theme/__tests__/contrast.test.ts`).
- **E2E (Maestro)**: `.maestro/` — login, technician completes a job end-to-end, dispatcher reassigns from the employee
  sheet, offline status change syncs after reconnect. `cp .maestro/.env.example .maestro/.env.local`, fill in the local
  accounts, then `.maestro/run.sh [flow]`. The runner resets the fixture jobs (`fixtures/reset.sql`) before every flow and
  checks the server rows afterwards. Against a dev client set `DEV_CLIENT_URL` (the runner clears app data, grants the
  permissions and opens the Metro bundle); release / preview builds leave it empty.
- **Monitoring**: `src/lib/monitoring.ts` (Sentry). Off unless `EXPO_PUBLIC_SENTRY_DSN` is set; no PII (account id only,
  emails / phones / tokens scrubbed from events and breadcrumbs). Source maps upload when `SENTRY_ORG`, `SENTRY_PROJECT`
  and `SENTRY_AUTH_TOKEN` are present at build time.
- **Release**: `eas.json` (development / preview / production), `expo-build-properties` (R8 + resource shrinking),
  `runtimeVersion` policy `appVersion`. The full store checklist is `docs/RELEASE.md`.
- Role gating lives in `src/features/auth/roles.ts` (`deriveRoleFlags`, `tabsFor`, `homeTabFor`) — the provider, the tab
  layout and the launch redirect all use it.
