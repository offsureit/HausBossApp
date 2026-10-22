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
