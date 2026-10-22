# HausBoss Mobile — implementation plan and phase reports

Brief: `docs/MOBILE_APP_PROMPT.md`. App: `mobile/` (Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router).
Backend: the existing NestJS server in `server/` (`docs/API.md`) — reused as is; the only addition is push (Phase 4).

## 1. What exists today (reviewed 2026-10-21)

**Backend and auth.** `POST /auth/signin` returns `{ access_token (15-min JWT), refresh_token (30-day, rotating), expires_at, user }`;
`POST /auth/refresh` rotates (single use; a concurrent second use inside 30 s is a harmless 401, a later reuse revokes every
session). Every request runs under Postgres row-level security, so technicians only ever receive their own jobs, on REST
and on the socket. Realtime is Socket.IO at `/realtime` with `auth: { token }`; channels `jobs:company:<id>`,
`notifications-<userId>`, `job-messages-<jobId>`, `job-activity-logs-<jobId>`, `estimates-<jobId>`, `tech-locs:<companyId>`,
`presence:company:<id>` (GPS ping broadcast), `sms:company:<id>`. Production host `https://hausboss.app` proxies
`/api`, `/realtime` and `/storage`; the local API is `http://localhost:3105` (emulator: `10.0.2.2`). CORS allows requests
without an `Origin` header, which is what a native app sends — no server change needed for Phase 1.

**Screens and rules that port directly** (web reference → mobile):

| Mobile screen | Web reference | Reused as is |
|---|---|---|
| Today (technician) | `ContractorDashboard.tsx` (`isMine`, today/upcoming/completed grouping, `primaryActionFor`), `useClockActions`, `OnMyWayDialog` | `@/utils/jobStatus` (linear flow, `isValidTransition`), `@/utils/names`, `@/utils/schedule`, `@/utils/timeCalculations` |
| Calendar | `JobCalendar.tsx`, `CalendarTimeGrid.tsx`, `calendarLayout.ts` (`bucketJobsByLocalDay`, `visibleDays`), `utils/employees.ts` (All Employees order) | `@/components/calendarLayout`, `@/utils/employees`, `@/utils/contractorColors` |
| Dashboard + map + employee sheet + Reassign | `DashboardView.tsx`, `JobsMapView.tsx` (`markerStyle`, `STATUS_PIN_COLORS`), `EmployeeQueueSheet.tsx`, `MapReassignDialog.tsx`, `locationsService.ts` (ping protocol) | `@/utils/jobStatus.isOverdue`, `@/utils/employees.openJobsFor` |
| Job details (7 tabs) | `JobDetailsModal.tsx`, `TimeTracker.tsx`, `MediaCapture.tsx`, `JobChat.tsx`, `JobActivityFeed.tsx`, `estimates/*`, notes → chat mirror | `@/services/adapters/jobAdapter` (`transformJob`, `toJobUpdate`, `mergeJobUpdate`) |
| New job | `JobCreationForm.tsx` + `jobForm/schema.ts` (zod, split names, dual phone/email, billing, business unit → service type / category / length) | `@/components/jobForm/schema` (validation + `toJobCreateInput`) |
| Customers, Estimates, Chat, Messages, Search, Settings | `CustomerDialog`, `estimates/EstimateEditor`, `ChatPanel`, `sms/SmsInbox`, `GlobalSearch`, `CompanySettings` + `settings/*` | `@/utils/estimateMath`, `@/lib/plan`, types |

Shared code is imported from the web `src/` through the `@/` alias (see `mobile/README.md`). Three pure mappers were
extracted from the web services so both apps use one copy: `src/services/adapters/companyAdapter.ts`,
`src/services/adapters/employeeAdapter.ts`, `src/utils/schedule.ts` (web tests: 262 passing after the move).

**Missing backend capabilities (gaps, not invented):**

1. **Push notifications** — nothing exists. In-app notifications are rows in `notifications` written by database triggers
   (`status_change`, `job_updated`, `chat_message`, `sms_received`) and streamed over `notifications-<userId>`.
   Phase 4 adds, in the server's own style: migration `device_tokens` (user, company, Expo push token, platform, device id),
   `POST/DELETE /api/notifications/devices`, and an Expo Push sender hooked where `RealtimeListener` already sees every
   `notifications` INSERT (pg-boss job with retries, tokens pruned on `DeviceNotRegistered`).
