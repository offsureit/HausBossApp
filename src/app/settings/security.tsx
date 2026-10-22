import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { Bell, Fingerprint, Lock, MapPin, ScanFace } from 'lucide-react-native';
import { Button, Card, Screen, Text, Toggle } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useLock } from '~/features/auth/LockProvider';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { useSettings } from '~/features/settings/store';
import { toast } from '~/features/toast/store';
import { backgroundLocation, type BackgroundPermission } from '~/services/backgroundLocation';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

const LOCATION_LABEL: Record<BackgroundPermission, string> = {
  granted: 'Allowed all the time — shared every 2 minutes while you are on a job, even with the app closed.',
  foreground: 'Only while the app is open. Choose “Allow all the time” in Settings so dispatch can see your truck when the phone is in your pocket.',
  denied: 'Turned off. Allow location in Settings to share your position on jobs.',
  undetermined: 'Not asked yet — you will be asked when you start your first job.',
};

/** More → Security & permissions: biometric lock, location sharing, push status. */
export default function SecurityScreen() {
  const { colors } = useTheme();
  const { isContractor } = useAuth();
  const lock = useLock();
  const biometricLock = useSettings((s) => s.biometricLock);
  const { push } = useNotifications();
  const [locationPermission, setLocationPermission] = useState<BackgroundPermission>('undetermined');
  const [busy, setBusy] = useState(false);

  const refreshLocation = useCallback(() => { void backgroundLocation.getBackgroundPermission().then(setLocationPermission); }, []);
  useEffect(() => {
    refreshLocation();
    void lock.refreshAvailability();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { refreshLocation(); void push.retry(); } });
    return () => sub.remove();
  }, [refreshLocation, push, lock]);

  const toggleLock = async (on: boolean) => {
    setBusy(true);
    const ok = await lock.setEnabled(on);
    setBusy(false);
    if (ok) toast.success(on ? `${lock.availability?.label ?? 'Biometric'} unlock is on` : 'App lock is off');
  };

  const bioLabel = lock.availability?.label ?? 'Biometrics';
  const BioIcon = bioLabel === 'Face ID' || bioLabel === 'Face unlock' ? ScanFace : Fingerprint;
  const pushText = push.status === 'registered' ? 'On — this phone receives job, chat and text alerts even when the app is closed.'
    : push.status === 'denied' ? 'Notifications are turned off for HausBaus in your phone settings.'
      : push.status === 'no-project' ? 'Not available in this build (no EAS project id). In-app alerts still work while the app is open.'
        : push.status === 'unsupported' ? 'Push needs a physical device.'
          : push.status === 'error' ? `Could not register: ${push.detail ?? 'unknown error'}`
            : push.status === 'pending' ? 'Registering…' : 'Not registered.';

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <Section icon={BioIcon} title="App lock" description={lock.availability?.available ? `Require ${bioLabel} to open HausBaus (on launch and after 30 seconds in the background).` : 'Set up Face ID, fingerprint or a device passcode in your phone settings to use app lock.'}>
        <View style={styles.row}>
          <Text variant="small" style={styles.grow}>Unlock with {bioLabel}</Text>
          <Toggle value={biometricLock} disabled={busy || !lock.availability?.available} onValueChange={(v) => void toggleLock(v)} accessibilityLabel="Biometric app lock" />
        </View>
        {biometricLock ? <Button label="Lock now" variant="outline" icon={<Lock size={16} color={colors.foreground} />} onPress={lock.lockNow} /> : null}
      </Section>

      {isContractor ? (
        <Section icon={MapPin} title="Location sharing" description={LOCATION_LABEL[locationPermission]}>
          {locationPermission !== 'granted' ? <Button label="Open phone settings" variant="outline" onPress={() => void Linking.openSettings()} /> : null}
        </Section>
      ) : null}

      <Section icon={Bell} title="Push notifications" description={pushText}>
        {push.status === 'denied' ? <Button label="Open phone settings" variant="outline" onPress={() => void Linking.openSettings()} /> : null}
        {push.status === 'error' ? <Button label="Try again" variant="outline" onPress={() => void push.retry()} /> : null}
      </Section>
    </Screen>
  );
}

function Section({ icon: Icon, title, description, children }: { icon: typeof Lock; title: string; description: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.section}>
      <View style={styles.head}>
        <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.1) }]}><Icon size={18} color={colors.accent} /></View>
        <Text variant="heading" style={styles.grow}>{title}</Text>
      </View>
      <Text variant="small" color="mutedForeground">{description}</Text>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  tile: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
  grow: { flex: 1, minWidth: 0 },
});
