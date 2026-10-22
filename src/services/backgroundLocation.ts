import * as Location from 'expo-location';
import { Accuracy, ActivityType } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getSession, isSessionLoaded, loadSession } from '~/api/session';
import { isMine } from '~/features/jobs/grouping';
import { kv } from '~/lib/storage';
import type { Job, UserProfileBundle } from '@/types';
import { listJobs } from './jobs';
import { brand } from '~/theme/tokens';
import { ensureForegroundPermission, upsertOwnLocation, type LocationPermission } from './locations';

/**
 * Background GPS for technicians (brief "Native capabilities"): while a job is en route / in
 * progress the OS wakes `LOCATION_TASK` every two minutes (balanced accuracy for battery) and the
 * task PUTs the fix to `/locations/me` — the same endpoint and cadence as the foreground reporter.
 * Android runs it as a foreground service (persistent "Sharing location" notification); iOS uses
 * the `location` background mode with the blue indicator. Stops when the job is done.
 */

export const LOCATION_TASK = 'hausboss.location';
export const REPORT_INTERVAL_MS = 2 * 60 * 1000;
/** Drop fixes that arrive faster than this (deferred batches, OS jitter). */
const MIN_GAP_MS = 60 * 1000;
const LAST_REPORT_KEY = 'hb.location.lastReport';
export const EXPLAINED_KEY = 'hb.location.explained';

export type BackgroundPermission = 'granted' | 'foreground' | 'denied' | 'undetermined';

interface TaskData { locations?: Location.LocationObject[] }

TaskManager.defineTask<TaskData>(LOCATION_TASK, async ({ data, error }) => {
  if (error) { console.warn('[location] background task error', error.message); return; }
  const fixes = data?.locations ?? [];
  const latest = fixes[fixes.length - 1];
  if (__DEV__) console.log(`[location] background task: ${fixes.length} fix(es)`, latest ? `${latest.coords.latitude.toFixed(4)},${latest.coords.longitude.toFixed(4)}` : '');
  if (!latest) return;
  const last = Number(kv.getString(LAST_REPORT_KEY) ?? 0);
  if (Date.now() - last < MIN_GAP_MS) { if (__DEV__) console.log('[location] background task: skipped (too soon)'); return; }
  // Headless start (app killed): the session store has not been read yet.
  if (!isSessionLoaded()) await loadSession();
  if (!getSession()) { await stopBackgroundTracking(); return; }
  const { error: err } = await upsertOwnLocation({ latitude: latest.coords.latitude, longitude: latest.coords.longitude, accuracy: latest.coords.accuracy ?? null, capturedAt: new Date(latest.timestamp).toISOString() });
  if (err) { console.warn('[location] background report failed:', err.message); return; }
  kv.setString(LAST_REPORT_KEY, String(Date.now()));
  if (__DEV__) console.log('[location] background report sent');
  // The office may have completed / reassigned the job while the phone slept: stop when nothing is live.
  if ((await hasLiveJob()) === false) { if (__DEV__) console.log('[location] no live job — stopping background tracking'); await stopBackgroundTracking(); }
});

/** Is a job assigned to this user still en route / in progress? `null` when it could not be checked (offline). */
export async function hasLiveJob(): Promise<boolean | null> {
  const session = getSession();
  if (!session?.user) return false;
  const { data, error } = await listJobs();
  if (error || !data) return null;
  const cached = kv.getJSON<UserProfileBundle>(`hb.profile.${session.user.id}`);
  const me = { id: session.user.id, firstName: cached?.profile?.first_name, lastName: cached?.profile?.last_name };
  return data.some((j: Job) => isMine(j, me) && (j.status === 'en-route' || j.status === 'in-progress'));
}

export async function getBackgroundPermission(): Promise<BackgroundPermission> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return fg.status === 'denied' && !fg.canAskAgain ? 'denied' : 'undetermined';
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.granted) return 'granted';
  return bg.status === 'denied' && !bg.canAskAgain ? 'denied' : 'foreground';
}

/** Foreground first (the OS requires it), then "Allow all the time" / "Always". */
export async function requestBackgroundPermission(): Promise<BackgroundPermission> {
  const fg: LocationPermission = await ensureForegroundPermission();
  if (fg !== 'granted') return fg === 'denied' ? 'denied' : 'undetermined';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.granted) return 'granted';
  return bg.status === 'denied' && !bg.canAskAgain ? 'denied' : 'foreground';
}

export const wasExplained = () => kv.getString(EXPLAINED_KEY) === '1';
export const markExplained = () => kv.setString(EXPLAINED_KEY, '1');

export async function isBackgroundTracking(): Promise<boolean> {
  try { return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK); } catch { return false; }
}

/** Starts the task when permitted; resolves false when the OS refused (caller falls back to foreground reports). */
export async function startBackgroundTracking(): Promise<boolean> {
  if ((await getBackgroundPermission()) !== 'granted') return false;
  // Always (re)start: the task registration survives a process kill but the Android foreground
  // service does not, and start is idempotent (it just refreshes the options and the notification).
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Accuracy.Balanced,
      timeInterval: REPORT_INTERVAL_MS,
      distanceInterval: 0,
      deferredUpdatesInterval: REPORT_INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: ActivityType.AutomotiveNavigation,
      foregroundService: Platform.OS === 'android' ? { notificationTitle: 'HausBaus is sharing your location', notificationBody: 'Dispatch can see your truck while you are on a job.', notificationColor: brand.navy } : undefined,
    });
    return true;
  } catch (err) {
    console.warn('[location] could not start background updates', err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  try { if (await isBackgroundTracking()) await Location.stopLocationUpdatesAsync(LOCATION_TASK); } catch { /* already stopped */ }
}

export const backgroundLocation = { LOCATION_TASK, REPORT_INTERVAL_MS, getBackgroundPermission, requestBackgroundPermission, startBackgroundTracking, stopBackgroundTracking, isBackgroundTracking, wasExplained, markExplained };
