import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Boxes, CreditCard, Inbox, LogOut, Moon, Package, Search, ShieldCheck, Smartphone, Sun, Tags, UserRound, Users } from 'lucide-react-native';
import { EMPLOYEE_ROLE_LABEL } from '@/utils/employees';
import { fullName } from '@/utils/names';
import { primaryRole } from '@/services/adapters/employeeAdapter';
import { SettingsRow } from '~/components/settings/SettingsRow';
import { Avatar, Button, Card, HERO_TEXT_MUTED, HeroHeader, PressableScale, Screen, SectionHeader, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { type ThemeMode } from '~/features/settings/store';
import { useTheme } from '~/theme/ThemeProvider';
import { elevation, radius, spacing } from '~/theme/tokens';

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
  const { colors, scheme, mode, setMode } = useTheme();

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
    <Screen scroll hero>
      <HeroHeader title="More" eyebrow={company?.name}>
        <View style={styles.account}>
          <View style={styles.avatarRing}><Avatar name={name} firstName={auth.profile?.first_name} lastName={auth.profile?.last_name} color={auth.profile?.color} size={56} /></View>
          <View style={styles.accountText}>
            <Text variant="heading" color="#ffffff">{name}</Text>
            <Text variant="small" color={HERO_TEXT_MUTED}>{auth.user?.email}</Text>
            {role ? <View style={styles.rolePill}><Text variant="caption" color="#ffffff" style={styles.roleText}>{role}</Text></View> : null}
          </View>
        </View>
      </HeroHeader>

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
          <SectionHeader title="Company" />
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
        <SectionHeader title="Appearance" />
        <View style={[styles.segment, { backgroundColor: colors.muted }]} accessibilityRole="radiogroup">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <PressableScale key={id} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={() => setMode(id)} style={[styles.segmentItem, active && [{ backgroundColor: colors.card }, elevation(1, scheme)]]}>
                <Icon size={16} color={active ? colors.accent : colors.mutedForeground} />
                <Text variant="label" color={active ? 'foreground' : 'mutedForeground'}>{label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <Button label="Sign out" variant="danger-ghost" size="lg" icon={<LogOut size={18} color={colors.destructive} />} fullWidth onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatarRing: { padding: 3, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.22)' },
  accountText: { flex: 1, minWidth: 0, gap: 2 },
  rolePill: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  roleText: { fontFamily: 'Inter_600SemiBold' },
  section: { gap: spacing[3] },
  segment: { flexDirection: 'row', padding: spacing[1], borderRadius: radius.full, gap: spacing[1] },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], paddingVertical: spacing[2], borderRadius: radius.full, minHeight: 44 },
});
