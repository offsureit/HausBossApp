import { isBefore, isSameDay, startOfDay } from 'date-fns';
import { matchesAssignedName } from '@/utils/names';
import type { Job } from '@/types';

export interface TechnicianJobGroups {
  /** Overdue + today's jobs, earliest first (unscheduled count as today). */
  today: Job[];
  upcoming: Job[];
  /** Latest first. */
  completed: Job[];
}

/** The technician's own jobs (by id, or by display name for legacy rows) — same rule as the web `isMine`. */
export function isMine(job: Pick<Job, 'assignedUserId' | 'assignedTo'>, me: { id: string; firstName?: string | null; lastName?: string | null } | null): boolean {
  if (!me) return true; // RLS already scoped the list
  return job.assignedUserId === me.id || (!job.assignedUserId && matchesAssignedName(job.assignedTo, me));
}

/** Today / upcoming / completed buckets, exactly as the web `ContractorDashboard` groups them. */
export function groupTechnicianJobs(jobs: readonly Job[], now: Date = new Date()): TechnicianJobGroups {
  const todayStart = startOfDay(now);
  const today: Job[] = [];
  const upcoming: Job[] = [];
  const completed: Job[] = [];
  const overdue: Job[] = [];
  for (const j of jobs) {
    if (j.status === 'completed') { completed.push(j); continue; }
    const d = j.scheduledDate ? new Date(j.scheduledDate) : null;
    if (!d || Number.isNaN(d.getTime()) || isSameDay(d, now)) today.push(j);
    else if (isBefore(d, todayStart)) overdue.push(j);
    else upcoming.push(j);
  }
  const byDate = (a: Job, b: Job) => (a.scheduledDate || '').localeCompare(b.scheduledDate || '');
  return { today: [...overdue, ...today].sort(byDate), upcoming: upcoming.sort(byDate), completed: completed.sort(byDate).reverse() };
}

/** The job the technician should look at next: the first live one, else the first of today. */
export function nextJob(groups: TechnicianJobGroups): Job | null {
  return groups.today.find((j) => j.status === 'in-progress' || j.status === 'arrived' || j.status === 'en-route') ?? groups.today[0] ?? null;
}
