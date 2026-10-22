import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { offlineQueue, useOfflineQueueStore, type ReplayReport } from '~/services/offlineQueue';

/**
 * Drives the offline queue: replays on reconnect and on return to the foreground, refreshes the
 * job cache afterwards and reports the outcome (web `useOfflineQueue`). Mount once (root layout).
 */
export function useOfflineQueueSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const wasOnline = useRef(onlineManager.isOnline());

  const afterReplay = useCallback((report: ReplayReport) => {
    if (report.replayed > 0) {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      haptics.success();
      toast.success(`Back online — ${report.replayed} queued change${report.replayed === 1 ? '' : 's'} sent`);
    }
    const stuck = report.failed.filter((f) => !offlineQueue.isTransient(f.error));
    if (stuck.length > 0) toast.error(`${stuck.length} queued change${stuck.length === 1 ? '' : 's'} need${stuck.length === 1 ? 's' : ''} attention`, { description: stuck[0]?.error.message });
  }, [queryClient]);

  const replayNow = useCallback(async () => {
    if (!onlineManager.isOnline() || offlineQueue.queueLength() === 0) return;
    const report = await offlineQueue.replay();
    afterReplay(report);
  }, [afterReplay]);

  useEffect(() => {
    if (!enabled) return;
    offlineQueue.hydrateOfflineQueue();
    void replayNow();
    const unsubscribe = onlineManager.subscribe((online) => {
      if (online && !wasOnline.current) void replayNow();
      else if (!online && wasOnline.current && offlineQueue.queueLength() === 0) toast.warning('You are offline. Changes will be queued and sent when you reconnect.');
      wasOnline.current = online;
    });
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void replayNow(); });
    return () => { unsubscribe(); sub.remove(); };
  }, [enabled, replayNow]);

  return { replayNow };
}

/** Counts for banners and badges. */
export function useOfflineQueueState() {
  return useOfflineQueueStore();
}
