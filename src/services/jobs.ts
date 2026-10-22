import { api } from '~/api/client';
import { subscribe as subscribeChannel } from '~/api/realtime';
import type { JobRow } from '@/api/dbTypes';
import { mergeJobUpdate, toJobInsert, toJobUpdate, transformJob } from '@/services/adapters/jobAdapter';
import { fail, fromApi, fromApiMap, isUuid, ok, type ServiceError, type ServiceResult } from '@/services/types';
import { isJobStatus, isValidTransition } from '@/utils/jobStatus';
import type { Job, JobCreateInput, JobStatus, JobUpdateInput, RealtimeChange, Unsubscribe } from '@/types';
import { getCurrentPosition, type LocationFix } from './locations';

/**
 * Jobs — the hub entity (`/jobs*`, docs/API.md; PROJECT_HANDOFF §8.3, §8.4, §13, §14), a port of the
 * web `jobsService` on the mobile client. Rows go through the shared `jobAdapter`; the server owns
 * customer auto-link, the assignment email and the status side effects (SMS / email / audit); the
 * device only adds its GPS fix to a technician's status change.
 */

export async function listJobs(): Promise<ServiceResult<Job[]>> {
  return fromApiMap(() => api.get<JobRow[]>('/jobs'), (rows) => (rows ?? []).map(transformJob), 'Failed to load jobs');
}