2. **Address geocoding for the map** — the web geocodes in the browser with the company's Google Maps key. The mobile map
   will use `expo-location`'s native geocoder (no key, no quota) and the company key only for Places autocomplete in the
   job form (`GET /company` exposes `maps.api_key`). No server change.
3. **Location reporting** — `PUT /locations/me` + `GET /locations` exist; background reports reuse them unchanged.
4. **Media** — `POST /media/upload` (multipart, 25 MB) exists; the offline photo queue uploads through it.
5. **Pending-approval screen** — the brief lists one, but the product has no such state: the server answers
   `403 email_not_confirmed` and `403 This account is disabled` on sign-in. The login screen shows those; nothing else to build.
   (The web `/pending` route is an internal roadmap page, not an approval flow.)

**Expo libraries and native permissions.**

| Need | Library | Permission / config |
|---|---|---|
| Navigation, deep links | `expo-router` (typed routes), scheme `hausboss://`, universal links `hausboss.app` | iOS associated domains, Android intent filters (Phase 4) |
| Tokens | `expo-secure-store` (`AFTER_FIRST_UNLOCK` so background tasks can read them) | Face ID usage string (plugin) |
| Cache + offline queue | `react-native-mmkv` v4 (+ `react-native-nitro-modules`), React Query persister | — |
| Realtime | `socket.io-client` (websocket transport) | — |
| Maps | `react-native-maps` (Google provider on both platforms, per the brief) | Android Maps SDK key in `app.json` (`android.config.googleMaps.apiKey`), iOS Google Maps key in `ios.config.googleMapsApiKey` — keys restricted by package / bundle id + SHA-1 |
| Background location | `expo-location` + `expo-task-manager` | iOS `UIBackgroundModes: location` + "Always"; Android `ACCESS_BACKGROUND_LOCATION` + foreground service (notification) — plugin options `isAndroidBackgroundLocationEnabled`, `isIosBackgroundLocationEnabled` |
| Push | `expo-notifications` + EAS project id; FCM V1 service account (Android) and APNs key (iOS) uploaded to EAS | `POST_NOTIFICATIONS` (Android 13+), iOS alert permission |
| Camera / gallery | `expo-camera`, `expo-image-picker`, `expo-image` | camera + photo library usage strings |
| Biometric unlock | `expo-local-authentication` | Face ID usage string |
| Haptics, fonts, splash | `expo-haptics`, `expo-font` (Inter), `expo-splash-screen` | — |
| Animation | `react-native-reanimated` 4 (worklets), `react-native-gesture-handler` 3 (hook API), Lottie / Skia where the brief asks | Reduce Motion via `useReducedMotion` |

**Main technical risks and how they are handled.**

- *Background location on Android 10+ / iOS "Always":* the OS throttles and may kill the task; we report every two
  minutes only while a job is en-route / in-progress (the same cadence as `useLocationTracking`), with a foreground-service
  notification on Android, `deferredUpdatesInterval` batching, and a visible "Sharing location" state. Google Play may ask
  for a background-location justification video before release.
- *Push:* needs an EAS project (`eas init`) and FCM / APNs credentials the HausBoss team must create; the backend sender is
  idempotent per notification id and tolerant of token churn. Until credentials exist, in-app (socket) notifications keep
  working, so nothing is faked.
- *Offline sync:* queued operations carry a client-generated id and the previous status; replay is FIFO, single-flight,
  and a status change is only marked synced when the server row comes back. Conflicts (status moved on the server first)
  are surfaced as "needs attention", never silently overwritten. Photos are copied into app storage before upload.
- *Token refresh:* mirrored from the web client (single in-flight refresh, one retry, network failures keep the session),
  plus a proactive refresh one minute before expiry and on return to the foreground. Verified by unit tests and on device.
- *iOS builds:* this machine is Linux, so iOS builds go through EAS Build (cloud); Android builds run locally.
- *SDK drift:* Expo 58 renamed or changed several APIs (gesture-handler 3 hook API, MMKV v4 Nitro, native tabs). Each
  phase reads the versioned docs before touching a native module (`mobile/AGENTS.md`).

