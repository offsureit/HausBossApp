import * as Location from 'expo-location';
import { api } from '~/api/client';
import { broadcast, onBroadcast, subscribe as subscribeChannel } from '~/api/realtime';
import { kv } from '~/lib/storage';
import { fail, fromApi, fromApiMap, type ServiceResult } from '@/services/types';
import type { GpsPoint, RealtimeChange, Unsubscribe, UserLocation } from '@/types';

/**
 * Technician GPS (`/locations*` + realtime; PROJECT_HANDOFF §8.7) — the mobile counterpart of the
 * web `locationsService`, on `expo-location`. Protocol: the office broadcasts
 * `location_ping_request` on `presence:company:<id>`; every technician answers with
 * `PUT /locations/me`; the office collects `tech-locs:<companyId>` changes (20 s cap).
 */

export const LOCATION_PING_EVENT = 'location_ping_request';
export const LOCATION_PING_TIMEOUT_MS = 20_000;

export const presenceChannelName = (companyId: string) => `presence:company:${companyId}`;

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt?: string;
}

export type LocationPermission = 'granted' | 'denied' | 'undetermined';

/** Foreground ("while in use") permission; background ("always") arrives in Phase 4. */
export async function ensureForegroundPermission(): Promise<LocationPermission> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain && current.status === 'denied') return 'denied';
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted ? 'granted' : asked.status === 'denied' ? 'denied' : 'undetermined';
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** One GPS fix. `highAccuracy` for explicit pings / status changes, balanced for periodic reports. */
export async function getCurrentPosition(options: { highAccuracy?: boolean; timeoutMs?: number } = {}): Promise<LocationFix> {
  const permission = await ensureForegroundPermission();
  if (permission !== 'granted') throw new Error('Location permission was not granted');
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: options.highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced }),
    options.timeoutMs ?? 10_000,
    'Could not read your location in time',
  );
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, capturedAt: new Date(pos.timestamp).toISOString() };
}

/** Fresh fix, or the OS's last known position (≤ 2 min old) when a fresh one does not arrive in time. */
export async function getPositionOrLastKnown(options: { highAccuracy?: boolean; timeoutMs?: number } = {}): Promise<LocationFix> {
  try {
    return await getCurrentPosition(options);
  } catch (err) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 }).catch(() => null);
    if (!last) throw err;
    return { latitude: last.coords.latitude, longitude: last.coords.longitude, accuracy: last.coords.accuracy ?? null, capturedAt: new Date(last.timestamp).toISOString() };
  }
}

/** Best-effort fix for tagging photos / status changes; null when unavailable or denied. */
export async function captureGps(timeoutMs = 8_000): Promise<GpsPoint | null> {
  try {
    const fix = await getPositionOrLastKnown({ highAccuracy: true, timeoutMs });
    return { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy ?? undefined };
  } catch {
    return null;
  }
}

export async function upsertOwnLocation(fix: LocationFix): Promise<ServiceResult<UserLocation>> {
  if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return fail('Invalid GPS fix', 'validation');
  return fromApi(
    () => api.put<UserLocation>('/locations/me', { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy ?? null, captured_at: fix.capturedAt ?? new Date().toISOString() }),
    'Failed to save location',
  );
}

/** Read the device GPS and upsert it — the technician side of the ping protocol. */
export async function captureAndUpsertOwnLocation(highAccuracy = true): Promise<ServiceResult<UserLocation>> {
  try {
    const fix = await getPositionOrLastKnown({ highAccuracy });
    return upsertOwnLocation(fix);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not read your location', 'geolocation', err);
  }
}

export async function listCompanyLocations(): Promise<ServiceResult<UserLocation[]>> {
  return fromApiMap(() => api.get<UserLocation[]>('/locations'), (rows) => rows ?? [], 'Failed to load technician locations');
}

/** Channel `tech-locs:<companyId>` — truck markers on the dispatch map. */
export function subscribe(companyId: string, onChange: (change: RealtimeChange<UserLocation>) => void): Unsubscribe {
  return subscribeChannel<UserLocation>(`tech-locs:${companyId}`, onChange);
}

/** Technician side: react to ping requests from the office. */
export function listenForPingRequests(companyId: string, handler: (payload: { requestedBy?: string; requestId?: string }) => void): Unsubscribe {
  return onBroadcast<{ requestedBy?: string; requestId?: string }>(presenceChannelName(companyId), LOCATION_PING_EVENT, (payload) => handler(payload ?? {}));
}

export interface PingSession {
  requestId: string;
  done: Promise<{ received: UserLocation[]; reason: 'all' | 'timeout' | 'terminated' }>;
  terminate: () => void;
}

