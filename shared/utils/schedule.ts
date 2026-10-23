import { format } from 'date-fns';

/** The standard arrival window when a job has no explicit length (§15). */
export const ARRIVAL_WINDOW_HOURS = 2;

/** Round to the nearest 15 minutes for the schedule input (§15). */
export function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** "Tue, Mar 4 · 9:00 AM – 11:00 AM" (the job length, else the standard window) or "Unscheduled". */
export function scheduleWindow(iso: string, minutes?: number | null): string {
  if (!iso) return 'Unscheduled';
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 'Unscheduled';
  const end = new Date(start.getTime() + (minutes && minutes > 0 ? minutes : ARRIVAL_WINDOW_HOURS * 60) * 60 * 1000);
  return `${format(start, 'EEE, MMM d')} · ${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
}

/** Statuses where the technician has not reached the customer yet. */
const NOT_ARRIVED = new Set(['pending', 'accepted', 'en-route']);

/**
 * The arrival window has ended and the technician has not arrived (pending, accepted or on the way):
 * the customer is waiting. Returns when the window ended, or null when the job is on time.
 */
export function runningLate(job: { status: string; scheduledDate?: string | null; durationMinutes?: number | null }, now: Date = new Date()): Date | null {
  if (!NOT_ARRIVED.has(job.status) || !job.scheduledDate) return null;
  const start = new Date(job.scheduledDate).getTime();
  if (Number.isNaN(start)) return null;
  const end = start + (job.durationMinutes && job.durationMinutes > 0 ? job.durationMinutes : ARRIVAL_WINDOW_HOURS * 60) * 60_000;
  return end < now.getTime() ? new Date(end) : null;
}

/** "Late · window ended 3:00 PM": adds the weekday when it ended earlier this week, the date when longer ago. */
export function lateLabel(windowEnd: Date, now: Date = new Date()): string {
  const sameDay = windowEnd.toDateString() === now.toDateString();
  const withinWeek = now.getTime() - windowEnd.getTime() < 6 * 24 * 60 * 60_000;
  return `Late · window ended ${format(windowEnd, sameDay ? 'h:mm a' : withinWeek ? 'EEE h:mm a' : 'MMM d, h:mm a')}`;
}