## 2. Phases

| Phase | Scope | Status |
|---|---|---|
| 1 — Setup and core foundation | project, theme + motion tokens, secure session, API client with refresh, realtime, role-based navigation shell, login / forgot password, Today + Dashboard reading live data, tests | **Built, verified on the Android emulator (see §3). Real-device recording pending.** |
| 2 — Core screens and job workflows | Today actions (status machine, On My Way SMS, clock in/out), Calendar (swipe days, All Employees), Dashboard map + employee sheet + Reassign, Job details (7 tabs), New job | **Built, verified on the Android emulator (see §4). Real-device recording pending; map needs the Google Maps keys.** |
| 3 — Remaining screens and animations | Customers, Estimates (incl. the line-item editor), Team chat, Customer messages, Search, Settings (More); animated tab bar, swipe actions, confetti, ring timer, truck motion | **Built, verified on the Android emulator (see §5). Real-device recording pending.** |
| 4 — Native features and offline | background location, push (server module + app), offline cache/queue/photo sync, camera, biometric unlock, deep links, light/dark polish | **Built, verified on the Android emulator (see §6). Real-device recording pending; push delivery to a phone needs the EAS project + FCM/APNs.** |
| 5 — Testing, optimisation, release | role matrix tests, Maestro flows, performance / Reduce Motion pass, EAS builds (TestFlight + Play internal) | **Built, verified on the Android emulator (see §7). Store builds need the HausBoss Expo / Apple / Google accounts (`docs/mobile/RELEASE.md`).** |

## 3. Phase 1 report (2026-10-21)

**Built (`mobile/`):**

- Expo SDK 58 project with TypeScript strict, Expo Router (typed routes), React Compiler, dev client; brand icon set
  (iOS light / dark / tinted, Android adaptive + monochrome, Android 12 splash icon, notification icon) generated from the
  web `public/icon.svg`; navy native splash with the house mark.
- `src/api/session.ts` — tokens in the Keychain / Keystore, in-memory copy, `onAuthStateChange`, proactive refresh timer.
  `src/api/client.ts` — the web client's contract (401 → one single-flight refresh → retry; rejection clears, network keeps;
  offline / unreachable / timeout messages). `src/api/realtime.ts` — Socket.IO with per-channel subscriptions, token
  rotation on reconnect, connection status.
- Providers: React Query persisted to MMKV (opens populated, works offline), NetInfo → client + query online state,
  `AuthProvider` (boot from the stored session, profile + roles cached per user, refresh on foreground),
  `CompanyProvider` (cached `GET /company` + subscription).
- Theme tokens = the web `index.css` values (light + dark, status colours), Inter, 44 pt targets; motion tokens
  (durations, easings, springs, stagger, Reduce Motion); UI kit (Text, Button with press-scale + haptic, Card, TextField,
  Screen, Skeleton, StatusBadge, EmptyState, Avatar).
- Screens: Login (field entrance stagger, shake + error haptic on failure, `email_not_confirmed` / disabled messages),
  Forgot password (modal), role-based tabs (technician: Today · Calendar · Chat · Messages · More; staff: Calendar ·
  Dashboard · Chat · Messages · More), Today (live technician queue from `GET /jobs` + `jobs:company:<id>`, next-job hero,
  pull-to-refresh, skeletons), Dashboard (KPIs + upcoming with assignee colours, roster count from `GET /team`),
  More (account, appearance system / light / dark, server + realtime status, sign out). Calendar / Chat / Messages are
  labelled placeholders until Phases 2–3.
- Tests (Jest, `npm test` in `mobile/`): session store (persist / load / events / expiry / proactive refresh), API client
  (bearer, error mapping, 401 refresh + retry, single-flight across concurrent 401s, proactive refresh, rejected vs network
  refresh, offline vs unreachable), technician grouping rules. 16 tests passing. `tsc` and `expo lint` clean.
- Repo: `npm run mobile:check | mobile:android | mobile:start` from the root; `mobile/README.md`; the web app's
  typecheck, lint and 262 tests still pass after the shared-adapter extraction.

