import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import { TruckProgress } from '~/components/motion/TruckProgress';
import { formatEta, locationsService, type TravelEstimate } from '~/services/locations';
import { Button, Sheet, Text } from '~/components/ui';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';
import type { Job } from '@/types';

export interface OnMyWaySheetProps {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  /** Resolve `false` when the status change failed (the sheet then stays on the confirm step). */
  onConfirm: () => void | boolean | Promise<void | boolean>;
  busy?: boolean;
}

/** "On my way": driving distance + ETA to the job, then the status change (the server texts the customer) and the truck animation. */
export function OnMyWaySheet({ open, job, onClose, onConfirm, busy = false }: OnMyWaySheetProps) {
  const { colors } = useTheme();
  const [estimate, setEstimate] = useState<TravelEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || !job) { setEstimate(null); setSent(false); return; }
    let cancelled = false;
    setLoading(true);
    void locationsService.estimateTravel(job.clientAddress).then((e) => { if (!cancelled) { setEstimate(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [open, job]);

  const confirm = async () => {
    const ok = await onConfirm();
    if (ok === false) return;
    haptics.success();
    setSent(true);
  };
  const finish = useCallback(() => onClose(), [onClose]);

  if (!job) return null;
  const miles = estimate ? estimate.distanceKm * 0.621371 : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={sent ? 'You are on your way' : 'On my way'}
      description={sent ? 'The customer has been notified.' : 'The customer will be notified that you are en route.'}
      footer={sent ? undefined : (
        <>
          <Button label="Confirm — I'm on my way" size="lg" fullWidth icon={<Navigation size={18} color={colors.accentForeground} />} loading={busy} onPress={() => void confirm()} />
          <Button label="Cancel" variant="ghost" fullWidth onPress={onClose} disabled={busy} />
        </>
      )}
    >
      <Text variant="heading">{job.clientName}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel={`Navigate to ${job.clientAddress}`} onPress={() => void links.navigate(job.clientAddress)} style={styles.address}>
        <MapPin size={18} color={colors.accent} />
        <Text variant="body" color="accent" style={styles.addressText}>{job.clientAddress}</Text>
      </Pressable>
      {sent ? <TruckProgress onDone={finish} /> : (
        <View style={[styles.estimate, { backgroundColor: colors.muted }]} accessibilityLiveRegion="polite">
          {loading ? (
            <Text variant="small" color="mutedForeground">Calculating driving time…</Text>
          ) : estimate && miles != null ? (
            <>
              <Text variant="body"><Text variant="bodyMedium">{miles.toFixed(1)} mi</Text> · about <Text variant="bodyMedium">{formatEta(estimate.etaMinutes)}</Text> driving</Text>
              <Text variant="caption" color="mutedForeground">{estimate.source === 'google' ? 'By road, with current traffic.' : 'By road.'}</Text>
            </>
          ) : (
            <Text variant="small" color="mutedForeground">
              Driving time unavailable (location is off or the address could not be found).{' '}
              <Text variant="small" color="accent" accessibilityRole="link" onPress={() => void links.navigate(job.clientAddress)}>Open directions</Text>
            </Text>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  addressText: { flex: 1, minWidth: 0 },
  estimate: { borderRadius: radius.md, padding: spacing[3], gap: 2 },
});
