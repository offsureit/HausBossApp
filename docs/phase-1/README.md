# Phase 1 verification — 2026-10-21

Build: `mobile/` dev client (`expo prebuild` + `gradlew assembleDebug`, Expo SDK 58, RN 0.88) on an Android 16
emulator (Pixel 8, API 36, `hausboss_dev` AVD) against the local API (`http://10.0.2.2:3105`, seeded data).
**Not yet run on a real phone** — that step is the HausBoss team's (see `docs/MOBILE_APP_PLAN.md`, open items).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Cold start: native splash → login (signed out) | pass | `phase1-technician-login-emulator.mp4` |
| 2 | Wrong password: inline error, shake + error haptic, no navigation | pass | `02-login-error.png` |
| 3 | Technician sign-in → Today with the technician tab set (Today · Calendar · Chat · Messages · More) | pass | `03-technician-today.png` |
| 4 | Today shows the technician's own jobs from `GET /jobs` (RLS-scoped), overdue + today first | pass | `03-technician-today.png` |
| 5 | Realtime: owner changes the job status through the API → the card updates without a refresh (`jobs:company:<id>`) | pass | `04-today-dark-realtime-update.png` (Pending → Accepted) |
| 6 | Appearance: System / Light / Dark, persisted | pass | `04-…` (dark), `05-more.png` |
| 7 | More: account, role, company, server, realtime "Connected" | pass | `05-more.png` |
| 8 | Reload (cold start with a stored session): no login prompt, Today opens from the Keychain / Keystore session | pass | recording, `06-more-token-renewed.png` |
| 9 | Automatic token refresh: signed in 4:39 PM (15-min token, renews 4:53 PM) → at 4:54 PM the session shows "renews 5:07 PM" and the app keeps working | pass | `06-more-token-renewed.png` |
| 10 | Sign out: confirmation, session + caches cleared, back to login | pass | `phase1-owner-login-emulator.mp4` |
| 11 | Owner sign-in → Calendar with the staff tab set (Calendar · Dashboard · Chat · Messages · More) | pass | `07-owner-calendar-tabs.png` |
| 12 | Dashboard: KPIs, upcoming jobs with assignee colours (`GET /jobs`, `GET /team`) | pass | `08-owner-dashboard.png` |
| 13 | Unit tests (session store, API client refresh rules, grouping) | 16 passing | `cd mobile && npm test` |
| 14 | `tsc --noEmit`, ESLint (expo config) | clean | `npm run mobile:check` |
| 15 | Web app unaffected by the shared-adapter extraction | 262 tests, typecheck, lint pass | `npm run check` (web parts) |

Recordings are 540 px, ~0.8 MB each (3-minute emulator capture limit per clip).
