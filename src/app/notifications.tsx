import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, CheckCheck, MessageSquare } from 'lucide-react-native';
import type { AppNotification } from '@/types';
import { Button, Card, EmptyState, PressableScale, Screen, SkeletonCard, Text, Toggle } from '~/components/ui';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { useSettings } from '~/features/settings/store';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, spacing, withAlpha } from '~/theme/tokens';

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
      <Stack.Screen options={{ title: 'Notifications', headerBackTitle: 'Back', headerRight: () => <Button label="Mark all read" variant="ghost" size="sm" icon={<CheckCheck size={14} color={colors.accent} />} onPress={() => void markAllRead()} disabled={unreadCount === 0} /> }} />
      <Card style={styles.prefs}>
        <Text variant="overline" color="mutedForeground">On this device</Text>
        <View style={styles.prefRow}><Text variant="small" style={styles.grow}>Haptic tap when a notification arrives</Text><Toggle value={prefs.haptic} onValueChange={(v) => setPrefs({ haptic: v })} accessibilityLabel="Haptic on notification" /></View>
        <View style={styles.prefRow}><Text variant="small" style={styles.grow}>In-app toasts</Text><Toggle value={prefs.toast} onValueChange={(v) => setPrefs({ toast: v })} accessibilityLabel="In-app toasts" /></View>
        <Text variant="caption" color={push.status === 'registered' ? 'success' : 'mutedForeground'}>{push.status === 'registered' ? 'Push notifications are on for this phone.' : push.status === 'denied' ? 'Push is off in your phone settings (More → Security & permissions).' : push.status === 'no-project' ? 'Push is not available in this build; alerts arrive while the app is open.' : push.status === 'pending' ? 'Registering for push…' : `Push: ${push.detail ?? push.status}`}</Text>
      </Card>
      {loading && notifications.length === 0 ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : notifications.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" message={error ?? undefined} />
        : (
          <View>
            {notifications.map((n) => (
              <PressableScale key={n.id} accessibilityRole="button" accessibilityLabel={`${n.title}${n.read_at ? '' : ', unread'}`} onPress={() => void open(n)} scaleTo={0.985} style={[styles.row, { borderBottomColor: colors.border }, !n.read_at && { backgroundColor: withAlpha(colors.accent, 0.05) }]}>
                <View style={[styles.dot, { backgroundColor: n.read_at ? 'transparent' : colors.accent }]} />
                <View style={styles.grow}>
                  <View style={styles.titleRow}>
                    {n.type === 'chat_message' ? <MessageSquare size={14} color={colors.mutedForeground} /> : null}
                    <Text variant="small" style={[styles.grow, !n.read_at && { fontFamily: fontFamily.semibold }]}>{n.title}</Text>
                  </View>
                  {n.body ? <Text variant="caption" color="mutedForeground">{n.body}</Text> : null}
                  <Text variant="caption" color="mutedForeground">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</Text>
                </View>
              </PressableScale>
            ))}
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], paddingVertical: spacing[3], paddingHorizontal: spacing[1], borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
