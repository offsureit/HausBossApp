import { useCallback, useMemo, useState } from 'react';
import { calculateJobTotalTime } from '@/utils/timeCalculations';
import type { Job, TimeEntry, TimeEntryType } from '@/types';
import { NotesSheet, PhotoPromptSheet } from '~/components/jobs/MediaSheets';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import type { JobActions } from './useJobActions';

/** Builds the next `timeEntries` array with one more entry appended (same as the web). */
export function appendTimeEntry(entries: readonly TimeEntry[] | null | undefined, entry: { type: TimeEntryType; userId?: string; notes?: string; timestamp?: string }): TimeEntry[] {
  const next: TimeEntry = { type: entry.type, timestamp: entry.timestamp ?? new Date().toISOString() };
  if (entry.userId) next.userId = entry.userId;
  if (entry.notes) next.notes = entry.notes;
  return [...(entries ?? []), next];
}

export interface UseClockActionsOptions extends Pick<JobActions, 'updateJob' | 'updateJobStatus'> {
  job: Job | null;
  userId: string | null | undefined;
  /** Contractors also move the job status (→ in-progress, → completed). */
  moveStatus?: boolean;
  actorIsContractor?: boolean;
  onCompleted?: (job: Job) => void;
}

type Flow = { phase: 'photo' | 'notes'; kind: 'start' | 'stop' | 'complete' } | null;

/** Shared clock-in / out state machine (forced photo prompt → notes → write), as on the web. */
export function useClockActions({ job, userId, updateJob, updateJobStatus, moveStatus = false, actorIsContractor = false, onCompleted }: UseClockActionsOptions) {
  const [flow, setFlow] = useState<Flow>(null);
  /** Kept after `flow` resets so a sheet's title/labels don't flip while it animates closed. */
  const [kind, setKind] = useState<'start' | 'stop' | 'complete'>('start');
  const [busy, setBusy] = useState(false);
  const isActive = useMemo(() => calculateJobTotalTime(job?.timeEntries).isCurrentlyActive, [job?.timeEntries]);

  const write = useCallback(async (kind: 'start' | 'stop' | 'complete', notes?: string) => {
    if (!job) return;
    setBusy(true);
    try {
      const timeEntries = appendTimeEntry(job.timeEntries, { type: kind, userId: userId ?? undefined, notes });
      const patch: Parameters<JobActions['updateJob']>[1] = { timeEntries };
      if (notes) patch.notes = job.notes ? `${job.notes}\n${notes}` : notes;
      const ok = await updateJob(job.id, patch);
      if (!ok) return;
      if (moveStatus) {
        let moved = true;
        if (kind === 'start' && job.status !== 'in-progress') moved = await updateJobStatus(job.id, 'in-progress', { previousStatus: job.status, actorIsContractor });
        if (kind === 'complete' && job.status !== 'completed') moved = await updateJobStatus(job.id, 'completed', { previousStatus: job.status, actorIsContractor });
        if (!moved) { toast.warning(kind === 'start' ? 'Time recorded, but the job could not be moved to In progress' : 'Time recorded, but the job could not be marked complete'); return; }
      }
      haptics.success();
      toast.success(kind === 'start' ? 'Clocked in' : kind === 'stop' ? 'Clocked out' : 'Job completed');
      if (kind === 'complete') onCompleted?.(job);
    } finally {
      setBusy(false);
      setFlow(null);
    }
  }, [job, userId, updateJob, updateJobStatus, moveStatus, actorIsContractor, onCompleted]);

  const begin = useCallback((k: 'start' | 'stop' | 'complete') => { setKind(k); setFlow({ phase: 'photo', kind: k }); }, []);
  const clockIn = useCallback(() => begin('start'), [begin]);
  const clockOut = useCallback(() => begin('stop'), [begin]);
  const complete = useCallback(() => begin('complete'), [begin]);

  const sheets = job ? (
    <>
      <PhotoPromptSheet
        open={flow?.phase === 'photo'}
        phase={kind === 'start' ? 'pre' : 'post'}
        jobId={job.id}
        onCancel={() => setFlow(null)}
        onDone={() => {
          if (!flow) return;
          if (flow.kind === 'start') void write('start');
          else setFlow({ phase: 'notes', kind: flow.kind });
        }}
      />
      <NotesSheet
        open={flow?.phase === 'notes'}
        onClose={() => setFlow(null)}
        busy={busy}
        title={kind === 'complete' ? 'Completion notes' : 'Clock-out notes'}
        confirmLabel={kind === 'complete' ? 'Complete job' : 'Clock out'}
        onConfirm={(notes) => { if (flow) return write(flow.kind, notes || undefined); }}
      />
    </>
  ) : null;

  return { isActive, busy, clockIn, clockOut, complete, sheets };
}
