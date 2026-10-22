/**
 * Pure layout math for the 24-hour time grid — kept out of the React tree so it
 * can be unit-tested and memoised.
 */
import { addDays, differenceInMinutes, startOfDay } from 'date-fns';
import { getLocalDateStr } from '@/utils/timeCalculations';
import type { Job } from '@/types';

export const MINUTES_PER_DAY = 24 * 60;
export const SNAP_MINUTES = 15;          // §15 scheduling increments
export const DEFAULT_BLOCK_MINUTES = 120; // §15 standard 2-hour arrival window

/** A job's length on the calendar: its own (set by its business unit or on the job), else 2 hours. */
export function jobMinutes(job: Pick<Job, 'durationMinutes'>, fallback = DEFAULT_BLOCK_MINUTES): number {
  return typeof job.durationMinutes === 'number' && job.durationMinutes > 0 ? job.durationMinutes : fallback;
}

/** "2 h", "1 h 30 min", "45 min". */
export function formatLength(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
}

/** Job lengths offered in forms: 30 min … 4 h in 30-minute steps, then 5–8 h, a full day. */
export const LENGTH_OPTIONS: number[] = [30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600];

export interface PositionedJob {
  job: Job;
  /** Minutes from local midnight. */
  startMinutes: number;
  endMinutes: number;
  /** 0-based column within an overlap cluster. */
  column: number;
  /** Number of columns in the cluster. */
  columns: number;
}

/** Round minutes to the nearest 15-minute slot. */
export function snapToSlot(minutes: number, slot = SNAP_MINUTES): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes / slot) * slot));
}

/** Minutes from the viewer's local midnight for an ISO instant. */
export function minutesFromMidnight(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return differenceInMinutes(d, startOfDay(d));
}

/** Local-date key (viewer timezone) or null when unscheduled — §13 timestamps. */
export function jobLocalDay(job: Pick<Job, 'scheduledDate'>): string | null {
  if (!job.scheduledDate) return null;
  const t = new Date(job.scheduledDate).getTime();
  return Number.isNaN(t) ? null : getLocalDateStr(job.scheduledDate);
}

/** Jobs grouped by local day; unscheduled ones under `unscheduled`. */
export function bucketJobsByLocalDay(jobs: readonly Job[]): { byDay: Map<string, Job[]>; unscheduled: Job[] } {
  const byDay = new Map<string, Job[]>();
  const unscheduled: Job[] = [];
  for (const job of jobs) {
    const key = jobLocalDay(job);
    if (!key) { unscheduled.push(job); continue; }
    const list = byDay.get(key) ?? [];
    list.push(job);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  return { byDay, unscheduled };
}

/**
 * Assign overlapping jobs to side-by-side columns. Jobs are clustered when their
 * [start,end) intervals touch transitively; each cluster shares the width.
 */
export function layoutDay(jobs: readonly Job[], blockMinutes = DEFAULT_BLOCK_MINUTES): PositionedJob[] {
  // blockMinutes = length of jobs without their own (durationMinutes).
  const items = jobs
    .filter((j) => !!j.scheduledDate)
    .map((job) => {
      const start = minutesFromMidnight(job.scheduledDate);
      return { job, startMinutes: start, endMinutes: Math.min(MINUTES_PER_DAY, start + jobMinutes(job, blockMinutes)) };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || a.job.clientName.localeCompare(b.job.clientName));

  const out: PositionedJob[] = [];
  let cluster: { startMinutes: number; endMinutes: number; job: Job }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const placed = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.startMinutes);
      if (column === -1) { column = columnEnds.length; columnEnds.push(item.endMinutes); } else { columnEnds[column] = item.endMinutes; }
      return { ...item, column };
    });
    const columns = columnEnds.length;
    placed.forEach((p) => out.push({ ...p, columns }));
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  flush();
  return out;
}

/** Days shown for a view, starting at `anchor` (local). */
export function visibleDays(anchor: Date, view: 'day' | '3day' | 'week'): Date[] {
  const count = view === 'day' ? 1 : view === '3day' ? 3 : 7;
  const start = view === 'week' ? addDays(startOfDay(anchor), -((anchor.getDay() + 6) % 7)) : startOfDay(anchor); // week starts Monday
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Format minutes-from-midnight as h:mm a. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${suffix}`;
}

/** Build the 15-minute time options for a select (00:00 … 23:45). */
export function timeSlotOptions(step = SNAP_MINUTES): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let m = 0; m < MINUTES_PER_DAY; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push({ value: `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`, label: formatMinutes(m) });
  }
  return out;
}

/** Combine a yyyy-MM-dd date and HH:mm time (local) into an ISO instant. */
export function combineLocalDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  const local = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

/** Arrival window label, e.g. "9:00 AM – 11:00 AM". */
export function arrivalWindow(startMinutes: number, blockMinutes = DEFAULT_BLOCK_MINUTES): string {
  return `${formatMinutes(startMinutes)} – ${formatMinutes(Math.min(MINUTES_PER_DAY - 1, startMinutes + blockMinutes))}`;
}
