import { useCallback, useEffect, useState } from 'react';
import { activityService } from '~/services/activity';
import type { ActivityLog } from '@/types';

/** Per-job activity feed with realtime inserts (`job-activity-logs-<jobId>`). */
export function useJobActivity(jobId: string | null) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) { setLogs([]); return; }
    setLoading(true);
    const { data, error: err } = await activityService.listByJob(jobId);
    setError(err?.message ?? null);
    if (data) setLogs(data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!jobId) return;
    return activityService.subscribe(jobId, (change) => {
      const row = change.new;
      if (row) setLogs((prev) => (prev.some((l) => l.id === row.id) ? prev : [row, ...prev]));
    });
  }, [jobId]);

  return { logs, loading, error, refresh };
}