**Verified on the Android 16 emulator (Pixel 8, API 36) against the local API:** 15-point checklist, screenshots and two
recordings in `docs/mobile/phase-1/README.md` — login errors, technician and owner tab sets, live job data, a realtime
status update, dark mode, cold start from the stored session, the automatic 15-minute token renewal, sign out.
A real-device run is still owed (open item 1).

**Open items for the HausBoss team:**

1. Run the Phase 1 build on a real iPhone / Android phone and record it (the environment here has an Android emulator only;
   iOS needs EAS Build or a Mac).
2. Create the EAS project (`npx eas-cli init` in `mobile/`) — needed for push tokens (Phase 4) and cloud builds.
3. Google Maps keys for the native SDKs (Android + iOS, restricted by package / bundle id) — Phase 2 map.
4. FCM V1 service account + APNs key — Phase 4 push.

## 4. Phase 2 report (2026-10-21)

**Built (`mobile/`):**

- Services on the existing API, mirroring the web rules through the shared adapters: `services/jobs.ts` (create / update /
  status with contractor GPS + audit, reorder, realtime upsert), `customers.ts`, `messages.ts`, `activity.ts`,
  `estimates.ts` (list / detail / submit / approve / reject / void / reopen / send), `media.ts` (multipart upload from a
  local file, `jobs.media_urls` read-modify-write, delete), `categories.ts`, `locations.ts` (foreground permission, GPS
  fix with last-known fallback, `PUT /locations/me`, company locations + `tech-locs:<companyId>` subscription, the
  `presence:company:<id>` ping protocol, native geocoding with an MMKV cache, reverse geocoding, straight-line ETA).
- Hooks: `useJobActions` (optimistic cache writes + toasts), `useClockActions` (photo prompt → notes → time entry →
  status, same state machine as the web), `useJobMessages` / `useJobActivity` / `useJobEstimates` (realtime),
  `useCustomers`, `useCategories`, `useCompanyLocations`, `useLocationTracking` (foreground 2-minute reports while a job
  is active + answers dispatcher pings), `useMediaUpload` + `pickMedia` (camera / library with GPS tag).
- Components: `JobStatusStepper` (animated fill, bouncy step pop), `JobTimer`, `OnMyWaySheet` (distance / ETA, SMS
  reminder), `PhotoPromptSheet` + `NotesSheet`, `MediaSection` (Pre / Post / Other grids, full-screen viewer, delete),
  `JobChat`, `JobActivityFeed`, `EstimateList` (+ detail sheet with actions), `ReassignSheet`, `JobDetailsEditor`,
  `JobCard`; `DayTimeline` (24-hour grid using the shared `layoutDay`, now-line) + `DayPager` (horizontal paging, ±180
  days); `DispatchMap` (react-native-maps with geocoded job pins, animated truck markers, pulse; "Map not configured"
  fallback when the build has no key), `EmployeeSheet`, `CheckStatusButton`, `CustomerPickerSheet`; UI kit additions
  (`Sheet` with drag-to-dismiss, `Select`, `Dialog`, `SegmentedControl`, `IconButton`, `Tabs`, `Toast`, `DateTimeField`).
- Screens: Today (hero + primary action, On My Way, clock in / out / complete, "Sharing location" pill), Calendar (day
  pager / list, filters sheet, "+ New job" for staff), Dashboard (KPIs, Check locations, filters, map or fallback, selected
  job card, roster → employee sheet → reassign, upcoming jobs), Job hub `job/[id]` (header, quick actions, stepper for
  staff / big action for the assigned technician, 7 tabs, Reassign), New job `job/new` (3-step form on the shared
  `jobFormSchema`, business unit / division, categories, pickers, attachments, "Save customer only"), deep link
  `hausboss://job/<id>`.
- `app.json`: expo-location (foreground only in this phase), expo-image-picker; `app.config.ts` adds the react-native-maps
  plugin only when `GOOGLE_MAPS_ANDROID_KEY` / `GOOGLE_MAPS_IOS_KEY` are set (EAS secrets / env, never in the repo).

**Verified on the Android 16 emulator against the local API:** 26-point checklist, 30 screenshots and three recordings in
`docs/mobile/phase-2/README.md` — the full technician day (Accept → On My Way with GPS → At Job Site → Clock In with
camera photo upload → In Progress timer → Complete with notes), calendar swipe, dashboard roster / employee sheet /
reassign, job hub tabs (stepper, chat, activity, estimates), the New job form end-to-end (customer + job created on the
server), dark mode, deep link. Four bugs found and fixed during verification are listed there.

