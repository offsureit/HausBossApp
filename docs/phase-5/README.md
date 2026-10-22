# Phase 5 verification — 2026-10-22

Testing, optimisation and release readiness. Verified on the Android 16 emulator (Pixel 8, API 36, `hausboss_dev`)
against the local API, with a **new dev client** (adds `@sentry/react-native` and `expo-build-properties`) and a
**local release build** (`assembleRelease`, R8 + resource shrinking, embedded bundle) for the timing numbers.
**Not yet run on a real phone** — the HausBoss team's step (see `docs/MOBILE_APP_PLAN.md` §7 and `docs/mobile/RELEASE.md`).

## Automated checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `npm run mobile:check` — TypeScript strict, ESLint, Jest | clean, **82 tests** in 12 suites | root |
| 2 | Role matrix (`features/auth/__tests__/roles.test.ts`): admin / superadmin / manager / contractor / mixed / none → staff, contractor, admin flags, tab set, home tab; Today and Dashboard never together | 8 passing | `src/features/auth/roles.ts` is now the single source for `AuthProvider`, the tab layout and the launch redirect |
| 3 | Status rules (`components/jobs/__tests__/primaryAction.test.ts`): technician primary action per status, next-status targets, technicians cannot skip or go back, staff can, same-status no-op | 4 passing | shared `@/utils/jobStatus` |
| 4 | Contrast AA, both themes (`theme/__tests__/contrast.test.ts`): 13 text/background pairs, status badges, semantic colours on surfaces | 20 passing **after fixes** (see below) | tokens |
| 5 | Monitoring privacy (`lib/__tests__/monitoring.test.ts`): emails, phone numbers, bearer tokens, token query strings, media file names scrubbed; ids and dates kept; request headers / bodies dropped; user = id only; disabled without a DSN | 5 passing | `src/lib/monitoring.ts` |
| 6 | Existing suites (API client / session refresh, offline queue, deep links, push routing, SMS, catalog, grouping) | passing | `grouping.test.ts` exposed a real bug, fixed (below) |
| 7 | Server suite unchanged by this phase | 57 passing (Phase 4) | — |

## Maestro end-to-end flows (`mobile/.maestro/`, `run.sh`)

Each flow starts from cleared app data, signs in through the real login screen and is checked on the server afterwards.
Full suite: **4 / 4 passing** (`.maestro/run.sh`, 2026-10-22 08:40).

| # | Flow | Steps | Result | Evidence |
|---|---|---|---|---|
| 8 | `01-login` | wrong password → "Invalid email or password"; right password → Today, technician tabs (no Dashboard) | pass | `maestro-01-login.png` |
| 9 | `02-technician-completes-job` | Accept → On My Way (explainer → confirm) → "Sharing location" → At Job Site → Clock In (photo prompt → Skip) → In Progress → Complete (photo → notes → "Complete job") → job listed under Completed | pass | `maestro-02-en-route.png`, `maestro-02-in-progress.png`, `maestro-02-completed.png`, `phase5-maestro-technician.mp4` |
| 10 | `03-dispatcher-reassigns` | owner → Dashboard → employee roster → technician sheet (open jobs) → Reassign → picker → manager → roster count drops; **server row `assigned_user_id` = manager** | pass | `maestro-03-employee-sheet.png`, `maestro-03-reassigned.png` |
| 11 | `04-offline-status-sync` | airplane mode → banner → open the job → Accept (optimistic, "1 change queued") → airplane off → banner gone; **server row `status = accepted`** | pass | `maestro-04-queued.png`, `maestro-04-synced.png` |

The recording of flow 9 was taken with the device-side recorder, which slows the emulator enough that the last
assertion ran past the 3-minute cap; the un-recorded run passes. Flows run against the dev client through
`DEV_CLIENT_URL`; against a preview / release build the same flows use `launchApp` with cleared state.

## Accessibility and motion

| # | Check | Result | Evidence |
|---|---|---|---|
| 12 | Every tappable has a role + label (audit of `Pressable` / `PressableScale` uses; `Button`, `IconButton`, `Select`, `DateTimeField`, tabs, rows, cards, sheet backdrop) | no unlabelled control found | grep in `src/` |
| 13 | Contrast AA: light `destructive`, `success`, `warning` were 3.6–3.7:1 with white text and 2.0:1 as text on the page; dark `accent` 4.3:1, `success` 3.2:1, `destructive` 2.7:1 as text | **fixed** — light semantic colours one step darker (`#dc2626`, `#15803d`, `#b45309`, white on-colour); dark accent / destructive lighter (`#4d82ff`, `#ef5a5a`) with navy on-colour; all pairs ≥ 4.5:1, fills ≥ 3:1 | `contrast.test.ts`, store screenshots |
| 14 | Font scaling 200 % (Android "largest"): Today and the job hub stay usable, no clipped controls; `Text` caps at 1.6× so layouts hold | pass (header pills crowd at 200 %, acceptable) | `a11y-font-200-today.png`, `a11y-font-200-job.png` |
| 15 | Reduce Motion (`animator_duration_scale 0`): tab switches cross-fade, no pill spring / stagger / skeleton shimmer / confetti; sheets fade | pass | `phase5-reduce-motion.mp4`, `a11y-reduce-motion-today.png` |
| 16 | Dark mode after the token change: Today, job hub, Dashboard | pass | `docs/mobile/store/*-dark.png` |

