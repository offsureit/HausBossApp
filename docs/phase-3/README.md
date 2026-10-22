# Phase 3 verification — 2026-10-21

Build: the Phase 2 dev client (no new native modules in this phase) on the Android 16 emulator (Pixel 8, API 36,
`hausboss_dev` AVD) against the local API (`http://10.0.2.2:3105`, seeded data). **Not yet run on a real phone** —
that step is the HausBoss team's (see `docs/MOBILE_APP_PLAN.md`, open items).

Test data added for the run: an SMS conversation with three messages (inserted directly in the local database because
the emulator cannot receive a Telnyx webhook), a public lead request, a truck-stock item, an equipment record.

## Staff (Alice Owner) — `phase3-owner-emulator.mp4`, `phase3-owner-2-emulator.mp4`, `phase3-owner-3-emulator.mp4`

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Animated tab bar: sliding pill, icon pop on the active tab, unread badges (Messages = open texts, Chat = unread job threads, More = other notifications) | pass | `01-animated-tab-bar.png`, recording |
| 2 | More: Search, Notifications (badge), Customers, Leads, Products & services, Truck stock, Job categories, Team, Billing, appearance, connection, sign out | pass | `02-more.png` |
| 3 | Customers list (`GET /customers`), search, "show inactive", "+" → new customer form (shared job-form contact rules) | pass | `03-customers.png` |
| 4 | Customer detail: call / email / navigate / new job, Details (contact, billing, business unit, notes, SMS consent + Text customer / Opt out), Jobs, Equipment, Agreements tabs; edit from the header | pass | `04-customer-detail.png`, `05-customer-jobs.png` |
| 5 | Add equipment → `POST /customers/:id/equipment` → appears in the list | pass | `06-equipment-form.png`, `07-equipment-added.png` |
| 6 | SMS inbox: Open / Resolved / All, search, rows with unread badge, preview, assignment / opted-out / resolved chips; tab badge counts open unread | pass | `08-sms-inbox.png` |
| 7 | SMS thread: bubbles with delivery status, header with phone / active job, opening marks it read (`POST /conversations/:id/read`), assign → Mandy, Resolve / Reopen | pass | `09-sms-thread.png`, `10-sms-assigned.png`, `11-sms-resolved.png` |
| 8 | Composer: send goes to `POST /conversations/:id/messages` (the local server has no Telnyx number, so the server answers 409 and the app shows the error; the full send path was verified on the web earlier) | pass (expected 409 locally) | recording |
| 9 | Team chat list: one row per job, unread-first ordering, filter; thread screen full-screen with attachments, opening marks chat notifications read | pass | `12-team-chat-list.png` |
| 10 | Leads: pending / all, schedule sheet (date, 15-min time, technician, notes) → `POST /requests/:id/schedule` → job created and opened; reject with confirmation | pass | `13-leads.png`, `14-lead-schedule.png` |
| 11 | Estimates tab: "New estimate" → editor prefilled from the job (title, client, address) | pass | `15-estimates-tab.png`, `16-estimate-editor.png` |
| 12 | Catalog picker: company price book + built-in HVAC list, All / Parts / Services, search → line added | pass | `17-catalog-picker.png` |
| 13 | Line items: edit name / qty / unit / price, reorder, remove; live totals match the database formula (parts 165 + services 240, tax 8.25 % = 33.41, total 438.41) | pass | `18-estimate-totals.png` |
| 14 | Save & approve → `POST /estimates` + `/approve` → EST-0001 approved (server total 438.41); Send to client → `sent`, read-only, public link + Share | pass | `19-estimate-approved.png`, `20-estimate-sent.png`, API |
| 15 | Swipe actions on job rows: swipe left reveals Reassign (staff) / Call (technician), swipe right reveals the next status; haptic at the threshold | pass after fix (see below) | `22-swipe-left-call.png`, recording |
| 16 | Notifications screen: newest 50, unread dot, tap opens the job (chat tab for chat messages), Mark all read, device prefs (haptic, toasts) persisted | pass | `23-notifications.png` |
| 17 | Search (modal): jobs + customers, shared `searchInMemory`, rows open the job / customer | pass | `24-search.png` |
| 18 | Products & services (CRUD + active toggle), Truck stock (per technician, ± quantity, below-minimum banner), Job categories (add / rename / reorder / toggle / delete), Team (roster, invite sheet, role / deactivate with seat prompts), Billing (read-only plan + seats, link to the web) | pass | `25-settings-screens.png` |
| 19 | Unit tests, `tsc --noEmit`, ESLint | 20 passing / clean | `npm run mobile:check` |
| 20 | Web app after the shared-util extraction (`utils/phone.ts`, `utils/search.ts`) | 262 tests, typecheck, lint pass | `npm run check` (web parts) |

## Technician (Tom Tech) — `phase3-tech-emulator.mp4`

| # | Check | Result | Evidence |
|---|---|---|---|
| 21 | Realtime notification toast ("Job updated — rescheduled") with an Open action; Today hero updates live | pass | `26-realtime-toast.png` |
| 22 | On My Way: ETA, confirm → status `en-route` → the sheet shows the truck driving to the pin, then closes | pass | `27-on-my-way-eta.png`, recording |
| 23 | Clock In → Time tab shows the progress ring with the breathing glow while clocked in | pass | `28-timer-ring.png` |
| 24 | Complete → confetti burst on the job header after the notes sheet closes; status Completed, time entries recorded | pass | `29-confetti-frames.png`, `30-completed-time-tab.png` |
| 25 | Swipe left on a job row (technician) → Call opens the dialer | pass | `22-swipe-left-call.png` |

Recordings are 540 px, ~1 MB each (3-minute emulator capture limit per clip).

## Fixed while verifying

- **Lead scheduling opened an empty route** — the server answers `{ job, request }` but both apps mapped the body as a
  bare job row, so the new job's id was undefined. Fixed in `mobile/src/services/leads.ts` and the web
  `jobsService.scheduleLead` (same bug on the web).
- **Swipe actions fired on the wrong side** — react-native-gesture-handler reports the direction the row *moved*
  (`'right'` when the left pane shows), and both action containers absolute-fill the row, so the panes need an explicit
  width (`21-swipe-reveal-before-fix.png` shows the full-width pane). `SwipeableJobRow` now maps directions correctly
  and sizes the pane to the revealed width.
- **On My Way sheet closed before the truck animation** — the caller closed the sheet on success; the sheet now owns
  the "sent" step and closes itself when the truck arrives (callers return `false` on failure to stay on the confirm step).
- **Confetti was hidden behind the notes sheet** — the burst now waits for the clock sheets to close.
- Date-only columns (equipment / agreements) come back as ISO timestamps; they are rendered as calendar days.