**Gaps / decisions:**

- **Android / iOS map needs Google Maps SDK keys** (open item 3). Without them the build ships the fallback card; the
  roster, locations and pings all work. Set the keys and rebuild the dev client (`npm run mobile:android`).
- **Address autocomplete is not on mobile** — the web uses Google Places; the form takes a plain address and the app
  geocodes it natively (Android / iOS geocoder) for the map. Add Places when the keys exist if you want suggestions.
- **Estimate line-item editor is deferred to Phase 3**; mobile can view, send, submit, approve / reject, void and reopen.
- **Location is foreground-only until Phase 4** (background every 2 minutes needs the background-location plugin flags,
  the iOS "Always" prompt and a Play / App Store declaration). Push, offline queue and biometric unlock are also Phase 4.
- No server changes were needed in this phase.

## 5. Phase 3 report (2026-10-21)

**Built (`mobile/`):**

- Services: `sms.ts` (inbox, thread, send, assign / resolve / reopen / read, consent, `sms:company:<id>` realtime),
  `notifications.ts`, `catalog.ts` (+ the built-in HVAC list and `pickerEntries` for the estimate picker),
  `inventory.ts`, `leads.ts` (list, reject, `POST /requests/:id/schedule` with the shared `toJobInsert`),
  `billing.ts` (read-only seats / plan), `team.ts` (invite, role, deactivate / reactivate with the seat prompts),
  `categories.ts` (rename / reorder / toggle / delete), `customers.ts` (equipment, agreements, textable number),
  `estimates.ts` (save with full line-item replace, delete, public link).
- Providers / hooks: `NotificationsProvider` (`GET /notifications` + `notifications-<userId>`; unread count, unread
  chat per job, toast + haptic on arrival per the device prefs), `SmsInboxProvider` + `useSmsConversations` (one
  subscription for the tab badge and the inbox; gated by the Individual plan like the web), notification prefs in the
  settings store.
- Shared with the web (extracted, no duplication): `src/utils/phone.ts` (E.164 / formatting), `src/utils/search.ts`
  (`searchInMemory`); the web `customersService` and `GlobalSearch` re-export them. The job-form contact fields are one
  component (`CustomerFields`) used by New job, New customer and Edit customer.
- Screens: Messages (inbox) + `messages/[id]` (thread), Chat (job threads) + `chat/[jobId]`, Customers list / detail
  (Details · Jobs · Equipment · Agreements) / new / edit, `estimate/[id]` editor (catalog picker, line items, discount /
  tax, totals, submit / approve / reject / send / void / reopen / delete, share link), Search, Notifications, More with
  Products & services, Truck stock, Job categories, Team, Leads, Billing (read-only; purchases on the web).
- Motion: `AnimatedTabBar` (sliding pill, icon pop, badges, Reduce Motion), `SwipeableJobRow` (advance / reassign /
  call with threshold haptic), `TimerRing` (SVG ring + breathing glow) inside `JobTimer`, `Confetti` (Reanimated
  particles, seeded layout, skipped under Reduce Motion) on job completion, `TruckProgress` in the On My Way sheet.
  No Lottie / Skia dependency was needed; everything runs on the UI thread with Reanimated + SVG.

**Verified on the Android 16 emulator against the local API:** 25-point checklist, 30 screenshots and four recordings
in `docs/mobile/phase-3/README.md`. Five bugs found and fixed during verification are listed there, including a web bug
(lead scheduling mapped the server's `{ job, request }` answer as a bare job).

**Gaps / decisions:**

- **Sending a text needs a Telnyx number on the company** (local dev has none → the API answers 409, which the app
  shows). Inbound texts arrive through the Telnyx webhook on the server; the emulator run seeded them in the database.
- **Team invites link to the web app's accept-invite page** (the brief's `hausboss://accept-invite` deep link is Phase 4
  with the rest of the deep-link work); the invite itself is sent from mobile.
- **Billing is read-only on mobile** by design (purchases happen on the web; the screen links there).
- **Address autocomplete** remains a plain field (Google Places key, see Phase 2).
- No server changes were needed in this phase.

