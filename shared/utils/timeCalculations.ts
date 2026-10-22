import type { TimeEntry } from '@/types';

/**
 * Time tracking math (PROJECT_HANDOFF §14 "Time accrues until the job is
 * closed; live sessions count").
 *
 * - Entries are `{ type: 'start' | 'stop' | 'complete', timestamp }`.
 * - Paired start → stop/complete sessions are summed per LOCAL day.
 * - An unpaired trailing `start` adds live elapsed minutes and marks the job
 *   as currently active.
 * - Each entry is re-bucketed by the viewer's local date computed from its
 *   `timestamp`; any stored `date` field is ignored.
 */

export interface JobTimeSummary {
  totalMinutes: number;
  byDay: Record<string, number>;
  isCurrentlyActive: boolean;
  activeSince: string | null;
  sessions: TimeSession[];
}

export interface TimeSession {
  start: string;
  end: string | null;
  minutes: number;
  /** Local date (YYYY-MM-DD) of the session start. */
  date: string;
  isLive: boolean;
}

/** Local calendar date (YYYY-MM-DD) for an ISO instant, in the viewer's timezone. */
export function getLocalDateStr(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toMillis(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sort a copy of the entries chronologically; stops sort before starts at equal instants. */
export function sortTimeEntries(entries: readonly TimeEntry[]): TimeEntry[] {
  return entries
    .filter((e) => e && typeof e.timestamp === 'string' && !Number.isNaN(toMillis(e.timestamp)))
    .slice()
    .sort((a, b) => {
      const diff = toMillis(a.timestamp) - toMillis(b.timestamp);
      if (diff !== 0) return diff;
      return (a.type === 'start' ? 1 : 0) - (b.type === 'start' ? 1 : 0);
    });
}

export function calculateJobTotalTime(entries: readonly TimeEntry[] | null | undefined, now: Date = new Date()): JobTimeSummary {
  const summary: JobTimeSummary = { totalMinutes: 0, byDay: {}, isCurrentlyActive: false, activeSince: null, sessions: [] };
  if (!entries || entries.length === 0) return summary;

  const sorted = sortTimeEntries(entries);
  let open: TimeEntry | null = null;

  const addSession = (start: TimeEntry, endIso: string | null, isLive: boolean) => {
    const startMs = toMillis(start.timestamp);
    const endMs = endIso ? toMillis(endIso) : now.getTime();
    const minutes = endMs > startMs ? round2((endMs - startMs) / 60000) : 0;
    const date = getLocalDateStr(start.timestamp);
    summary.byDay[date] = round2((summary.byDay[date] ?? 0) + minutes);
    summary.totalMinutes = round2(summary.totalMinutes + minutes);
    summary.sessions.push({ start: start.timestamp, end: endIso, minutes, date, isLive });
  };

  for (const entry of sorted) {
    if (entry.type === 'start') {
      // A second start while one is open is ignored (the first one wins).
      if (!open) open = entry;
    } else if (open) {
      addSession(open, entry.timestamp, false);
      open = null;
    }
  }

  if (open) {
    summary.isCurrentlyActive = true;
    summary.activeSince = open.timestamp;
    addSession(open, null, true);
  }

  return summary;
}

/** "2h 05m" / "45m" / "0m" */
export function formatDuration(totalMinutes: number): string {
  const whole = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Live elapsed minutes for an active job (0 when not active). */
export function liveElapsedMinutes(entries: readonly TimeEntry[] | null | undefined, now: Date = new Date()): number {
  const s = calculateJobTotalTime(entries, now);
  if (!s.isCurrentlyActive || !s.activeSince) return 0;
  return round2(Math.max(0, now.getTime() - toMillis(s.activeSince)) / 60000);
}
