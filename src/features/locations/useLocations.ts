import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { backgroundLocation, type BackgroundPermission } from '~/services/backgroundLocation';
import { locationsService } from '~/services/locations';
import type { UserLocation } from '@/types';

/** Dispatcher side: live technician positions (`GET /locations` + `tech-locs:<companyId>`). */
export function useCompanyLocations(companyId: string | null, enabled = true) {
  const [locations, setLocations] = useState<Map<string, UserLocation>>(new Map());
  useEffect(() => {
    if (!companyId || !enabled) return;
    void locationsService.listCompanyLocations().then(({ data }) => { if (data) setLocations(new Map(data.map((l) => [l.user_id, l]))); });
    return locationsService.subscribe(companyId, (change) => {
      if (change.eventType === 'DELETE') { const id = change.old?.user_id; if (id) setLocations((m) => { const n = new Map(m); n.delete(id); return n; }); }
      else if (change.new) { const loc = change.new; setLocations((m) => new Map(m).set(loc.user_id, loc)); }
    });
  }, [companyId, enabled]);
  const merge = (list: UserLocation[]) => setLocations((m) => { const n = new Map(m); list.forEach((l) => n.set(l.user_id, l)); return n; });
  return { locations, merge };
}

const DEFAULT_INTERVAL_MS = backgroundLocation.REPORT_INTERVAL_MS;

export type TrackingMode = 'off' | 'foreground' | 'background';

export interface LocationTracking {
  /** `background`: the OS task reports every two minutes even when the app is closed; `foreground`: only while the app is open (permission not "always"). */
  mode: TrackingMode;
  permission: BackgroundPermission;
  /** Re-reads the permission (after the explainer / Settings) and switches to background reporting when allowed. */
  refresh: () => Promise<void>;
}

/**
 * Technician side of the GPS protocol (§8.7): answers `location_ping_request` broadcasts and,
 * while a job is live, reports the position every two minutes — through the background task when
 * the user allowed "always", otherwise with a foreground interval as the fallback.
 */
export function useLocationTracking({ companyId, userId, enabled, active = false, intervalMs = DEFAULT_INTERVAL_MS }: { companyId: string | null; userId: string | null | undefined; enabled: boolean; active?: boolean; intervalMs?: number }): LocationTracking {
  const busy = useRef(false);
  const [mode, setMode] = useState<TrackingMode>('off');
  const [permission, setPermission] = useState<BackgroundPermission>('undetermined');
  const ready = enabled && !!companyId && !!userId;

  useEffect(() => {
    if (!ready) return;
    const respond = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { error } = await locationsService.captureAndUpsertOwnLocation(true);
        if (error) console.warn('[location] ping response failed:', error.message);
      } finally { busy.current = false; }
    };
    return locationsService.listenForPingRequests(companyId as string, () => { void respond(); });
  }, [ready, companyId]);

  const refresh = useCallback(async () => {
    const perm = await backgroundLocation.getBackgroundPermission();
    setPermission(perm);
    if (!ready || !active) { await backgroundLocation.stopBackgroundTracking(); setMode('off'); return; }
    if (perm === 'granted' && (await backgroundLocation.startBackgroundTracking())) { setMode('background'); return; }
    setMode('foreground');
  }, [ready, active]);

  useEffect(() => {
    let cancelled = false;
    void refresh().then(() => { if (cancelled) return undefined; return undefined; });
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { cancelled = true; sub.remove(); };
  }, [refresh]);

  // Foreground fallback: the same two-minute report while the app is open.
  useEffect(() => {
    if (mode !== 'foreground' || !ready || !active) return;
    let cancelled = false;
    const report = async () => {
      if (cancelled || busy.current || AppState.currentState !== 'active') return;
      busy.current = true;
      try {
        const { error } = await locationsService.captureAndUpsertOwnLocation(false);
        if (error) console.warn('[location] periodic report skipped:', error.message);
      } finally { busy.current = false; }
    };
    void report();
    const timer = setInterval(() => { void report(); }, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [mode, ready, active, intervalMs]);

  return { mode, permission, refresh };
}