## 6. Phase 4 report (2026-10-21)

**Server (the one backend addition the brief allows — push):**

- Migration `server/db/migrations/0025_device_tokens.sql`: `device_tokens` (user, company, Expo push token — unique —,
  platform, device id / name, app version, timestamps), RLS "users manage their own devices", trusted role for sending.
- `server/src/integrations/push/`: `DeviceTokensController` (`GET/POST/DELETE /api/notifications/devices`, upsert by
  token, a token re-registered by another account on the same phone is re-homed), `PushService` (Expo Push API client
  in chunks of 100, optional `EXPO_ACCESS_TOKEN`, 5xx/429 → throw so pg-boss retries, `DeviceNotRegistered` tickets delete
  the token), `PushWorkers` (pg-boss `push.notification`), `expo-push.ts` (pure helpers). `RealtimeListener` enqueues one
  job per `notifications` INSERT with `singletonKey` = notification id, so several server instances never send twice.
  The message carries `data: { notificationId, type, jobId?, conversationId? }` and the recipient's unread count as the badge.
- Tests: `expo-push.spec.ts` (6) and `test/push-devices.e2e-spec.ts` (5: register / idempotent / RLS, validation,
  re-homing, send + prune against a stubbed Expo, delete). Server unit suite 57 passing, lint + typecheck clean.
  Verified live on the local server: a job update produced two notifications → two completed `push.notification` jobs →
  Expo answered `DeviceNotRegistered` for the test token and it was pruned.
- Env: `EXPO_ACCESS_TOKEN` (optional), `PUSH_DISABLED`. `docs/API.md` updated.

**Mobile (`mobile/`):**

- **Push** — `expo-notifications`; `services/push.ts` + `features/notifications/usePush.ts`: permission (Android 13
  prompt), the `default` channel, Expo token (needs `extra.eas.projectId`), `POST /notifications/devices` after sign-in and
  `DELETE` before sign-out, tap handling (foreground listener + cold-start `getLastNotificationResponseAsync`) → job / chat
  tab / SMS thread, in-app row marked read, app-icon badge = unread count. Foreground pushes show no banner while the
  realtime socket is connected (the toast already covers it). Status surfaced under More → Security & permissions.
- **Background location** — `expo-location` + `expo-task-manager`; `services/backgroundLocation.ts` defines the
  `hausboss.location` task at module scope (also runs headless): balanced accuracy, 2-minute interval, Android foreground
  service with a "Sharing location" notification, iOS `location` background mode. `useLocationTracking` starts it while a job
  is en route / in progress when "always" is granted, falls back to the foreground 2-minute report otherwise (the Today
  pill then reads "Location while open" and opens the explainer), stops it when the job is done or the user signs out.
  `LocationPermissionSheet` explains before the OS prompts (foreground → "Allow all the time").
- **Offline** — `services/offlineQueue.ts` (MMKV port of the web queue): job updates, status changes with the GPS fix
  captured at the time, chat messages and photo uploads (files copied into app storage first). FIFO, single-flight,
  merge-on-write; a transient failure stops the run so order holds, a 4xx marks the op "needs attention" (never silently
  dropped) with Retry / Discard in the animated `OfflineBanner`. Replays on reconnect and on foreground; the job cache is
  refreshed after. Queued chat messages show as pending rows; queued photos are listed once uploaded. `useJobActions`,
  `useJobMessages`, `useMediaUpload` branch on `isOnline()`. 9 unit tests.
- **Media** — images are downscaled to 1600 px / JPEG 0.8 before upload (`expo-image-manipulator`); failed uploads offer
  Retry; GPS tag unchanged.
- **Biometric unlock** — `expo-local-authentication`; `LockProvider`: offered once after the first interactive sign-in,
  toggle under More → Security & permissions (confirming with the prompt), locks on cold start and after 30 s in the
  background, privacy cover in the app switcher (native blur on iOS, opaque wash on Android), device passcode fallback,
  "Sign out" escape hatch.
