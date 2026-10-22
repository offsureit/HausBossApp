import { useEffect, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Info, MessageSquare } from 'lucide-react-native';
import { jobNumber } from '@/services/adapters/jobAdapter';
import { JobChat } from '~/components/jobs/JobChat';
import { Button, EmptyState, IconButton, StatusBadge, Text } from '~/components/ui';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** A job's team thread full-screen; opening it marks its chat notifications read. */
export default function ChatThreadScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const { notifications, markRead } = useNotifications();
  const job = useMemo(() => jobs.data?.find((j) => j.id === jobId) ?? null, [jobs.data, jobId]);

  useEffect(() => {
    notifications.filter((n) => n.type === 'chat_message' && n.job_id === jobId && !n.read_at).forEach((n) => void markRead(n.id));
  }, [notifications, jobId, markRead]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.background }]} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <Stack.Screen options={{ title: job ? job.clientName : 'Chat', headerBackTitle: 'Back', headerRight: job ? () => <IconButton icon={Info} label="Open job" onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })} /> : undefined }} />
      {!job ? (
        <View style={styles.pad}><EmptyState icon={MessageSquare} title="Job not found" action={<Button label="Back" variant="outline" onPress={() => router.back()} />} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}><Text variant="caption" color="mutedForeground">#{jobNumber(job.id)} · {job.assignedTo || 'Unassigned'}</Text><StatusBadge status={job.status} size="sm" /></View>
          <JobChat jobId={job.id} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { padding: spacing[4] },
  content: { padding: spacing[4], flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], paddingBottom: spacing[2] },
});
