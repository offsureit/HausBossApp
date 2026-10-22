import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsService } from '~/services/jobs';
import type { Job } from '@/types';

export const jobsKey = (companyId: string | null) => ['jobs', companyId] as const;

/**
 * Company job list: full load (no pagination, §13) kept live through the
 * `jobs:company:<id>` channel (full rows, de-duplicated by id).
 */
export function useJobsQuery(companyId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: jobsKey(companyId),
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await jobsService.listJobs();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!companyId) return;
    const key = jobsKey(companyId);
    const upsert = (job: Job) => queryClient.setQueryData<Job[]>(key, (prev) => jobsService.upsertJobInList(prev ?? [], job));
    return jobsService.subscribeToCompanyJobs(companyId, {
      onInsert: upsert,
      onUpdate: upsert,
      onDelete: (old) => queryClient.setQueryData<Job[]>(key, (prev) => (prev ?? []).filter((j) => j.id !== old.id)),
    });
  }, [companyId, queryClient]);

  return query;
}
