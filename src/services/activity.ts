import { api } from '~/api/client';
import { subscribe as subscribeChannel } from '~/api/realtime';
import { SENTINEL_JOB_ID, fail, fromApi, fromApiMap, type ServiceResult } from '@/services/types';
import type { ActivityLog, RealtimeChange, Unsubscribe } from '@/types';

/** Audit trail (`/jobs/:id/activity`, `/activity`). Job events are logged by the database trigger. */

export interface ActivityLogInput {
  jobId?: string | null;
  userId: string;
  activityType: string;
  description: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function listByJob(jobId: string, limit = 200): Promise<ServiceResult<ActivityLog[]>> {
  return fromApiMap(() => api.get<ActivityLog[]>(`/jobs/${encodeURIComponent(jobId)}/activity`, { query: { limit } }), (rows) => rows ?? [], 'Failed to load activity');
}

export async function log(input: ActivityLogInput): Promise<ServiceResult<ActivityLog>> {
  if (!input.userId) return fail('You must be signed in to log activity', 'auth');
  if (!input.description?.trim()) return fail('Activity description is required', 'validation');
  return fromApi(
    () => api.post<ActivityLog>('/activity', {
      job_id: input.jobId && input.jobId.trim() ? input.jobId : SENTINEL_JOB_ID,
      activity_type: input.activityType,
      description: input.description.trim(),
      entity_type: input.entityType ?? (input.jobId ? 'job' : null),
      entity_id: input.entityId ?? input.jobId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      metadata: input.metadata ?? null,
      user_agent: 'hausboss-mobile',
    }),
    'Failed to log activity',
  );
}

/** Channel `job-activity-logs-<jobId>`. */
export function subscribe(jobId: string, onChange: (change: RealtimeChange<ActivityLog>) => void): Unsubscribe {
  return subscribeChannel<ActivityLog>(`job-activity-logs-${jobId}`, (change) => {
    if (change.eventType === 'INSERT' && change.new) onChange({ eventType: 'INSERT', new: change.new, old: null });
  });
}

export const activityService = { listByJob, log, subscribe, SENTINEL_JOB_ID };
