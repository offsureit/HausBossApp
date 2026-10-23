import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, isToday, isTomorrow } from 'date-fns';
import { AlertTriangle, Clock, MapPin } from 'lucide-react-native';
import { isOverdue, normalizeJobStatus } from '@/utils/jobStatus';
import { lateLabel, runningLate, scheduleWindow } from '@/utils/schedule';
import type { Job } from '@/types';
import { Card, PressableScale, StatusBadge, Text } from '~/components/ui';
import { JobTimer } from '~/components/jobs/JobTimer';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, statusColors, withAlpha } from '~/theme/tokens';

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

/** "Today" / "Tmrw" / "Oct 19", the start time and AM/PM, for the time tile. */
function timeParts(iso: string): { day: string; time: string; meridiem: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { day: isToday(d) ? 'Today' : isTomorrow(d) ? 'Tmrw' : format(d, 'MMM d'), time: format(d, 'h:mm'), meridiem: format(d, 'a') };
}

/**
 * A job summary that opens the job hub: a time tile tinted with the status colour, the customer and
 * status, then the details. A red strip on top when the arrival window has passed and the technician
 * has not arrived. Nothing is truncated — names, addresses and descriptions wrap.
 */
export function JobCard({ job, hero = false, assigneeColor, assigneeName, footer, onPress }: JobCardProps) {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const live = job.status === 'in-progress' || job.status === 'arrived' || job.status === 'en-route';
  const overdue = isOverdue(job);
  // The window ended and the technician has not arrived yet (same rule as the web).
  const lateSince = runningLate(job);
  const tint = statusColors[normalizeJobStatus(job.status)];
  const when = timeParts(job.scheduledDate);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`Open job for ${job.clientName}, ${job.status}${lateSince ? `, ${lateLabel(lateSince)}` : ''}`} onPress={onPress ?? (() => router.push({ pathname: '/job/[id]', params: { id: job.id } }))} scaleTo={0.985}>
      <Card highlighted={live && !lateSince} padded={false} level={hero ? 3 : 2} style={[styles.card, lateSince ? { borderColor: colors.destructive, borderWidth: 1.5 } : null]}>
        {lateSince ? (
          <View style={[styles.lateStrip, { backgroundColor: withAlpha(colors.destructive, scheme === 'dark' ? 0.2 : 0.1) }]}>
            <AlertTriangle size={14} color={colors.destructive} />
            <Text variant="caption" color="destructive" style={styles.strong}>{lateLabel(lateSince)}</Text>
          </View>
        ) : null}
        <View style={[styles.body, hero && styles.heroBody]}>
          <View style={[styles.timeTile, hero && styles.heroTile, { backgroundColor: withAlpha(tint, scheme === 'dark' ? 0.22 : 0.12) }]}>
            {when ? (
              <>
                <Text variant="caption" color="mutedForeground" style={styles.tileDay}>{when.day}</Text>
                <Text variant={hero ? 'title' : 'heading'} style={styles.tileTime}>{when.time}</Text>
                <Text variant="caption" color="mutedForeground" style={styles.strong}>{when.meridiem}</Text>
              </>
            ) : <Text variant="caption" color="mutedForeground">No date</Text>}
          </View>
          <View style={styles.main}>
            <View style={styles.top}>
              <Text variant={hero ? 'title' : 'heading'} style={styles.name}>{job.clientName}</Text>
              <StatusBadge status={job.status} />
            </View>
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
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  lateStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  body: { flexDirection: 'row', gap: spacing[3], padding: spacing[4] },
  heroBody: { paddingVertical: spacing[5] },
  timeTile: { width: 62, borderRadius: radius.md, paddingVertical: spacing[2], alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  heroTile: { width: 70, paddingVertical: spacing[3] },
  tileDay: { fontSize: 11, lineHeight: 14 },
  tileTime: { fontFamily: 'Inter_700Bold' },
  main: { flex: 1, minWidth: 0, gap: spacing[1] },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
  name: { flex: 1, minWidth: 0 },
  meta: { marginTop: spacing[1], gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  metaText: { flex: 1, minWidth: 0 },
  strong: { fontFamily: 'Inter_600SemiBold' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  footer: { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
});
