import type { JobStatus } from '@/types';

/**
 * Job status constants (PROJECT_HANDOFF §13/§15). The values are hyphenated,
 * lowercase and double as CSS class suffixes (`status-en-route`), so they must
 * never change.
 */

export const JOB_STATUSES: readonly JobStatus[] = ['pending', 'accepted', 'en-route', 'arrived', 'in-progress', 'completed'];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  'en-route': 'On My Way',
  arrived: 'At Job Site',
  'in-progress': 'In Progress',
  completed: 'Completed',
};

/** Linear technician flow (§8.4). */
const NEXT: Record<JobStatus, JobStatus | null> = {
  pending: 'accepted',
  accepted: 'en-route',
  'en-route': 'arrived',
  arrived: 'in-progress',
  'in-progress': 'completed',
  completed: null,
};

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value);
}

/** Unknown/legacy strings fall back to `pending` so the UI always has a badge to render. */
export function normalizeJobStatus(value: unknown): JobStatus {
  return isJobStatus(value) ? value : 'pending';
}

export function jobStatusLabel(status: string): string {
  return isJobStatus(status) ? JOB_STATUS_LABELS[status] : status;
}

export function nextStatus(current: JobStatus): JobStatus | null {
  return NEXT[current];
}

/**
 * Technicians move one step forward at a time; staff (admin/manager/superadmin)
 * may set any status. Setting the same status is always a no-op transition.
 */
export function isValidTransition(from: JobStatus, to: JobStatus, options: { isStaff?: boolean } = {}): boolean {
  if (!isJobStatus(from) || !isJobStatus(to)) return false;
  if (from === to) return true;
  if (options.isStaff) return true;
  return NEXT[from] === to;
}

/** Yellow marker with a red border on the map (§14 "Overdue job map styling"). */
export function isOverdue(job: { status: string; scheduledDate?: string | null; scheduled_date?: string | null }, now: Date = new Date()): boolean {
  if (job.status !== 'pending') return false;
  const raw = job.scheduledDate ?? job.scheduled_date ?? '';
  if (!raw) return false;
  const t = new Date(raw).getTime();
  return !Number.isNaN(t) && t < now.getTime();
}

export function isClosedStatus(status: string): boolean {
  return status === 'completed';
}
