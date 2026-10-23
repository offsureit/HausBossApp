import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { Activity, Bell, CheckCheck, MessageCircle, MessageSquare } from 'lucide-react-native';
import type { AppNotification } from '@/types';
import { Card, EmptyState, HeroIconButton, PressableScale, Screen, SectionHeader, SkeletonCard, Text, Toggle } from '~/components/ui';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { useSettings } from '~/features/settings/store';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, radius, spacing, withAlpha } from '~/theme/tokens';

/** Notification centre (web `NotificationBell`): newest 50, tap opens the job, mark all read, device prefs. */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { notifications, unreadCount, loading, error, push, refresh, markRead, markAllRead } = useNotifications();
  const prefs = useSettings((s) => s.notifications);
  const setPrefs = useSettings((s) => s.setNotificationPrefs);

  const open = async (n: AppNotification) => {
    if (!n.read_at) await markRead(n.id);
    if (n.job_id) router.push({ pathname: '/job/[id]', params: { id: n.job_id, ...(n.type === 'chat_message' ? { tab: 'chat' } : {}) } });
  };

  return (
    <Screen scroll edges={['left', 'right']} refreshing={loading && notifications.length > 0} onRefresh={() => void refresh()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Notifications', headerBackTitle: 'Back', headerRight: () => <HeroIconButton icon={CheckCheck} label="Mark all read" onPress={() => void markAllRead()} disabled={unreadCount === 0} /> }} />
      <Card style={styles.prefs}>
        <Text variant="label">On this device</Text>
        <View style={styles.prefRow}><Text variant="small" style={styles.grow}>Haptic tap when a notification arrives</Text><Toggle value={prefs.haptic} onValueChange={(v) => setPrefs({ haptic: v })} accessibilityLabel="Haptic on notification" /></View>
        <View style={styles.prefRow}><Text variant="small" style={styles.grow}>In-app toasts</Text><Toggle value={prefs.toast} onValueChange={(v) => setPrefs({ toast: v })} accessibilityLabel="In-app toasts" /></View>
        <Text variant="caption" color={push.status === 'registered' ? 'success' : 'mutedForeground'}>{push.status === 'registered' ? 'Push notifications are on for this phone.' : push.status === 'denied' ? 'Push is off in your phone settings (More → Security & permissions).' : push.status === 'no-project' ? 'Push is not available in this build; alerts arrive while the app is open.' : push.status === 'pending' ? 'Registering for push…' : `Push: ${push.detail ?? push.status}`}</Text>
      </Card>
      {loading && notifications.length === 0 ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : notifications.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" message={error ?? undefined} />
        : (
          <View style={styles.list}>
            <SectionHeader title="Recent" count={unreadCount || undefined} />
            <Card padded={false}>
              {notifications.map((n, i) => {
                // Icon tile per kind: chat, customer text, or a job update.
                const kind = n.type === 'chat_message' ? { Icon: MessageSquare, color: colors.accent } : n.type === 'sms_received' ? { Icon: MessageCircle, color: colors.success } : { Icon: Activity, color: colors.warning };
                return (
                  <PressableScale key={n.id} accessibilityRole="button" accessibilityLabel={`${n.title}${n.read_at ? '' : ', unread'}`} onPress={() => void open(n)} scaleTo={0.985} style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, !n.read_at && { backgroundColor: withAlpha(colors.accent, 0.05) }]}>
                    <View style={[styles.tile, { backgroundColor: withAlpha(kind.color, 0.12) }]}><kind.Icon size={18} color={kind.color} /></View>
                    <View style={styles.grow}>
                      <Text variant="small" style={!n.read_at ? { fontFamily: fontFamily.semibold } : undefined}>{n.title}</Text>
                      {n.body ? <Text variant="caption" color="mutedForeground">{n.body}</Text> : null}
                      <Text variant="caption" color="mutedForeground">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</Text>
                    </View>
                    {!n.read_at ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                  </PressableScale>
                );
              })}
            </Card>
          </View>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[3] },
  prefs: { gap: spacing[2] },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4] },
  tile: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
});
