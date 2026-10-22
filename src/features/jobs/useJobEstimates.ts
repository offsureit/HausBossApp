import { useCallback, useEffect, useState } from 'react';
import { estimatesService } from '~/services/estimates';
import type { Estimate } from '@/types';

/** Estimates for a job, created_at desc, kept live by `estimates-<jobId>`. */
export function useJobEstimates(jobId: string | null) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) { setEstimates([]); return; }
    setLoading(true);
    const { data, error: err } = await estimatesService.listByJob(jobId);
    setError(err?.message ?? null);
    if (data) setEstimates(data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upsert = useCallback((estimate: Estimate) => {
    setEstimates((prev) => {
      const idx = prev.findIndex((e) => e.id === estimate.id);
      if (idx === -1) return [estimate, ...prev];
      const next = prev.slice();
      next[idx] = estimate;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!jobId) return;
    return estimatesService.subscribeToJobEstimates(jobId, (change) => {
      if (change.eventType === 'DELETE') {
        const id = change.old?.id;
        if (id) setEstimates((prev) => prev.filter((e) => e.id !== id));
      } else if (change.new) upsert(change.new);
    });
  }, [jobId, upsert]);

  return { estimates, loading, error, refresh, upsert };
}
