# HausBoss Mobile — build prompt

Copy everything below the line into the AI coding tool (Claude Code, Cursor, Lovable, etc.) or hand it to the mobile developer.

---

## Role and goal

You are a senior React Native engineer and motion designer. Build **HausBoss Mobile**, the native iOS + Android app for HausBoss (https://hausboss.app), a field-service job tracker for HVAC and trades companies. The app must feel like a premium native app: fast, fluid, rich purposeful animation at 60/120 fps, never janky, never a wrapped website.

The backend already exists and is in production. **Do not build a new backend.** The only backend addition needed is push notifications (see Native capabilities). The app talks to the existing HausBoss REST API + Socket.IO realtime server. The web app in this repo (`src/`) is the reference implementation for every screen, rule and API call.

## Tech stack (use exactly this unless there is a hard blocker)

- **Expo SDK (latest stable) + React Native New Architecture, TypeScript strict**, EAS Build / EAS Update.
- **Expo Router** (file-based, typed routes), native stack + bottom tabs.
- **@tanstack/react-query v5** for server state (same query keys and invalidation patterns as the web app); **zustand** for small UI state.
- **react-native-reanimated 3** (all animation on the UI thread), **react-native-gesture-handler**, **moti** for declarative enter/exit, **lottie-react-native** for illustrated moments, **@shopify/react-native-skia** only where a custom drawn effect is needed (map pulse, progress rings).
- **@shopify/flash-list** for every list; **expo-image** for photos (blurhash placeholders).
- **@gorhom/bottom-sheet** for sheets; **react-native-maps** (Google provider on both platforms).
- **expo-secure-store** for tokens, **react-native-mmkv** for cache + offline queue.
- **expo-location** + **expo-task-manager** (background location), **expo-notifications** (push), **expo-camera / expo-image-picker** (job media), **expo-haptics**, **expo-local-authentication** (Face ID / fingerprint unlock).
- **socket.io-client** for realtime, **zod** for validating API responses, **date-fns** for dates.
- Fonts: **Inter** via expo-font.

## Backend contract (existing, do not change)

- Base URL from env: `EXPO_PUBLIC_API_URL` (production `https://hausboss.app`, which proxies `/api`, `/realtime`, `/storage`). Dev: the local API on port 3105.
- Full endpoint reference: `docs/API.md`. Mirror the web services in `src/services/*.ts` and `src/api/client.ts` one-to-one (auth, jobs, customers, estimates, catalog, inventory, team, messages/chat, sms, notifications, locations, media, billing read-only, requests/leads, activity).
- **Auth:** email + password login returns an access token and a `refresh_token`. Store both in SecureStore; refresh on 401 exactly like `refreshSession` in `src/api/client.ts` (single in-flight refresh, retry the original request once). Offer biometric unlock after the first login.
- **Types:** port `src/types/index.ts` as the shared model (Job, Customer, Employee, Estimate, CatalogItem, UserLocation, BusinessUnit, Division, etc.). Keep field names identical.
- **Realtime:** connect Socket.IO to `REALTIME_URL` with the access token; on job / message / notification events invalidate the matching React Query keys (see `src/api/realtime.ts`).
- **Job status flow:** `pending → accepted → en-route → arrived → in-progress → completed`. Use the same rules as `src/utils/jobStatus.ts` and `JobStatusStepper`.

## Users and roles

| Role (API) | Shown as | Gets |
|---|---|---|
| `admin` | Owner | Everything, including Team, Billing view, Settings |
| `manager` | Manager | Dispatch: calendar, dashboard/map, jobs, customers, estimates, messages, leads |
| `contractor` | Technician | Own jobs only: today's queue, job workflow, timer, media, chat, notes |

Owners and managers can also be assigned jobs. Gate every screen and action by role the same way the web app does (`useAuth().isStaff`, `hasRole`).

## Screens

**Auth:** splash (see *Splash screen and app launch*) → login → forgot password → accept invite (deep link `hausboss://accept-invite?token=`), pending-approval screen, biometric unlock.

**Bottom tabs (staff):** Calendar · Dashboard · Chat · Messages · More.
**Bottom tabs (technician):** Today · Calendar · Chat · Messages · More.

1. **Today (technician home):** greeting header, the next job as a hero card (customer, address, arrival window, big status action button), remaining jobs below, clock-in/out timer pill.
2. **Calendar:** day / week / list views with swipe between days, time-grid blocks coloured per employee (`getContractorColor`), filter "All Employees" (technicians first, then owners/managers labelled "(Owner)" / "(Manager)"), drag a block to reschedule (staff only).
3. **Dashboard (staff):** KPI tiles (open jobs, in progress, completed today, employees located), live map of jobs + employee trucks, **Employees** roster (dot, name · role, "N open jobs · seen X ago"). Tapping a truck, an assignee or a roster row opens the **Employee sheet**: contact (tap to call / email), last location with "Open in Maps", open jobs each with **Reassign**.
4. **Job details:** header with customer and status, the status stepper, tabs: Details · Time · Media · Chat · Estimates · Activity · Notes. Actions: call / text customer, navigate (Apple / Google Maps), "On my way" SMS, status advance, clock in / out, add photos / video, clone job, reassign, schedule.
5. **New job / edit job:** multi-step form (customer search or create with Google Places address, business unit → sets service type, category and length, date + arrival window, assignee, description). Same validation as `JobCreationForm`.
6. **Customers:** searchable list, customer detail with job history, add / edit.
7. **Estimates:** list, editor with catalog picker and line items, send link, status.
8. **Chat (team, per job) and Messages (customer SMS inbox):** threads with unread badges, composer, attachments.
9. **Global search:** jobs and customers.
10. **More:** Products & services, Truck stock, Job categories, Team, Leads, Notifications settings, Appearance (light / dark / system), Billing (read-only status; purchases happen on the web), Sign out.

Everything shown on the web must be visible on mobile. No truncated job info: names, addresses and descriptions wrap; long content expands.

## Motion and animation system (the core of this brief)

Build a small motion system first (`src/motion/`), then use only it. No ad-hoc timing values in screens.

**Tokens**
- Durations: `instant 100ms`, `fast 180ms`, `base 260ms`, `slow 400ms`, `hero 600ms`.
- Easing: `standard Easing.bezier(0.2, 0, 0, 1)`, `exit Easing.bezier(0.4, 0, 1, 1)`.
- Springs: `snappy {damping: 20, stiffness: 300}`, `gentle {damping: 18, stiffness: 160}`, `bouncy {damping: 12, stiffness: 180}`.
- Stagger: 40ms per list item, capped at 8 items (later items appear with no delay).

**Global patterns**
- **Press feedback:** every tappable scales to 0.97 with `snappy` spring + light haptic; release springs back.
- **Shared element transitions:** job card → job details (card background, customer name and status badge morph into the details header); employee avatar → employee sheet; photo thumbnail → full-screen viewer (pinch / double-tap zoom, swipe down to dismiss with background fade tied to drag distance).
- **List entrance:** items fade up 12px with stagger on first load only, not on every refetch. Layout animations (`LinearTransition`) when items are inserted, removed or reordered (e.g. a reassigned job leaving a queue slides out and the list closes the gap).
- **Swipe actions on job rows:** swipe right = advance status (green reveal with icon that scales in at threshold + haptic), swipe left = reassign / call. Rubber-band past the threshold.
- **Pull to refresh:** custom header — the HausBoss house logo draws its outline (Skia path) as you pull, then spins while loading.
- **Bottom sheets:** spring open with backdrop blur; snap points; drag to dismiss.
- **Tab bar:** animated active pill that slides between tabs; icon bounces on select; unread badge pops in with `bouncy`.
- **Skeletons:** shimmer placeholders matching the final layout for every loading state (no spinners on main screens).
- **Number changes:** KPI tiles and timers roll digits (animated text) instead of jumping.
- **Toasts / in-app notifications:** slide down from the top with spring, swipe up to dismiss, auto-hide with a progress bar.

**Signature moments**
- **Status stepper:** advancing a status fills the connector with a gradient sweep, the next node pops (`bouncy`), success haptic; "Completed" triggers a short Lottie confetti burst on the job header.
- **Clock in / out timer:** circular progress ring (Skia) with a soft breathing glow while running.
- **Live map:** employee trucks glide between location updates (interpolate position and heading over 1s, no teleport), a pulsing ring under recently-updated trucks, job pins drop in with a bounce, cluster expand animation on zoom.
- **"On my way":** the sent confirmation animates a small truck along a dotted path.
- **Empty states:** lightweight Lottie illustrations (no jobs today, inbox zero, no results).
- **Login:** logo reveal + form fields fade up in sequence; shake on wrong password with error haptic.

**Rules**
- All animations run on the UI thread (Reanimated worklets); never animate with `setState` or the JS-driven `Animated` API.
- Respect **Reduce Motion** (`useReducedMotion`): replace movement with simple fades, skip confetti and parallax.
- Animations must never block input; any animation longer than 400ms must be interruptible.
- Target 60 fps on a mid-range Android (e.g. Pixel 6a) and 120 fps on ProMotion iPhones; profile with the Perf Monitor and Flashlight before shipping each screen.

## Look and feel

- Brand tokens from the web app (`src/index.css`): navy primary `#0b1f4a`, brand blue accent `#1a5cff`, background `hsl(210 40% 98%)`, success / warning / destructive, radius 8, Inter. Status colours identical to the web status badges.
- Full light and dark themes, following the system setting by default.
- Respect safe areas, notches and the Android navigation bar; support Dynamic Type / font scaling without clipping; minimum 44×44pt touch targets.
- Portrait-first on phones; tablets get a two-pane layout (list + details) on Calendar, Dashboard and Messages.

## Splash screen and app launch

The launch is the first impression; treat it as a feature with its own acceptance criteria. Two layers: a **native splash** (shown by the OS before JS runs) and an **animated splash** (Reanimated + Skia) that takes over seamlessly and hands off into the first screen.

**1. Native splash (expo-splash-screen config plugin)**
- Brand assets come from the web app: `public/icon.svg` (house mark) and `public/hausboss-logo.png` (wordmark). Export a clean vector house mark and wordmark; do not upscale the PNG.
- Background: navy `#0b1f4a` in light and dark (one consistent brand moment); the white house mark centred.
- **Android 12+** uses the system SplashScreen API: it shows only a centred icon on a solid colour, and the icon is masked to a circle. Provide a 1152×1152 px (288 dp) icon whose artwork sits inside the central 768 px (192 dp) safe circle, so nothing gets clipped. Set `windowSplashScreenBackground`, and make sure there is no white flash and no double splash on Android 11 and below.
- **iOS:** a storyboard launch screen with the same colour and the logo in exactly the same size and position. No launch PNGs per device.
- Call `SplashScreen.preventAutoHideAsync()` at module scope in the root layout, so the native splash stays up until the app is ready.

**2. What happens while the native splash is visible (boot sequence)**
Run these in parallel, each with its own timeout, so launch can never hang:
- load the Inter fonts and the icon font;
- read the tokens from SecureStore and the cached session and React Query cache from MMKV;
- decide the first route: login, pending approval, technician Today, or staff Calendar. Do this from the cached session, then refresh the token in the background. If the token is expired and the device is offline, still open the cached app in offline mode rather than the login screen;
- read the cold-start deep link or push payload, so the first screen is the target job or thread;
- check for an EAS Update in the background only. Never block launch on the network; apply the update on the next launch.

Hard limit: hide the native splash within **1.5 s** of process start whatever happens. On a boot error, show a branded error state with Retry, never a blank screen.

**3. Animated splash (cold start only)**
- The first frame is pixel-identical to the native splash: same colour, and the logo in the same size and position, measured with safe-area insets. The swap must be invisible: hide the native splash only after the animated view's first frame has laid out (`onLayout`).
- Sequence (total ≤ 900 ms, all on the UI thread):
  - 0–350 ms: the house outline draws itself (Skia path trim) and the roof settles with a `gentle` spring;
  - 250–600 ms: the "hausboss" wordmark reveals left to right (mask) with a slight upward fade;
  - 600–900 ms: hand-off. The logo shrinks and flies into its spot in the destination screen's header (shared-element style), while a circular reveal expands from the logo to show the first screen underneath. The navy background fades to the theme background, and the status bar style switches with it.
- The first screen's data comes from the cache, so it is already populated when revealed, with skeletons only for anything missing. No spinner after the splash.
- **Warm start / resume from background:** no splash animation. If the session is locked behind biometrics, show a quick blurred privacy cover with the Face ID / fingerprint prompt.
- **Reduce Motion:** replace the sequence with a 200 ms crossfade.
- **Haptic:** one soft impact at the moment of the reveal (skip it if Reduce Motion is on).
- Tapping during the animation skips straight to the end state.

**4. App icon set**
- iOS: 1024 px icon, plus the iOS 18 dark and tinted variants.
- Android: an adaptive icon (foreground with the house mark in a 66 dp safe zone, navy background), and a **monochrome layer** for Android 13 themed icons.
- Notification small icon: a white-only silhouette, because Android tints it.

**5. Acceptance criteria**
- Cold start until the first screen is interactive: **< 2.0 s** on a mid-range Android (Pixel 6a class) and **< 1.2 s** on a recent iPhone, measured on release builds, with the numbers reported.
- No white or black flash, no layout jump between the native and animated splash, and no double splash on any Android version from 8 to 15.
- It works offline, with an expired token, from a push tap, from a universal link, in dark mode, at the largest font size and in landscape on tablets.
- Record each case on real devices and attach the recordings to the phase report.

## Native capabilities

- **Background location (technicians only):** report position every 2 minutes while clocked in or on an active job (same cadence as `src/hooks/useLocationTracking.ts`), low-accuracy mode for battery, stop when clocked out. Clear permission explainer screens before the OS prompt.
- **Push notifications:** new job assigned, job reassigned, status changes, chat and SMS messages; tapping opens the exact job / thread (deep links). **The API has no push support yet:** today notifications are in-app (Socket.IO + the notifications endpoints). Add a small NestJS module to the existing server: a `device_tokens` table (user, company, Expo push token, platform), `POST/DELETE /api/notifications/devices`, and send via the Expo Push API wherever the server already creates an in-app notification. Write it as a migration + module in the same style as the other server modules, with tests.
- **Offline:** cache the last data with React Query persistence (MMKV). Queue status changes, notes, time entries and photo uploads while offline and replay them in order when back online (port `src/services/offlineQueue.ts`); show an animated offline banner.
- **Media:** camera capture and gallery pick, compress before upload, upload progress rings on thumbnails, retry on failure.
- **Deep links / universal links:** `hausboss.app/estimate/:token`, accept-invite, reset-password, job and thread links from push.

## Quality bar

- TypeScript strict, ESLint + Prettier, no `any` in app code.
- Unit tests (Jest + React Native Testing Library) for services, role gating, status rules and the offline queue; E2E (Maestro) for: login, technician completes a job end-to-end, dispatcher reassigns a job from the employee sheet, offline status change syncs after reconnect.
- Accessibility: every control labelled, screen reader order correct, contrast AA in both themes.
- Crash and performance monitoring (Sentry), no PII in logs.
- App icons (including Android themed / monochrome and iOS dark / tinted variants) and store screenshots in the HausBoss brand; splash meets its acceptance criteria.

## Delivery plan

1. **Foundation:** Expo project, native + animated splash with the boot sequence, app icons, theme + motion system, API client with auth / refresh, types, React Query, realtime, navigation shell with the animated tab bar. Demo the motion playground screen.
2. **Technician flow:** Today, job details, status stepper, timer, media, chat, background location, push.
3. **Dispatcher flow:** Calendar, Dashboard + live map + employee sheet + reassign, new / edit job, customers.
4. **Estimates, Messages (SMS), search, More / settings screens.**
5. **Offline, polish, accessibility, performance pass, store builds (TestFlight + Play internal testing).**

At the end of each phase: list what was built, record a short screen capture of the animations on a real device, and list any API gaps found (do not invent endpoints; ask).

## Test accounts (local / staging only)

Use the accounts provided separately by the HausBoss team (owner, manager, technician). Never hard-code credentials or API keys in the app; keys come from EAS secrets / env.