- **Deep / universal links** — `+native-intent.ts` + `lib/deepLinks.ts` (unit-tested): `hausboss.app/estimate/<token>` →
  customer-facing `public-estimate/[token]` (Accept / Decline), `/accept-invite?token=` and `/reset-password?token=` →
  token exchange (`POST /auth/exchange`) + set password (`POST /auth/password`), `/job/<id>`, `/messages/<id>`; the
  `hausboss://` scheme keeps working. `app.json`: Android `intentFilters` (autoVerify) and iOS `associatedDomains`;
  `public/.well-known/assetlinks.json` + `apple-app-site-association` added to the web app (placeholders for the signing
  fingerprint / Team ID) and an nginx `location /.well-known/` block.
- More → **Security & permissions** screen (app lock, location permission state, push state); version label "phase 4".
- Config: `expo-notifications` (icon, colour, channel), `expo-location` background + foreground-service flags,
  `expo-local-authentication`, `expo-task-manager`; `UIBackgroundModes: location, remote-notification`.

**Verified on the Android 16 emulator against the local API** (`docs/mobile/phase-4/README.md`, 26 screenshots, three
recordings): offline accept → chat → photo → reconnect replay (server rows confirmed), app lock (enable with the device
PIN, lock now, cold start, dark mode), location explainer → "Allow all the time" → On My Way → background task report
every 2 minutes with the app in the background (server row updated), public estimate link → Accept, reset-password link →
new password, job link, push permission prompt + device registration path (status "no EAS project id" in this build).

**Gaps / decisions:**

- **Push to a real phone is not testable here**: an Expo push token requires the EAS project id (`eas init`) plus FCM
  V1 / APNs credentials on the project (open items 2 and 4). The app reports "Not available in this build" and keeps the
  socket notifications; the server side was exercised against the real Expo API with a throw-away token.
- Universal links need the real values in `public/.well-known/*` (release signing SHA-256, Apple Team ID) before Android /
  iOS verify them; until then the links open in the browser (the `hausboss://` scheme is unaffected).
- Android cannot blur behind the lock cover without extra native plumbing; it uses an opaque wash. iOS blurs.
- The background task keeps running if the dispatcher completes the job while the phone sleeps; it stops on the next
  foreground (the hook re-evaluates) — acceptable for Phase 4, noted for Phase 5.
- Screenshots of the system PIN / biometric prompt are black (Android secures the keyguard UI); recordings show the cover
  before and after.

## 7. Phase 5 report (2026-10-22)

**Tests and quality gates**

- Role gating extracted to `mobile/src/features/auth/roles.ts` (`deriveRoleFlags`, `tabsFor`, `homeTabFor`) and used by
  `AuthProvider`, the tab layout and the launch redirect; the role matrix (admin, superadmin, manager, contractor, mixed,
  none) is unit-tested. Status rules (technician primary action, one-step-forward for technicians, free movement for
  staff, same-status no-op) are tested against the shared `@/utils/jobStatus`.
- A WCAG AA contrast test runs over both themes (text pairs, status badges, semantic fills). It failed first: the light
  destructive / success / warning and the dark accent / success / destructive colours were below 4.5:1 either as fills
  under white text or as text on the page. The app palette moved one step (light: `#dc2626`, `#15803d`, `#b45309`
  with white on-colour; dark: `#4d82ff`, `#ef5a5a` with navy on-colour). The web tokens are untouched.
- Sentry (`@sentry/react-native`): `src/lib/monitoring.ts` — DSN from `EXPO_PUBLIC_SENTRY_DSN` (disabled without),
  `sendDefaultPii: false`, user context = account id, `beforeSend` / `beforeBreadcrumb` scrub emails, phone numbers,
  bearer tokens, token query strings and media file names (unit-tested); Expo Router tracing integration;
  `Sentry.wrap(RootLayout)`; Metro `getSentryExpoConfig`; the config plugin for source-map upload is added by
  `app.config.ts` only when `SENTRY_ORG` / `SENTRY_PROJECT` are set.
- Mobile Jest: 82 tests / 12 suites; `npm run mobile:check` clean. A latent bug surfaced: `groupTechnicianJobs` used the
  real clock (`isToday`) instead of the `now` it was given — fixed with `isSameDay`.

