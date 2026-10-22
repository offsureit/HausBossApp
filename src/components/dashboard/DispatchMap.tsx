import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MapPinOff, Truck } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { isOverdue } from '@/utils/jobStatus';
import type { Employee, Job, UserLocation } from '@/types';
import { EmptyState, Text } from '~/components/ui';
import { mapAvailable, mapProvider } from '~/lib/maps';
import { locationsService, type LatLng } from '~/services/locations';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { statusColors } from '~/theme/tokens';

export interface DispatchMapProps {
  jobs: Job[];
  locations: Map<string, UserLocation>;
  employees: Employee[];
  colorFor: (employee: Employee | null, fallbackName: string) => string;
  onSelectJob: (job: Job) => void;
  onSelectEmployee: (employeeId: string) => void;
  height: number;
}

const US_CENTER = { latitude: 39.5, longitude: -98.35, latitudeDelta: 40, longitudeDelta: 40 };
const RECENT_MS = 5 * 60 * 1000;

/** Marker style per §14: overdue = yellow with a red border. */
export function markerStyle(job: Pick<Job, 'status' | 'scheduledDate'>): { fill: string; stroke: string } {
  if (isOverdue(job)) return { fill: '#facc15', stroke: '#dc2626' };
  return { fill: statusColors[job.status] ?? '#64748b', stroke: '#ffffff' };
}

/**
 * Dispatch map: job pins by status (addresses geocoded natively, cached), live truck markers that
 * glide between updates, a pulsing ring under trucks seen in the last five minutes.
 */
export function DispatchMap({ jobs, locations, employees, colorFor, onSelectJob, onSelectEmployee, height }: DispatchMapProps) {
  const { colors } = useTheme();
  const mapRef = useRef<ComponentRef<typeof MapView>>(null);
  const [pins, setPins] = useState<Map<string, LatLng>>(new Map());
  const fitted = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  // Geocode visible job addresses (cached in MMKV after the first lookup).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const job of jobs) {
        if (cancelled) return;
        if (pins.has(job.id) || !job.clientAddress) continue;
        const point = await locationsService.geocodeAddress(job.clientAddress);
        if (cancelled) return;
        if (point) setPins((prev) => new Map(prev).set(job.id, point));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const coordinates = useMemo(() => {
    const out: LatLng[] = [];
    jobs.forEach((j) => { const p = pins.get(j.id); if (p) out.push(p); });
    locations.forEach((l) => out.push({ latitude: l.latitude, longitude: l.longitude }));
    return out;
  }, [jobs, pins, locations]);

  useEffect(() => {
    if (coordinates.length === 0 || fitted.current) return;
    fitted.current = true;
    const t = setTimeout(() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }), 300);
    return () => clearTimeout(t);
  }, [coordinates]);

  if (!mapAvailable) {
    return <EmptyState icon={MapPinOff} title="Map not configured" message="This build has no Google Maps SDK key. Set GOOGLE_MAPS_ANDROID_KEY / GOOGLE_MAPS_IOS_KEY and rebuild to see jobs and trucks on the map. The roster and job lists below still work." />;
  }

  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <MapView ref={mapRef} provider={mapProvider ?? undefined} style={StyleSheet.absoluteFill} initialRegion={US_CENTER} showsUserLocation={false} toolbarEnabled={false} accessibilityLabel="Job map">
        {jobs.map((job) => {
          const p = pins.get(job.id);
          if (!p) return null;
          const { fill, stroke } = markerStyle(job);
          return (
            <Marker key={job.id} coordinate={p} title={job.clientName} description={job.status} onPress={() => onSelectJob(job)} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
              <View style={[styles.pin, { backgroundColor: fill, borderColor: stroke }]}><View style={styles.pinDot} /></View>
            </Marker>
          );
        })}
        {Array.from(locations.values()).map((loc) => {
          const emp = employees.find((e) => e.id === loc.user_id) ?? null;
          const color = colorFor(emp, loc.user_id);
          const recent = now - new Date(loc.captured_at).getTime() < RECENT_MS;
          return <TruckMarker key={loc.user_id} location={loc} color={color} recent={recent} title={`${emp?.name ?? 'Technician'} · ${new Date(loc.captured_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} onPress={() => onSelectEmployee(loc.user_id)} />;
        })}
      </MapView>
      {coordinates.length === 0 ? (
        <View style={[styles.overlay, { backgroundColor: colors.card }]} pointerEvents="none"><Text variant="caption" color="mutedForeground">Locating jobs…</Text></View>
      ) : null}
    </View>
  );
}

/** Trucks glide to each new fix (`animateMarkerToCoordinate`); recently updated ones pulse. */
function TruckMarker({ location, color, recent, title, onPress }: { location: UserLocation; color: string; recent: boolean; title: string; onPress: () => void }) {
  const ref = useRef<ComponentRef<typeof Marker>>(null);
  const first = useRef(true);
  const { reduced } = useMotion();
  const pulse = useSharedValue(0);
  const coordinate = useMemo(() => ({ latitude: location.latitude, longitude: location.longitude }), [location.latitude, location.longitude]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    ref.current?.animateMarkerToCoordinate(coordinate, reduced ? 0 : 1000);
  }, [coordinate, reduced]);

  useEffect(() => {
    if (!recent || reduced) { pulse.set(0); return; }
    pulse.set(withRepeat(withSequence(withTiming(1, { duration: 1200 }), withTiming(0, { duration: 0 })), -1, false));
  }, [recent, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.get() * 1.2 }], opacity: 0.5 * (1 - pulse.get()) }));

  return (
    <Marker ref={ref} coordinate={coordinate} title={title} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }} zIndex={1000} tracksViewChanges={recent && !reduced}>
      <View style={styles.truckWrap}>
        {recent ? <Animated.View style={[styles.ring, { backgroundColor: color }, ring]} /> : null}
        <View style={[styles.truck, { backgroundColor: color }]}><Truck size={16} color="#ffffff" /></View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  pin: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  pinDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
  truckWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
  truck: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', bottom: 8, left: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
});
