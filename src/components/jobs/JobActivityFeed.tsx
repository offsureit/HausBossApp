import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { timeAgo } from '~/lib/time';
import { Activity, ArrowRightLeft, CalendarClock, FileText, Image as ImageIcon, Mail, MessageSquareText, PlusCircle, Send, UserCheck } from 'lucide-react-native';
import { jobStatusLabel } from '@/utils/jobStatus';
import type { ActivityLog, Employee } from '@/types';
import { EmptyState, Skeleton, Text } from '~/components/ui';
import { useJobActivity } from '~/features/jobs/useJobActivity';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

const ICONS: Record<string, typeof Activity> = {
  created: PlusCircle, status_change: ArrowRightLeft, assignment_change: UserCheck, schedule_change: CalendarClock, media_upload: ImageIcon, sms_sent: MessageSquareText, email_sent: Mail, estimate_sent: Send,
};
const iconFor = (type: string) => (type.startsWith('estimate') ? ICONS[type] ?? FileText : ICONS[type] ?? Activity);

function valueText(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') {
    const asDate = /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
    return asDate && !Number.isNaN(asDate.getTime()) ? asDate.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : jobStatusLabel(v);
  }
  return String(v);
}

function diffRows(log: ActivityLog): { key: string; from: string; to: string }[] {
  const oldV = (log.old_values ?? {}) as Record<string, unknown>;
  const newV = (log.new_values ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  return keys.filter((k) => oldV[k] !== newV[k] && (log.activity_type !== 'created' || newV[k] != null)).map((k) => ({ key: k.replace(/_/g, ' '), from: valueText(oldV[k]), to: valueText(newV[k]) }));
}

/** Per-job audit trail with realtime inserts (`job_activity_logs`). */
export function JobActivityFeed({ jobId, employees }: { jobId: string; employees: Employee[] }) {
  const { colors } = useTheme();
  const { logs, loading, error } = useJobActivity(jobId);
  const names = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  if (loading && logs.length === 0) return <View style={styles.list}><Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} /></View>;
  if (logs.length === 0) return <EmptyState icon={Activity} title="No activity recorded yet" message={error ?? undefined} />;

  return (
    <View style={[styles.list, styles.timeline, { borderLeftColor: colors.border }]} accessibilityRole="list">
      {logs.map((log) => {
        const Icon = iconFor(log.activity_type);
        const actor = names.get(log.user_id) ?? `User ${log.user_id.slice(0, 8)}`;
        const diffs = log.activity_type === 'created' ? [] : diffRows(log);
        return (
          <View key={log.id} style={styles.item}>
            <View style={[styles.icon, { backgroundColor: colors.card, borderColor: colors.border }]}><Icon size={12} color={colors.foreground} /></View>
            <Text variant="small">{log.description}</Text>
            {diffs.map((d) => <Text key={d.key} variant="caption" color="mutedForeground">{d.key}: {d.from} → {d.to}</Text>)}
            <Text variant="caption" color="mutedForeground">{actor} · {timeAgo(log.created_at)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  timeline: { borderLeftWidth: StyleSheet.hairlineWidth, marginLeft: 10, paddingLeft: spacing[4] },
  item: { gap: 2 },
  icon: { position: 'absolute', left: -(spacing[4] + 11), top: 0, width: 22, height: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
