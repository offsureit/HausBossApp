# HausBoss Mobile — release guide (EAS Build, TestFlight, Play internal testing)

Everything below runs from `mobile/`. The HausBoss team owns the Expo, Apple and Google accounts;
nothing here can be executed from this repository without them. No key, token or password is
committed — they live in EAS environment variables / secrets (`eas env:create`) or local
`.env.*.local` files that `.gitignore` excludes.

## 0. One-time setup

| Step | Command / place | Result |
|---|---|---|
| Expo account + project | `npx eas-cli@latest login` then `npx eas-cli@latest init` | Creates the EAS project and writes `extra.eas.projectId` into `app.json`. Push tokens (`expo-notifications`) need this id; until it exists the app reports "Not available in this build" under More → Security. The id can also be injected at build time as `EAS_PROJECT_ID` (`app.config.ts`). |
| Android push (FCM V1) | Firebase console → project → Service accounts → generate key; `eas credentials` → Android → Google Service Account → FCM V1 | Expo Push can deliver to Android. The app does **not** bundle `google-services.json`; Expo's push service holds the credential. |
| iOS push (APNs) | `eas credentials` → iOS → Push Notifications → let EAS create the key | Expo Push can deliver to iOS. |
| Signing | `eas credentials` (Android keystore + iOS distribution certificate / profiles, both EAS-managed) | Note the **release SHA-256** (`eas credentials` → Android → Keystore) — it goes into `public/.well-known/assetlinks.json` (universal links). The **Apple Team ID** goes into `apple-app-site-association`. Both files are served by nginx (`docs/DEPLOYMENT.md`, "Mobile app links"). |
| Google Maps | Google Cloud → Maps SDK for Android (restrict to `app.hausboss.mobile` + the release SHA-1) and Maps SDK for iOS (restrict to the bundle id) | Set `GOOGLE_MAPS_ANDROID_KEY` / `GOOGLE_MAPS_IOS_KEY` as EAS env vars (sensitive). Without them the Dashboard map shows "Map not configured". |
| Sentry | Sentry org + project (React Native); an *organization auth token* scoped to source-map upload | `EXPO_PUBLIC_SENTRY_DSN` (plain), `SENTRY_ORG`, `SENTRY_PROJECT` (plain), `SENTRY_AUTH_TOKEN` (secret). `app.config.ts` adds the Sentry config plugin only when org + project are set. |
| App Store Connect | Create the app (bundle id `app.hausboss.mobile`), note the **ASC app id** | `eas.json` → `submit.production.ios.ascAppId`. |
| Google Play Console | Create the app (package `app.hausboss.mobile`); Setup → API access → service account with "Release manager" | Download the JSON key to `mobile/play-service-account.json` (git-ignored). The **first** AAB must be uploaded by hand in the console before `eas submit` can push to the internal track. |

EAS environment variables (`eas env:create --scope project`), per environment (`development`, `preview`, `production`):

| Name | Visibility | Used by |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | plain | the app (`https://hausboss.app`; staging builds can point elsewhere) |
| `EXPO_PUBLIC_SENTRY_DSN` | plain | the app (`src/lib/monitoring.ts`); empty = Sentry off |
| `GOOGLE_MAPS_ANDROID_KEY`, `GOOGLE_MAPS_IOS_KEY` | sensitive | `app.config.ts` → native map SDK |
| `SENTRY_ORG`, `SENTRY_PROJECT` | plain | `app.config.ts` → Sentry config plugin |
| `SENTRY_AUTH_TOKEN` | secret | source-map / dSYM upload during the build |
| `EAS_PROJECT_ID` | plain (optional) | `app.config.ts` → `extra.eas.projectId` when `eas init` did not write it |

## 1. Build profiles (`mobile/eas.json`)

| Profile | What | Install |
|---|---|---|
| `development` | dev client (`expo-dev-client`), internal distribution, APK | `eas build --profile development --platform android` → install the APK; `--platform ios` → ad-hoc provisioned IPA for registered devices (`eas device:create` first) |
| `preview` | release build, internal distribution, APK / ad-hoc IPA, channel `preview` | QA builds that talk to production or staging without the stores |
| `production` | store build (AAB / App Store IPA), `autoIncrement` build numbers, channel `production` | TestFlight + Play internal testing |

