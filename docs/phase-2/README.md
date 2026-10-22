# Phase 2 verification — 2026-10-21

Build: `mobile/` dev client rebuilt for Phase 2 (`expo prebuild` + `gradlew assembleDebug`; adds react-native-maps,
expo-location, expo-image-picker, expo-file-system, datetimepicker) on the Android 16 emulator (Pixel 8, API 36,
`hausboss_dev` AVD) against the local API (`http://10.0.2.2:3105`, seeded data, emulator GPS fixed to downtown Austin).
**Not yet run on a real phone** — that step is the HausBoss team's (see `docs/MOBILE_APP_PLAN.md`, open items).

The emulator build has no Google Maps SDK key, so the Dashboard shows the "Map not configured" fallback; everything
around it (roster, employee sheet, locations, reassign, job lists) runs against the live API.

## Technician flow (Tom Tech) — `phase2-tech-emulator.mp4` (first 3 min) + screenshots

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Today hero shows the next job with the big primary action for its status (Pending → **Accept**) | pass | `17-tech-today-accept.png` |
| 2 | Accept → `PATCH /jobs/:id` status `accepted`; hero flips to **On My Way** | pass | recording |
| 3 | On My Way: foreground location permission asked first, sheet shows the customer, address, straight-line distance / ETA from the GPS fix (`0.0 mi · about 1 min`) | pass | `18-on-my-way-sheet.png` |
| 4 | Confirm → status `en-route`, "Sharing location" pill, technician GPS written to `PUT /locations/me` (confirmed with `GET /locations`) | pass | `19-tech-en-route.png` |
| 5 | At Job Site → `arrived`; Clock In → Pre-Job photo prompt (Take photo / Choose / Skip) | pass | `20-clock-in-photo-prompt.png` |
| 6 | Camera permission (OS dialog) → emulator camera → confirm → `POST /media/upload` → "1 photo attached" | pass | `21-camera-permission.png`, `22-photo-attached.png` |
| 7 | Continue → `time_entries` `start` appended in `metadata`, status `in-progress`, live timer on the card and Time tab | pass | `23-in-progress-timer.png`, `25-time-tab.png` |
| 8 | Media tab groups the upload under Pre-Job and renders the thumbnail from storage | pass | `24-media-tab.png` |
| 9 | Complete → Post-Job photo prompt → Skip → Completion notes → "Complete job" → `complete` entry with notes, status `completed`, toast, card moves to Completed | pass | `26-post-job-prompt.png`, `27-completion-notes.png`, `28-completed.png` |
| 10 | Server state after the flow: `status=completed`, `metadata.notes`, two time entries, one `pre` media item (checked with `GET /jobs/:id`) | pass | API |

## Staff flow (Alice Owner) — `phase2-owner-emulator.mp4`, `phase2-owner-2-emulator.mp4` + screenshots

| # | Check | Result | Evidence |
|---|---|---|---|
| 11 | Calendar day view: 24-hour timeline, now-line, job block with status colour, assignee | pass | `01-owner-calendar-day.png` |
| 12 | Swipe left / right pages to the next / previous day; "Today" jumps back; Filters sheet (employee "All Employees", status, jump to date) | pass | `02-calendar-swipe-next.png`, recording |
| 13 | Dashboard KPIs (jobs today, in progress, completed today, employees located), employee + status filters, "Check locations" ping | pass | `03-dashboard.png` |
| 14 | Roster → Employee sheet: phone / email, last location reverse-geocoded ("500 Congress Avenue, Austin, Texas"), Open in Maps, open jobs with Reassign | pass | `04-dashboard-roster.png`, `05-employee-sheet.png` |
| 15 | Reassign sheet → `PATCH /jobs/:id` assignee → toast, roster counts update live | pass | `06-reassign-sheet.png`, `07-reassigned-toast.png` |
| 16 | Job details (staff): header, Call / Text / Navigate / Email, animated status stepper, Details / Time / Media / Chat / Estimates / Activity / Notes tabs, inline editor (technician, date, time, priority, category) | pass | `08-job-details-staff.png`, `30-job-dark.png` |
| 17 | Stepper tap Pending → Accepted (`PATCH` + realtime echo) | pass | `09-job-stepper-accepted.png` |
| 18 | Chat: send a message (`POST /jobs/:id/messages`), bubble colours per sender, realtime insert | pass | `10-job-chat.png` |
| 19 | Activity feed (`GET /jobs/:id/activity`) with diffs and actor names; Estimates empty state | pass | `11-job-activity.png`, `12-job-estimates-empty.png` |
| 20 | New job, step 1 Customer: shared `jobFormSchema` validation, title / phone / email type selects, existing-customer picker, "Save customer only" | pass | `13-new-job-customer.png` |
| 21 | Step 2 Job: details, important details, service type, category picker (add new), priority, job length | pass | `14-new-job-job.png` |
| 22 | Step 3 Schedule: technician picker, native date + time pickers (15-min steps, arrival window), attachments, summary | pass | `15-new-job-schedule.png` |
| 23 | Create job → customer + job created on the server (`POST /customers`, `POST /jobs`), opens the new job | pass | `16-new-job-created.png`, API (`b712fab7…`) |
| 24 | Dark mode across Dashboard and Job details | pass | `29-dashboard-dark.png`, `30-job-dark.png` |
| 25 | Deep link `hausboss://job/<id>` opens the job hub directly | pass | recording |
| 26 | Unit tests, `tsc --noEmit`, ESLint | 16 passing / clean | `npm run mobile:check` |

Recordings are 540 px, ~1 MB each (3-minute emulator capture limit per clip).

## Fixed while verifying

- **Uploads failed with "Could not reach the server"** — Expo SDK 58 installs its own WinterCG `fetch`, which rejects React
  Native's legacy `{ uri, name, type }` form parts (`Unsupported FormDataPart implementation`). `src/services/media.ts`
  now sends a Blob-like part backed by `expo-file-system`'s `File.bytes()`.
- **Thumbnails blank on the emulator** — the local server's `STORAGE_PUBLIC_URL` is `http://localhost:3105`, unreachable
  from a device. `resolveMediaUrl()` (`src/lib/env.ts`) rebuilds loopback URLs from the storage path against `API_URL`;
  production URLs (`https://hausboss.app/storage/…`) pass through untouched.
- **GPS tag missing on photos / periodic reports skipped** when the emulator's fix took longer than the timeout — location
  reads now fall back to the OS's last known position (≤ 2 min old).
- Clock sheets no longer flip their title while animating closed.
