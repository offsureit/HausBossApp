import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Alert, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Bell, Boxes, CreditCard, Inbox, LogOut, Moon, Package, Search, ShieldCheck, Smartphone, Sun, Tags, UserRound, Users } from 'lucide-react-native';
import { EMPLOYEE_ROLE_LABEL } from '@/utils/employees';
import { fullName } from '@/utils/names';
import { primaryRole } from '@/services/adapters/employeeAdapter';
import { isConnected, onConnectionChange } from '~/api/realtime';
import { SettingsRow } from '~/components/settings/SettingsRow';
import { Avatar, Button, Card, PressableScale, Screen, ScreenHeader, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { type ThemeMode } from '~/features/settings/store';
import { API_URL } from '~/lib/env';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'System', icon: Smartphone },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

/** More (brief screen 10): customers, search, notifications, the settings sections, appearance, billing, sign out. */
export default function MoreScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { company } = useCompany();
  const { unreadCount } = useNotifications();
  const { colors, mode, setMode } = useTheme();
  const [live, setLive] = useState(isConnected());
  useEffect(() => onConnectionChange(setLive), []);

  const name = fullName({ firstName: auth.profile?.first_name, lastName: auth.profile?.last_name }) || auth.user?.email || '';
  const role = auth.roles.length ? EMPLOYEE_ROLE_LABEL[primaryRole(auth.roles)] : '';
  const staff = auth.isStaff;

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void auth.signOut() },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader title="More" />

      <Card style={styles.account}>
        <Avatar name={name} firstName={auth.profile?.first_name} lastName={auth.profile?.last_name} color={auth.profile?.color} size={52} />
        <View style={styles.accountText}>
          <Text variant="heading">{name}</Text>
          <Text variant="small" color="mutedForeground">{auth.user?.email}</Text>
          <Text variant="caption" color="mutedForeground">{[role, company?.name].filter(Boolean).join(' · ')}</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <Card padded={false}>
          <SettingsRow first icon={Search} label="Search" description={staff ? 'Jobs and customers' : 'Your jobs'} onPress={() => router.push('/search')} />
          <SettingsRow icon={Bell} label="Notifications" badge={unreadCount} onPress={() => router.push('/notifications')} />
          <SettingsRow icon={ShieldCheck} label="Security & permissions" description="App lock, location sharing, push" onPress={() => router.push('/settings/security')} />
          {staff ? <SettingsRow icon={UserRound} label="Customers" description="Records, job history, equipment, agreements" onPress={() => router.push('/customers')} /> : null}
          {staff ? <SettingsRow icon={Inbox} label="Leads" description="Requests from the public form" onPress={() => router.push('/settings/leads')} /> : null}
        </Card>
      </View>

      {staff ? (
        <View style={styles.section}>
          <Text variant="overline" color="mutedForeground">Company</Text>
          <Card padded={false}>
            <SettingsRow first icon={Package} label="Products & services" description="Price book for estimates" onPress={() => router.push('/settings/products')} />
            <SettingsRow icon={Boxes} label="Truck stock" description="Parts carried per technician" onPress={() => router.push('/settings/inventory')} />
            <SettingsRow icon={Tags} label="Job categories" onPress={() => router.push('/settings/categories')} />
            <SettingsRow icon={Users} label="Team" description={auth.isAdmin ? 'Invite, roles, access' : 'Roster'} onPress={() => router.push('/settings/team')} />
            <SettingsRow icon={CreditCard} label="Billing" description="Plan status (changes happen on the web)" onPress={() => router.push('/settings/billing')} />
          </Card>
        </View>
      ) : (
        <View style={styles.section}>
          <Card>
            <Text variant="bodyMedium">Settings are managed by your office</Text>
            <Text variant="caption" color="mutedForeground">Ask an admin to change company settings; your phone number and photo are edited from the team roster on the web.</Text>
          </Card>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="overline" color="mutedForeground">Appearance</Text>
        <View style={[styles.segment, { backgroundColor: colors.muted }]} accessibilityRole="radiogroup">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <PressableScale key={id} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={() => setMode(id)} style={[styles.segmentItem, active && { backgroundColor: colors.card }]}>
                <Icon size={16} color={active ? colors.accent : colors.mutedForeground} />
                <Text variant="label" color={active ? 'foreground' : 'mutedForeground'}>{label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="overline" color="mutedForeground">Connection</Text>
        <Card>
          <Row label="Server" value={API_URL} />
          <Row label="Realtime" value={live ? 'Connected' : 'Not connected'} valueColor={live ? 'success' : 'mutedForeground'} />
          <Row label="Access token" value={auth.session?.expires_at ? `renews ${format(new Date((auth.session.expires_at - 60) * 1000), 'h:mm a')}` : '—'} />
          <Row label="App version" value={`${Constants.expoConfig?.version ?? '—'} (${Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? 'dev'})`} last />
        </Card>
      </View>

      <Button label="Sign out" variant="destructive" icon={<LogOut size={18} color={colors.destructiveForeground} />} fullWidth onPress={confirmSignOut} />
    </Screen>
  );
}

function Row({ label, value, valueColor = 'foreground', last = false }: { label: string; value: string; valueColor?: 'foreground' | 'success' | 'mutedForeground'; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text variant="small" color="mutedForeground">{label}</Text>
      <Text variant="small" color={valueColor} style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  accountText: { flex: 1, minWidth: 0, gap: 2 },
  section: { gap: spacing[2] },
  segment: { flexDirection: 'row', padding: spacing[1], borderRadius: radius.md, gap: spacing[1] },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], paddingVertical: spacing[2], borderRadius: radius.sm, minHeight: 44 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3], paddingVertical: spacing[3] },
  rowValue: { flex: 1, textAlign: 'right' },
});
