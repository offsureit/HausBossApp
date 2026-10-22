import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { BatteryMedium, MapPin, Navigation, ShieldCheck } from 'lucide-react-native';
import { Button, Sheet, Text } from '~/components/ui';
import { backgroundLocation, type BackgroundPermission } from '~/services/backgroundLocation';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

export interface LocationPermissionSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called with the final permission once the OS prompts are done (or skipped). */
  onDone: (permission: BackgroundPermission) => void;
  current?: BackgroundPermission;
}

/** Explainer shown before the OS location prompts (brief: "clear permission explainer screens before the OS prompt"). */
export function LocationPermissionSheet({ open, onClose, onDone, current = 'undetermined' }: LocationPermissionSheetProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const denied = current === 'denied';

  const proceed = async () => {
    setBusy(true);
    backgroundLocation.markExplained();
    const permission = await backgroundLocation.requestBackgroundPermission();
    setBusy(false);
    onDone(permission);
  };

  const rows = [
    { icon: Navigation, title: 'Dispatch sees your truck', body: 'Your position is sent every two minutes while a job is en route or in progress — never at other times.' },
    { icon: BatteryMedium, title: 'Easy on the battery', body: 'Low-accuracy mode, and reporting stops the moment you finish the job.' },
    { icon: ShieldCheck, title: 'Only your company', body: 'Only your dispatchers can see it. Nothing is shared with customers.' },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Share your location on jobs"
      description={Platform.OS === 'android' ? 'Choose “Allow all the time” on the next screen so it keeps working when your phone is in your pocket.' : 'Choose “Always allow” when iOS asks, so it keeps working when your phone is in your pocket.'}
      footer={
        <>
          {denied ? (
            <Button label="Open settings" size="lg" fullWidth icon={<MapPin size={18} color={colors.accentForeground} />} onPress={() => { void Linking.openSettings(); onClose(); }} />
          ) : (
            <Button label="Continue" size="lg" fullWidth icon={<MapPin size={18} color={colors.accentForeground} />} loading={busy} onPress={() => void proceed()} />
          )}
          <Button label="Not now" variant="ghost" fullWidth disabled={busy} onPress={() => { backgroundLocation.markExplained(); onDone(current); }} />
        </>
      }
    >
      <View style={styles.rows}>
        {rows.map(({ icon: Icon, title, body }) => (
          <View key={title} style={styles.row}>
            <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.1) }]}><Icon size={20} color={colors.accent} /></View>
            <View style={styles.text}>
              <Text variant="bodyMedium">{title}</Text>
              <Text variant="small" color="mutedForeground">{body}</Text>
            </View>
          </View>
        ))}
        {denied ? <Text variant="small" color="warning">Location is turned off for HausBoss. Allow it “all the time” in Settings to share your position on jobs.</Text> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing[4] },
  row: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
