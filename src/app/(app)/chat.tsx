import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { MessageSquare, Search } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { jobNumber } from '@/services/adapters/jobAdapter';
import { isClosedStatus } from '@/utils/jobStatus';
import { EmptyState, PressableScale, Screen, ScreenHeader, SkeletonCard, StatusBadge, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, spacing } from '~/theme/tokens';

/** Team chat: one thread per job (web `ChatPanel`); unread first, then open jobs, then by recency. */
export default function ChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { companyId } = useCompany();
  const { isContractor } = useAuth();
  const jobs = useJobsQuery(companyId);
  const { unreadChatByJob } = useNotifications();
  const { enterUp } = useMotion();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (jobs.data ?? [])
      .filter((j) => !q || j.clientName.toLowerCase().includes(q) || j.clientAddress.toLowerCase().includes(q) || j.assignedTo.toLowerCase().includes(q))
      .sort((a, b) => (unreadChatByJob.get(b.id) ?? 0) - (unreadChatByJob.get(a.id) ?? 0) || Number(isClosedStatus(a.status)) - Number(isClosedStatus(b.status)) || b.updatedAt.localeCompare(a.updatedAt));
  }, [jobs.data, query, unreadChatByJob]);
  const unreadTotal = useMemo(() => Array.from(unreadChatByJob.values()).reduce((a, b) => a + b, 0), [unreadChatByJob]);

  return (
    <Screen scroll refreshing={jobs.isRefetching} onRefresh={() => void jobs.refetch()} contentContainerStyle={styles.content}>
      <ScreenHeader title="Chat" subtitle={unreadTotal > 0 ? `${unreadTotal} unread` : isContractor ? 'Your job threads' : 'Team threads per job'} />
      <TextField label="Filter" value={query} onChangeText={setQuery} placeholder="Customer, address or technician" autoCorrect={false} leading={<Search size={18} color={colors.mutedForeground} />} />
      {jobs.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : list.length === 0 ? <EmptyState icon={MessageSquare} title="No jobs to chat about yet" message={query ? 'No jobs match the filter.' : 'Every job has a thread; it appears here once a job exists.'} />
        : (
          <View>
            {list.map((j, i) => {
              const unread = unreadChatByJob.get(j.id) ?? 0;
              return (
                <Animated.View key={j.id} entering={enterUp(i)}>
                  <PressableScale accessibilityRole="button" accessibilityLabel={`Open chat for ${j.clientName}${unread ? `, ${unread} unread` : ''}`} onPress={() => router.push({ pathname: '/chat/[jobId]', params: { jobId: j.id } })} scaleTo={0.985} style={[styles.row, { borderBottomColor: colors.border }]}>
                    <MessageSquare size={18} color={unread ? colors.accent : colors.mutedForeground} />
                    <View style={styles.grow}>
                      <View style={styles.head}>
                        <Text variant={unread ? 'bodyMedium' : 'body'} style={[styles.grow, unread > 0 ? { fontFamily: fontFamily.semibold } : null]}>{j.clientName}</Text>
                        {unread > 0 ? <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text variant="caption" color="accentForeground">{unread}</Text></View> : null}
                      </View>
                      <Text variant="caption" color="mutedForeground">#{jobNumber(j.id)} · {j.assignedTo || 'Unassigned'} · {formatDistanceToNowStrict(new Date(j.updatedAt), { addSuffix: true })}</Text>
                      <View style={styles.badgeRow}><StatusBadge status={j.status} size="sm" /></View>
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', marginTop: 2 },
});
