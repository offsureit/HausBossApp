import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Clock, MapPin } from 'lucide-react-native';
import { isOverdue } from '@/utils/jobStatus';
import { lateLabel, runningLate, scheduleWindow } from '@/utils/schedule';
import type { Job } from '@/types';
import { Card, PressableScale, StatusBadge, Text } from '~/components/ui';
import { JobTimer } from '~/components/jobs/JobTimer';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

export interface JobCardProps {
  job: Job;
  /** Larger hero treatment (the technician's next job). */
  hero?: boolean;
  assigneeColor?: string | null;
  assigneeName?: string | null;
  /** Rendered under the card body (e.g. the primary action button). */
  footer?: ReactNode;
  /** Defaults to opening the job screen. */
  onPress?: () => void;
}

/** A job summary that opens the job hub. Nothing is truncated — names, addresses and descriptions wrap. */
export function JobCard({ job, hero = false, assigneeColor, assigneeName, footer, onPress }: JobCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const live = job.status === 'in-progress' || job.status === 'arrived' || job.status === 'en-route';
  const overdue = isOverdue(job);
  // The window ended and the technician has not arrived yet (same rule as the web).
  const lateSince = runningLate(job);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`Open job for ${job.clientName}, ${job.status}`} onPress={onPress ?? (() => router.push({ pathname: '/job/[id]', params: { id: job.id } }))} scaleTo={0.985}>
      <Card highlighted={live} padded={false} style={lateSince ? { borderColor: colors.destructive } : undefined}>
        <View style={styles.body}>
          <View style={styles.top}>
            <Text variant={hero ? 'title' : 'heading'} style={styles.name}>{job.clientName}</Text>
            <StatusBadge status={job.status} />
          </View>
          {lateSince ? (
            <View style={styles.metaRow}>
              <AlertTriangle size={14} color={colors.destructive} />
              <Text variant="caption" color="destructive" style={[styles.metaText, styles.late]}>{lateLabel(lateSince)}</Text>
            </View>
          ) : null}
          {job.jobDetails ? <Text variant={hero ? 'body' : 'small'} color="mutedForeground" numberOfLines={hero ? undefined : 3}>{job.jobDetails}</Text> : null}
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              {overdue && !lateSince ? <AlertTriangle size={14} color={colors.destructive} /> : <Clock size={14} color={colors.mutedForeground} />}
              <Text variant="caption" color={overdue && !lateSince ? 'destructive' : 'mutedForeground'} style={styles.metaText}>{overdue && !lateSince ? 'Overdue · ' : ''}{scheduleWindow(job.scheduledDate, job.durationMinutes)}</Text>
            </View>
            {job.clientAddress ? <View style={styles.metaRow}><MapPin size={14} color={colors.mutedForeground} /><Text variant="caption" color="mutedForeground" style={styles.metaText}>{job.clientAddress}</Text></View> : null}
            {assigneeName ? <View style={styles.metaRow}><View style={[styles.dot, { backgroundColor: assigneeColor ?? colors.mutedForeground }]} /><Text variant="caption" color="mutedForeground" style={styles.metaText}>{assigneeName}</Text></View> : null}
            {live && job.status === 'in-progress' ? <JobTimer entries={job.timeEntries} compact /> : null}
          </View>
        </View>
        {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[1] },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
  name: { flex: 1, minWidth: 0 },
  meta: { marginTop: spacing[1], gap: spacing[1] },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  metaText: { flex: 1, minWidth: 0 },
  late: { fontFamily: 'Inter_600SemiBold' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
});