export async function getJob(jobId: string): Promise<ServiceResult<Job>> {
  return fromApiMap(() => api.get<JobRow>(`/jobs/${encodeURIComponent(jobId)}`), transformJob, 'Job not found');
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function validateJobCreate(input: JobCreateInput): string | null {
  const name = (input.clientName ?? '').trim() || [input.clientFirstName, input.clientLastName].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
  if (!name) return 'Client name is required';
  if (!input.clientPhone?.trim()) return 'Client phone is required';
  if (!input.clientAddress?.trim()) return 'Service address is required';
  if (!input.jobDetails?.trim()) return 'Job details are required';
  if (input.status && !isJobStatus(input.status)) return 'Unknown job status';
  if (input.scheduledDate && Number.isNaN(new Date(input.scheduledDate).getTime())) return 'Scheduled date is invalid';
  return null;
}

export interface CreateJobContext {
  companyId: string;
  userId: string;
  onInvalidSession?: () => void;
}

export async function createJob(input: JobCreateInput, ctx: CreateJobContext): Promise<ServiceResult<Job>> {
  if (!isUuid(ctx.userId)) {
    ctx.onInvalidSession?.();
    return fail('Your session is invalid. Please sign in again.', 'auth');
  }
  const problem = validateJobCreate(input);
  if (problem) return fail(problem, 'validation');
  const row = toJobInsert(input, { companyId: ctx.companyId, userId: ctx.userId });
  return fromApiMap(() => api.post<JobRow>('/jobs', row), transformJob, 'Failed to create job');
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** Partial camelCase update. Pass `current` so metadata (notes / time entries) is merged, not clobbered. */
export async function updateJob(jobId: string, patch: JobUpdateInput, current?: Job): Promise<ServiceResult<Job>> {
  if (patch.status !== undefined && !isJobStatus(patch.status)) return fail('Unknown job status', 'validation');
  const merged = current ? mergeJobUpdate(current, patch) : patch;
  const dbUpdate = toJobUpdate(merged);
  if (Object.keys(dbUpdate).length === 0) return current ? ok(current) : getJob(jobId);
  return fromApiMap(() => api.patch<JobRow>(`/jobs/${encodeURIComponent(jobId)}`, dbUpdate), transformJob, 'Failed to update job');
}

export interface UpdateStatusOptions {
  previousStatus?: JobStatus;
  actorIsContractor?: boolean;
  isStaff?: boolean;
  /** Receives non-fatal side-effect failures (GPS) for a warning toast. */
  onWarning?: (message: string, error: ServiceError) => void;
  /** Skip the GPS capture (offline replay). */
  skipLocation?: boolean;
  /** A fix captured earlier (queued while offline) — sent instead of reading the GPS now. */
  location?: LocationFix;
}

/**
 * Status transition. The server applies the §14 side effects (SMS + email to the client, audit,
 * notifications); a technician's device also sends its GPS fix so `user_locations` is refreshed.
 */
export async function updateJobStatus(jobId: string, status: JobStatus, options: UpdateStatusOptions = {}, current?: Job): Promise<ServiceResult<Job>> {
  if (!isJobStatus(status)) return fail('Unknown job status', 'validation');
  const previous = options.previousStatus ?? current?.status;
  if (previous && !isValidTransition(previous, status, { isStaff: options.isStaff ?? !options.actorIsContractor })) {
    return fail(`Cannot move a job from ${previous} to ${status}`, 'workflow');
  }
  let location: LocationFix | undefined = options.location;
  if (!location && options.actorIsContractor && !options.skipLocation) {
    try {
      location = await getCurrentPosition({ highAccuracy: true, timeoutMs: 8_000 });
    } catch (err) {
      options.onWarning?.('Location could not be recorded', { message: err instanceof Error ? err.message : 'Could not read your location', code: 'geolocation', cause: err });
    }
  }
  return fromApiMap(
    () => api.post<JobRow>(`/jobs/${encodeURIComponent(jobId)}/status`, {
      status,
      previous_status: previous ?? null,
      ...(location ? { location: { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy ?? null } } : {}),
    }),
    transformJob,
    'Failed to update job status',
  );
}

/** Drag-and-drop ordering → `jobs.sort_order`. */
export async function reorderJobs(orderedIds: readonly string[]): Promise<ServiceResult<{ updated: number }>> {
  if (orderedIds.length === 0) return ok({ updated: 0 });
  const result = await fromApi(() => api.post<{ updated?: number }>('/jobs/reorder', { ids: [...orderedIds] }), 'Failed to save the new order');
  return result.error ? { data: null, error: result.error } : ok({ updated: result.data?.updated ?? orderedIds.length });
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export interface JobRealtimeHandlers {
  onInsert?: (job: Job) => void;
  onUpdate?: (job: Job, previous: Partial<JobRow> | null) => void;
  onDelete?: (old: Partial<JobRow>) => void;
  onChange?: (change: RealtimeChange<Job>) => void;
}

export function subscribeToCompanyJobs(companyId: string, handlers: JobRealtimeHandlers): Unsubscribe {
  return subscribeChannel<JobRow>(`jobs:company:${companyId}`, (change) => {
    if (change.eventType === 'INSERT' && change.new) {
      const job = transformJob(change.new);
      handlers.onInsert?.(job);
      handlers.onChange?.({ eventType: 'INSERT', new: job, old: null });
    } else if (change.eventType === 'UPDATE' && change.new) {
      const job = transformJob(change.new);
      handlers.onUpdate?.(job, change.old ?? null);
      handlers.onChange?.({ eventType: 'UPDATE', new: job, old: null });
    } else if (change.eventType === 'DELETE') {
      const old = (change.old ?? {}) as Partial<JobRow>;
      handlers.onDelete?.(old);
      handlers.onChange?.({ eventType: 'DELETE', new: null, old: { id: old.id } });
    }
  });
}

/** De-duplicate by id when a local write and its realtime echo both arrive (§8.3). */
export function upsertJobInList(list: readonly Job[], job: Job): Job[] {
  const index = list.findIndex((j) => j.id === job.id);
  if (index === -1) return [job, ...list];
  const next = list.slice();
  next[index] = job;
  return next;
}

export const jobsService = { listJobs, getJob, createJob, updateJob, updateJobStatus, reorderJobs, subscribeToCompanyJobs, upsertJobInList, validateJobCreate };
