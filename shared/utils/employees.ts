/**
 * Who can be given jobs. Technicians do the field work, but an owner (admin) or a manager can be
 * assigned jobs too, so every assignment picker and the dispatcher's "All Employees" filter list all
 * of them. Superadmin is a platform role, not a company employee.
 */
import { isClosedStatus } from '@/utils/jobStatus';
import type { AppRole, Employee, Job } from '@/types';

const ASSIGNABLE: readonly AppRole[] = ['contractor', 'manager', 'admin'];

export const EMPLOYEE_ROLE_LABEL: Record<AppRole, string> = { admin: 'Owner', manager: 'Manager', contractor: 'Technician', superadmin: 'Superadmin' };

/** Employees that can be assigned jobs (active only unless `includeInactive`), technicians first, then by name. */
export function assignableEmployees(team: readonly Employee[], { includeInactive = false } = {}): Employee[] {
  const rank = (e: Employee) => (e.role === 'contractor' ? 0 : 1);
  return team
    .filter((e) => ASSIGNABLE.includes(e.role) && (includeInactive || e.isActive))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** "Maria Lopez (Manager)": a role suffix for non-technicians, so dispatchers see who is office staff. */
export function employeeOptionLabel(e: Employee): string {
  return e.role === 'contractor' ? e.name : `${e.name} (${EMPLOYEE_ROLE_LABEL[e.role]})`;
}

/** The job is assigned to this employee (by id, or by display name for legacy rows). */
export function isAssignedTo(job: Pick<Job, 'assignedUserId' | 'assignedTo'>, employee: Pick<Employee, 'id' | 'name'>): boolean {
  if (job.assignedUserId) return job.assignedUserId === employee.id;
  return !!job.assignedTo && job.assignedTo.trim().toLowerCase() === employee.name.trim().toLowerCase();
}

/** The employee's open (not completed / cancelled) jobs, earliest first; unscheduled last. */
export function openJobsFor(jobs: readonly Job[], employee: Pick<Employee, 'id' | 'name'>): Job[] {
  return jobs
    .filter((j) => !isClosedStatus(j.status) && isAssignedTo(j, employee))
    .sort((a, b) => (a.scheduledDate || '9999').localeCompare(b.scheduledDate || '9999'));
}