/** Office side: broadcast a ping and collect answers (ends early once everyone expected reported). */
export function requestPing(companyId: string, options: { requestedBy?: string; expectedUserIds?: string[]; timeoutMs?: number; onUpdate?: (loc: UserLocation) => void } = {}): PingSession {
  const requestId = `${Date.now()}`;
  const expected = new Set(options.expectedUserIds ?? []);
  const received = new Map<string, UserLocation>();
  let finished = false;
  let resolveDone!: (value: { received: UserLocation[]; reason: 'all' | 'timeout' | 'terminated' }) => void;
  const done = new Promise<{ received: UserLocation[]; reason: 'all' | 'timeout' | 'terminated' }>((resolve) => { resolveDone = resolve; });

  const unsubscribe = subscribeChannel<UserLocation>(`tech-locs:${companyId}`, (change) => {
    if (change.eventType === 'DELETE' || !change.new) return;
    const loc = change.new;
    received.set(loc.user_id, loc);
    options.onUpdate?.(loc);
    if (expected.size > 0 && Array.from(expected).every((id) => received.has(id))) finish('all');
  });

  broadcast(presenceChannelName(companyId), LOCATION_PING_EVENT, { requestedBy: options.requestedBy, requestId });
  const timer = setTimeout(() => finish('timeout'), options.timeoutMs ?? LOCATION_PING_TIMEOUT_MS);

  function finish(reason: 'all' | 'timeout' | 'terminated') {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    unsubscribe();
    resolveDone({ received: Array.from(received.values()), reason });
  }

  return { requestId, done, terminate: () => finish('terminated') };
}

// ---------------------------------------------------------------------------
// Geocoding (native, no API key) with an MMKV cache — addresses rarely move.
// ---------------------------------------------------------------------------

export interface LatLng { latitude: number; longitude: number }

const GEOCODE_PREFIX = 'hb.geo.';
const geocodeMemory = new Map<string, LatLng | null>();

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  if (geocodeMemory.has(key)) return geocodeMemory.get(key) ?? null;
  const cached = kv.getJSON<LatLng | { miss: true }>(GEOCODE_PREFIX + key);
  if (cached) {
    const value = 'miss' in cached ? null : cached;
    geocodeMemory.set(key, value);
    return value;
  }
  try {
    if ((await ensureForegroundPermission()) !== 'granted') return null; // Android needs it for the geocoder
    const results = await withTimeout(Location.geocodeAsync(address), 10_000, 'Geocoding timed out');
    const first = results[0];
    const value = first ? { latitude: first.latitude, longitude: first.longitude } : null;
    geocodeMemory.set(key, value);
    kv.setJSON(GEOCODE_PREFIX + key, value ?? { miss: true });
    return value;
  } catch {
    geocodeMemory.set(key, null);
    return null;
  }
}

export async function reverseGeocode(point: LatLng): Promise<string | null> {
  const key = `${GEOCODE_PREFIX}rev.${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
  const cached = kv.getString(key);
  if (cached) return cached;
  try {
    const [first] = await withTimeout(Location.reverseGeocodeAsync(point), 10_000, 'Reverse geocoding timed out');
    if (!first) return null;
    const line = [first.streetNumber && first.street ? `${first.streetNumber} ${first.street}` : first.street ?? first.name, first.city, first.region].filter(Boolean).join(', ');
    if (line) kv.setString(key, line);
    return line || null;
  } catch {
    return null;
  }
}

/** Driving distance / time on real roads (server: Google Routes, then OpenStreetMap). Never a straight line. */
export interface TravelEstimate { distanceKm: number; etaMinutes: number; source: 'google' | 'osrm' }

/** "25 min", "1 h 5 min" (same as the web). */
export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Driving distance and time from the device to a job address (`POST /travel/estimate`, same as the web).
 * The native geocoder's point is sent along when it has one, saving the server a lookup. Null when the
 * location is off, the request fails or no road route exists — the sheet then offers directions instead.
 */
export async function estimateTravel(address: string): Promise<TravelEstimate | null> {
  let origin: LatLng;
  try { origin = await getCurrentPosition({ highAccuracy: true }); } catch { return null; }
  const destination = await geocodeAddress(address);
  try {
    const res = await api.post<{ estimate: TravelEstimate | null }>('/travel/estimate', { origin: { latitude: origin.latitude, longitude: origin.longitude }, address, destination: destination ? { latitude: destination.latitude, longitude: destination.longitude } : null });
    return res?.estimate ?? null;
  } catch {
    return null;
  }
}

export const locationsService = {
  ensureForegroundPermission, getCurrentPosition, getPositionOrLastKnown, captureGps, upsertOwnLocation, captureAndUpsertOwnLocation, listCompanyLocations,
  subscribe, listenForPingRequests, requestPing, presenceChannelName, geocodeAddress, reverseGeocode, estimateTravel,
  LOCATION_PING_EVENT, LOCATION_PING_TIMEOUT_MS,
};
