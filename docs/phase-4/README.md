# Phase 4 verification — 2026-10-21

Build: a **new dev client** (the phase adds native modules: expo-notifications, expo-task-manager,
expo-local-authentication, expo-blur, expo-image-manipulator; background-location + foreground-service flags; app-link
intent filters) built locally with `expo prebuild` + Gradle and installed on the Android 16 emulator (Pixel 8, API 36,
`hausboss_dev` AVD), against the local API (`http://10.0.2.2:3105`, seeded data, pg-boss queue and realtime listener on).
**Not yet run on a real phone** — that step is the HausBoss team's (see `docs/MOBILE_APP_PLAN.md`, open items). A device
PIN (1234) was set on the emulator so the app lock could use the device-credential fallback (no biometrics are enrolled on
an emulator). Android blacks out screenshots of the system PIN / biometric prompt, so those frames show the cover only.

Signed in as the technician (Tom Tech) throughout; the office actions came from the owner through the API.

## Server push module

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Migration `0025_device_tokens.sql` applies; `GET/POST/DELETE /api/notifications/devices` behind RLS | pass | `npm run db:migrate`, e2e below |
| 2 | Unit tests (`expo-push.spec.ts`: token validation, payload, badge, chunking, ticket summary) | 6 passing | `npx jest src/integrations/push` |
| 3 | e2e (`test/push-devices.e2e-spec.ts`: register / idempotent / per-user listing, validation, token re-homing, send + `DeviceNotRegistered` pruning against a stubbed Expo, 5xx → retry, delete) | 5 passing | `npx jest --config test/jest-e2e.json test/push-devices.e2e-spec.ts` |
| 4 | **Live pipeline**: a throw-away token registered for Tom through the API → the owner reschedules a job → trigger inserts two `notifications` rows → `RealtimeListener` enqueues two `push.notification` jobs → both `completed` → the real Expo Push API answered `DeviceNotRegistered` → the token row was deleted | pass | `pgboss.job` rows, `device_tokens` count 1 → 0 |
| 5 | Server unit suite, lint, typecheck after the change | 57 passing / clean / clean | `npm test`, `npm run lint`, `npm run typecheck` |

## Technician — offline queue (`phase4-tech-offline.mp4`)

| # | Check | Result | Evidence |
|---|---|---|---|
| 6 | Airplane mode → animated banner "You are offline" slides in | pass | `03-offline-banner.png` |
| 7 | Accept (pending → accepted) offline: optimistic status, "status change queued", banner count 1 | pass | `04-offline-accept-queued.png` |
| 8 | Chat message offline: shown as a pending row, banner count 2 | pass | `05-offline-chat-queued.png` |
| 9 | Take photo offline (camera → compressed JPEG → copied into app storage → queued), banner count 3 | pass | `06-offline-photo-queued.png` |
| 10 | Back online → FIFO replay → "Back online — 3 queued changes sent"; server has status `accepted`, the message, one media item on the job; local copy removed | pass | `07-back-online-replayed.png`, DB rows |
| 11 | Unit tests: FIFO, GPS fix carried with a queued status change, transient failure stops the run and retries, 4xx → stuck (Retry / Discard), max attempts, merge-on-write, offline no-op, error classification | 9 passing | `services/__tests__/offlineQueue.test.ts` |

## Technician — app lock (`phase4-tech-lock.mp4`)

| # | Check | Result | Evidence |
|---|---|---|---|
| 12 | More → Security & permissions: lock toggle disabled until the phone has a credential; enabled after the PIN is set (availability re-read on focus) | pass after fix | `02-security-light.png` |
| 13 | Turning the lock on asks for the credential first ("Confirm to turn on app lock") | pass | recording |
| 14 | "Lock now" → privacy cover + system prompt; cancel shows the cover with Unlock / Sign out; PIN unlocks | pass | `09-locked-cover.png`, recording |
| 15 | Cold start with the lock on → prompt before the app is shown | pass after fix | `09-locked-cover.png` |
| 16 | Dark mode: Security screen and the cover | pass | `23-security-dark.png`, `24-locked-dark.png` |

## Technician — background location (`phase4-tech-location.mp4`)

| # | Check | Result | Evidence |
|---|---|---|---|
| 17 | "On My Way" the first time → explainer sheet (why, battery, who sees it) before any OS prompt | pass | `10-location-explainer.png` |
| 18 | Continue → Android location settings for the app → "Allow all the time" → back → the On My Way sheet opens with the ETA | pass | `11-os-location-settings.png`, `12-allow-all-the-time.png`, `13-on-my-way-after-permission.png` |
| 19 | Confirm → truck animation → status `en-route` → Today pill "Sharing location" (mode background) | pass | `14-truck.png`, `15-en-route-sharing-location.png` |
| 20 | Android foreground service with the "HausBoss is sharing your location" notification | pass after fix | `16-foreground-service-notification.png` |
| 21 | App in the background: the `hausboss.location` task runs every 2 minutes and PUTs `/locations/me` (server `user_locations.captured_at` advanced; logcat `[location] background report sent`) | pass | logcat, DB |
| 22 | Office completes the job → the pill disappears and the task stops | pass | `25-tracking-stopped-after-completion.png` |
| 23 | Security screen reports "Allowed all the time" | pass | `23-security-dark.png` |

## Deep links and push registration

| # | Check | Result | Evidence |
|---|---|---|---|
| 24 | `https://hausboss.app/estimate/<token>` → customer-facing estimate (company, items, totals) → Accept → confirm → `accepted` on the server, "You accepted this estimate." | pass | `17-…20-public-estimate-*.png`, DB |
| 25 | `https://hausboss.app/reset-password?token=…&type=recovery` (token minted the same way the email does) → session exchanged → new password set → Today; sign-in with the new password works; token consumed | pass | `21-reset-password-link.png`, DB |
| 26 | `https://hausboss.app/job/<id>` → job hub | pass | `22-job-universal-link.png` |
| 27 | Unit tests for the link mapping (universal links, custom scheme, unknown hosts, dev-client URL) and the push tap routing | 6 passing | `lib/__tests__/deepLinks.test.ts`, `services/__tests__/push.test.ts` |
| 28 | First launch asks for notification permission (Android 13+); afterwards the device registration path runs and reports "no EAS project id" (this build has none) — in-app toasts keep working | pass (expected gap) | `01-push-permission-prompt.png`, `02-security-light.png` |
| 29 | `npm run mobile:check` (tsc, eslint, 33 unit tests) | clean | root |

Recordings are 540 px, 0.3–0.9 MB each (3-minute emulator capture limit per clip).

## Fixed while verifying

- **The foreground service never started on Android** — `startBackgroundTracking` skipped `startLocationUpdatesAsync`
  when the task was already registered, which survives a process kill while the service does not. It now always
  (re)starts (idempotent), so the "sharing location" notification returns after any relaunch.
- **No lock on cold start** — the session is restored after the provider mounts; the lock now engages when the restored
  session first appears (an interactive sign-in is not treated as a cold start).
- **Lock toggle stayed disabled after enrolling a PIN** — biometric availability is re-read when the app comes to the
  foreground and when the Security screen opens.
- **Android cannot blur without a `blurTarget`** (`expo-blur` warned and fell back to nothing) — the cover is an opaque
  wash on Android; iOS keeps the native blur.
- A queued photo no longer also toasts "attached to the job" (only the queue toast).
- `kysely-codegen` here produces a different layout than the committed `types.generated.ts`; the new table was added by
  hand to keep the diff to the one interface.