## Performance

| # | Check | Result | Evidence |
|---|---|---|---|
| 17 | Release build (`expo-build-properties`: `enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`) builds and launches | pass **after the keep-rule fix** (below) | universal `app-release.apk` 121 MB (all four ABIs + x86; the Play AAB is split per ABI); login screen: `release-build-today.png` |
| 18 | Cold start, release build, 2 × 5 runs after `am force-stop` on the x86 emulator: native first frame (`am start -W` TotalTime) **0.79–1.02 s**; first interactive screen (login — see the cleartext note; screenshot probe every ~0.4 s) **2.5–3.0 s, median 2.7 s** | measured | the probe itself loads the emulator and the x86 emulator is not a Pixel 6a; the signed-in cold start (Today from the cache) and the brief's < 2.0 s (Android) / < 1.2 s (iPhone) must be measured on real devices — open item |
| 19 | Lists use FlashList, React Compiler on, Reanimated on the UI thread (Phases 1–3); no new work on the JS thread at launch — Sentry init is synchronous and cheap, disabled without a DSN | by inspection | `src/app/_layout.tsx` |

## Monitoring and release plumbing

| # | Check | Result | Evidence |
|---|---|---|---|
| 20 | Sentry wired: `monitoring.init()` before the splash, `Sentry.wrap(RootLayout)`, Expo Router integration, user id on sign-in / cleared on sign-out, DSN from `EXPO_PUBLIC_SENTRY_DSN` (none here → disabled), Metro `getSentryExpoConfig` | app boots, bundle builds with debug ids | `_layout.tsx`, `metro.config.js` |
| 21 | `eas.json` (development / preview / production, submit config), `runtimeVersion` policy, version codes, `.env.example`, `docs/mobile/RELEASE.md` (accounts, credentials, env vars, store declarations, checklist), store assets (`docs/mobile/store/`) | written | — |
| 22 | Background location stops on its own when the office closes the job while the phone sleeps (Phase 4 open item): after each 2-minute report the task checks for a live job and stops when none | code + unit-level reasoning; emulator check pending a live job | `backgroundLocation.ts#hasLiveJob` |

## Fixed while verifying

- **Release build crashed at process start** (`Unable to get provider androidx.startup.InitializationProvider … Failed
  to create an instance of class androidx.work.impl.WorkDatabase`): with R8 on, the Room-generated `WorkDatabase_Impl`
  that WorkManager (expo-notifications / expo-task-manager) looks up by name was stripped. Keep rules for Room /
  WorkManager are now passed through `expo-build-properties.extraProguardRules`; the rebuilt release APK launches.
  Caught only because this phase builds and runs the *release* variant — the debug dev client never minifies.
- **Release builds could not reach a plain-HTTP server** ("Could not reach the server") — Android blocks cleartext in
  release builds; the dev client allows it. `app.config.ts` now sets `android.usesCleartextTraffic` only when
  `EXPO_PUBLIC_API_URL` starts with `http://` (local / staging); production (`https://hausboss.app`) is unchanged.
  SDK 58 only honours the flag through `expo-build-properties`, so `app.config.ts` merges it into that plugin's options;
  the generated manifest was verified (`android:usesCleartextTraffic="true"`), but the rebuild with it was stopped by the
  OS for lack of memory (the emulator, Metro and Gradle together exceed this machine) — rerun
  `cd mobile/android && ./gradlew :app:assembleRelease :app:assembleDebug` with the emulator closed, then sign in on the
  release build and repeat the cold-start probe (`scratchpad/coldstart2.sh` logic is in this README's step 18).
- **Day bucketing used the device clock, not the given one** — `groupTechnicianJobs` called `isToday(d)` (real
  clock) while everything else used `now`; the unit test only passed on the day it was written. Now `isSameDay(d, now)`.
- **Semantic colours failed AA** in both themes (above). The web tokens are unchanged; the app's palette moves one step.
- **Chat timestamp on own bubbles** used hard-coded white; it follows `accentForeground` now (navy on the dark accent).
- **Lucide icons could not load under Jest** (`.mjs` entry) — mapped to the CommonJS build in `jest.config.js`.
- Stale "arrives in Phase 4" copy on the Notifications screen removed; the More screen shows the build number.
- Changing the system font size recreates the Android activity (standard behaviour); the dev build then logs React
  Navigation's "linking configured in multiple places" notice once. It does not appear on launch and is not shown in
  release builds.

## Not verifiable here

- Real devices (iPhone / Android phone), TestFlight and Play internal builds: need the HausBoss Expo, Apple and Google
  accounts (`docs/mobile/RELEASE.md` §0). iOS builds run on EAS (this machine is Linux).
- Push delivery to a phone (EAS project id + FCM / APNs), the Dashboard map (Google Maps keys) and customer texts
  (Telnyx number) — all configuration, no code.
- Sentry events (no DSN in this environment); the scrubbing is unit-tested.
