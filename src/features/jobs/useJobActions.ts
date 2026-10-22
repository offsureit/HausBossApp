import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isOnline } from '~/api/client';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { jobsService, type UpdateStatusOptions } from '~/services/jobs';
import { locationsService } from '~/services/locations';
import { offlineQueue } from '~/services/offlineQueue';
import type { Job, JobCreateInput, JobStatus, JobUpdateInput } from '@/types';
import { jobsKey } from './useJobs';

/** Partial camelCase job patch — the same shape `jobsService.updateJob` accepts (web `contracts.ts`). */
export type JobPatch = Partial<Omit<Job, 'id' | 'companyId' | 'createdAt'>>;

export interface JobActions {
  createJob: (input: JobCreateInput) => Promise<Job | null>;
  updateJob: (jobId: string, patch: JobPatch) => Promise<boolean>;
  updateJobStatus: (jobId: string, status: JobStatus, options?: Partial<UpdateStatusOptions>) => Promise<boolean>;
  getJob: (jobId: string) => Job | undefined;
}

/**
 * The job mutations every screen uses, writing straight into the React Query cache (the realtime
 * echo then confirms). Offline, updates and status changes are queued (with the GPS fix captured
 * now) and applied to the cache optimistically, like the web `useJobs`.
 */
export function useJobActions(): JobActions {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const { companyId } = useCompany();
  const key = useMemo(() => jobsKey(companyId), [companyId]);

  const upsert = useCallback((job: Job) => queryClient.setQueryData<Job[]>(key, (prev) => jobsService.upsertJobInList(prev ?? [], job)), [queryClient, key]);
  const patchLocal = useCallback((jobId: string, patch: Partial<Job>) => queryClient.setQueryData<Job[]>(key, (prev) => (prev ?? []).map((j) => (j.id === jobId ? { ...j, ...patch } : j))), [queryClient, key]);
  const getJob = useCallback((jobId: string) => queryClient.getQueryData<Job[]>(key)?.find((j) => j.id === jobId), [queryClient, key]);

  const createJob = useCallback(async (input: JobCreateInput) => {
    if (!companyId || !auth.user) { toast.error('Not signed in'); return null; }
    if (!isOnline()) { toast.error('You are offline', { description: 'New jobs need a connection; try again when you are back online.' }); return null; }
    const { data, error } = await jobsService.createJob(input, { companyId, userId: auth.user.id, onInvalidSession: () => void auth.signOut() });
    if (error || !data) { toast.error('Could not create job', { description: error?.message }); haptics.error(); return null; }
    upsert(data);
    toast.success('Job created');
    haptics.success();
    return data;
  }, [companyId, auth, upsert]);

  const updateJob = useCallback(async (jobId: string, patch: JobPatch) => {
    const current = getJob(jobId);
    if (!isOnline()) {
      if (!offlineQueue.enqueue({ kind: 'job_update', jobId, patch: patch as JobUpdateInput })) { toast.error('You are offline and the change could not be saved on this device'); return false; }
      patchLocal(jobId, patch as Partial<Job>);
      toast.info('You are offline — change queued');
      return true;
    }
    const { data, error } = await jobsService.updateJob(jobId, patch as JobUpdateInput, current);
    if (error || !data) { toast.error('Could not update job', { description: error?.message }); haptics.error(); return false; }
    upsert(data);
    return true;
  }, [getJob, upsert, patchLocal]);

  const updateJobStatus = useCallback(async (jobId: string, status: JobStatus, options: Partial<UpdateStatusOptions> = {}) => {
    const current = getJob(jobId);
    const previousStatus = options.previousStatus ?? current?.status;
    const actorIsContractor = options.actorIsContractor ?? auth.isContractor;
    if (!isOnline()) {
      // GPS still works offline: keep the fix with the queued change so the server records where it happened.
      const gps = actorIsContractor ? await locationsService.captureGps(4_000) : null;
      const location = gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy ?? null, capturedAt: new Date().toISOString() } : undefined;
      if (!offlineQueue.enqueue({ kind: 'job_status', jobId, status, previousStatus, location, actorIsContractor, isStaff: options.isStaff ?? auth.isStaff })) { toast.error('You are offline and the change could not be saved on this device'); return false; }
      patchLocal(jobId, { status });
      haptics.success();
      toast.info('You are offline — status change queued');
      return true;
    }
    const { data, error } = await jobsService.updateJobStatus(jobId, status, {
      previousStatus,
      actorIsContractor,
      isStaff: auth.isStaff,
      onWarning: (message, err) => toast.warning(message, { description: err.message }),
      ...options,
    }, current);
    if (error || !data) { toast.error('Could not update status', { description: error?.message }); haptics.error(); return false; }
    upsert(data);
    return true;
  }, [auth.isContractor, auth.isStaff, getJob, upsert, patchLocal]);

  return { createJob, updateJob, updateJobStatus, getJob };
}