**Maestro E2E** (`mobile/.maestro/`, Maestro CLI 2.11): `01-login`, `02-technician-completes-job`,
`03-dispatcher-reassigns`, `04-offline-status-sync` — all four pass on the emulator against the local API
(`docs/mobile/phase-5/README.md`). `run.sh` resets three fixture jobs before each flow (`fixtures/reset.sql`), clears the
app data, and after the dispatcher / offline flows checks the server rows (`assigned_user_id`, `status`). Against a dev
client it opens the Metro bundle through `DEV_CLIENT_URL`; preview / release builds use `launchApp`.

**Accessibility / motion pass**: every control labelled (audit), font scaling at 200 % holds, Reduce Motion verified
on the emulator (cross-fades instead of springs, no shimmer / confetti), dark mode re-checked after the palette change.

**Performance**: release build with R8 + resource shrinking (`expo-build-properties`). Cold start on the emulator
(release APK, 2 × 5 runs): native first frame 0.79–1.02 s, first interactive screen 2.5–3.0 s, median 2.7 s — indicative only (x86 emulator, screenshot probe; measured to the login screen because release builds block the local plain-HTTP API, see below). The release build first **crashed at process start** because R8 stripped Room's `WorkDatabase_Impl` (WorkManager from expo-notifications / expo-task-manager); keep rules now ship through `expo-build-properties.extraProguardRules`. Release builds also refuse plain-HTTP servers; `app.config.ts` adds `usesCleartextTraffic` (through `expo-build-properties`) only when `EXPO_PUBLIC_API_URL` is `http://` — manifest verified, the rebuild with it is pending (the build was stopped by the OS for lack of memory). The brief's targets (< 2.0 s Pixel 6a class, < 1.2 s recent
iPhone) must be measured on real devices in a release build — open item.

**Release plumbing**: `mobile/eas.json` (development / preview / production + submit), `runtimeVersion` policy
`appVersion`, `versionCode` / `buildNumber`, env documented in `mobile/.env.example`, `docs/mobile/RELEASE.md` (accounts
and credentials to create, EAS env vars, build / submit commands, EAS Update, Play and App Store declarations incl. the
background-location justification, pre-release checklist), store assets in `docs/mobile/store/` (feature graphic,
listing text, emulator screenshots as layout placeholders). Phase 4's open item (background task running after the office
closes the job) is closed: the task checks for a live job after each report and stops itself.

**Branding (2026-10-22, user request):** the app icon and splash now use the house mark of the live logo
(`https://hausboss.app/hausboss-logo.png`) instead of the web `icon.svg` house: white icon tile with the navy / blue
house (dark and tinted iOS variants, Android adaptive + monochrome), **white** splash — the full logo with the wordmark on
iOS, the house icon on Android 12+ (system splash is icon-only and circle-masked) — and the same vector mark in the boot
screen, login and lock cover. This replaces the brief's navy splash; the assets need the next native build to show up.

**Motion tuning (2026-10-22, user feedback on the live APK):** bottom sheets and the tab-bar highlight overshot
and settled back (under-damped `gentle` / `snappy` springs over long travels). New `spring.settle` token
(damping 30, stiffness 240, overshoot clamped) for sheet presentation, sheet snap-back and the tab pill; verified by
tracking the pill (`docs/mobile/phase-5/phase5-tab-and-sheet-motion.mp4`) and the sheet edge (`phase5-sheet-motion.mp4`) frame by frame
(monotonic, no reversal). Toggles: Android drew its system teal thumb next to the brand-blue track; every switch now
goes through `components/ui/Toggle` (blue track + white thumb on, muted track + light thumb off, both schemes).

**Open items (need the HausBoss accounts / devices)**

1. `eas init` (project id), FCM V1 + APNs credentials, Google Maps keys, Sentry DSN / org / project / auth token — all as
   EAS environment variables; nothing is hard-coded.
2. `eas build --profile production` for iOS and Android, `eas submit` to TestFlight and the Play internal track (the first
   AAB is uploaded by hand in the Play Console), release SHA-256 + Apple Team ID in `public/.well-known/*`.
3. Real-device verification and recordings for every phase (the brief's acceptance criteria), cold-start timing on a
   Pixel 6a-class phone and a recent iPhone, push delivery to a phone, background location on a phone in a pocket.
4. Store screenshots captured on real devices with the production configuration (map and SMS configured).