Release builds run R8 with resource shrinking (`expo-build-properties` in `app.json`). The `extraProguardRules` there
keep Room / WorkManager classes that expo-notifications and expo-task-manager load by name — without them the release
build crashes on launch. Re-check a release APK on a device after adding any library that ships native Android code. A release build pointed at
a plain-HTTP server (local / staging) gets `usesCleartextTraffic` from `app.config.ts`; the production URL is HTTPS and
never does.

`appVersionSource: remote` — EAS stores and increments `versionCode` / `buildNumber`; `expo.version` in `app.json` is the marketing version.

```bash
# iOS (Linux machines build in the cloud; a Mac is not needed)
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios --latest          # → TestFlight (internal testers see it after processing)

# Android
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest submit --platform android --latest      # → Play internal testing track (draft release)
```

Both can run as one: `eas build --profile production --platform all --auto-submit`.

### Over-the-air updates (optional)

`app.json` already pins `runtimeVersion: { policy: "appVersion" }`. To enable EAS Update: `npx expo install expo-updates`,
`eas update:configure`, then `eas update --branch production --message "…"` ships JS-only changes to the channel each
build profile names. The boot sequence never waits for the network, so an update downloads in the background and
applies on the next launch (the brief's requirement). After each update run `npx sentry-expo-upload-sourcemaps dist`.

## 2. Store listing

Assets: `docs/mobile/store/` (feature graphic 1024×500, phone screenshots light + dark, listing text in `listing.md`).
Icons: `mobile/assets/images/` — all generated from the house mark of `hausboss-logo.png` (the logo on hausboss.app;
colours `#041a3d` / `#0459e6`): iOS 1024 px light (white tile), dark (navy tile, white house) and tinted (greyscale on
transparent), Android adaptive (foreground inside the 66 % safe zone, white background, white monochrome silhouette for
Android 13 themed icons), the Android 12 splash icon (`splash-icon.png`, artwork inside the 768 px circle), the iOS
splash image (`splash-logo.png`, the full logo with the wordmark) and the white notification silhouette. The generator
is `docs/mobile/store/make-icons.py` (PIL, supersampled); the in-app vector
(`src/components/BrandLogo.tsx`) uses the same traced geometry so the boot screen matches the native splash.

**Google Play — declarations the reviewer will ask for**

- *Background location* (`ACCESS_BACKGROUND_LOCATION`): the technician's position is reported every two minutes
  only while a job is en route / in progress, after an in-app explainer and the OS "Allow all the time" prompt, with a
  persistent foreground-service notification; it stops when the job completes. Play requires a short video showing the
  explainer → permission → feature; `docs/mobile/phase-4/phase4-tech-location.mp4` is a usable draft (re-record on a
  phone for the submission).
- *Foreground service type* `location` (declared by `expo-location`'s plugin).
- *Data safety*: account email / name (app functionality, not shared), precise location (app functionality, shared with
  the user's own company only), photos / videos (user-generated job media), messages (job chat + customer SMS via the
  company's Telnyx number), crash logs (Sentry, no PII — ids only). Data is encrypted in transit; users can request
  deletion through the company owner. No ads, no third-party analytics.
- *Login for review*: provide a staging owner + technician account in the review notes (never production credentials).

**App Store — App Privacy answers** mirror the Play data-safety list; `usesNonExemptEncryption` is already `false`.
Required usage strings are all set by the config plugins (`app.json`): location when-in-use / always, camera,
photo library, microphone (video), Face ID.

## 3. Pre-release checklist

1. `npm run mobile:check` (typecheck, lint, Jest) and `cd server && npm test` are green.
2. Maestro flows pass on an emulator against staging (`mobile/.maestro/run.sh`), see `docs/mobile/phase-5/README.md`.
3. `public/.well-known/*` carry the real SHA-256 / Team ID and are deployed (`curl https://hausboss.app/.well-known/assetlinks.json`).
4. A `preview` build on a real Android phone and iPhone: push arrives (job assigned → tap opens the job), background
   location shows up on the web Dashboard, universal link from an SMS/email opens the app.
5. Cold-start timing on the release build recorded in the phase report (target < 2.0 s mid-range Android, < 1.2 s recent iPhone).
6. Sentry receives a test event from the preview build (More → Security → "Send test crash" is **not** shipped; throw
   from a dev menu or check the session count instead).
