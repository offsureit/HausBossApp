import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { timeAgo } from '~/lib/time';
import { Activity, ArrowRightLeft, CalendarClock, FileText, Image as ImageIcon, Mail, MessageSquareText, PlusCircle, Send, UserCheck } from 'lucide-react-native';
import { jobStatusLabel } from '@/utils/jobStatus';
import type { ActivityLog, Employee } from '@/types';
import { EmptyState, SectionCard, Skeleton, Text, Timeline } from '~/components/ui';
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
    <SectionCard title="Activity" subtitle={`${logs.length} event${logs.length === 1 ? '' : 's'}`} icon={Activity}>
      <Timeline items={logs.map((log) => {
        const actor = names.get(log.user_id) ?? `User ${log.user_id.slice(0, 8)}`;
        const diffs = log.activity_type === 'created' ? [] : diffRows(log);
        return {
          key: log.id,
          icon: iconFor(log.activity_type),
          color: colorFor(log.activity_type, colors),
          title: (
            <View style={styles.item}>
              <Text variant="small" style={styles.strong}>{log.description}</Text>
              {diffs.map((d) => <Text key={d.key} variant="caption" color="mutedForeground">{d.key}: {d.from} → <Text variant="caption" color="foreground">{d.to}</Text></Text>)}
            </View>
          ),
          meta: `${actor} · ${timeAgo(log.created_at)}`,
        };
      })} />
    </SectionCard>
  );
}

/** Timeline dot colour per kind of event. */
function colorFor(type: string, colors: { accent: string; success: string; warning: string; mutedForeground: string }): string {
  if (type === 'created' || type === 'status_change') return colors.accent;
  if (type === 'assignment_change' || type === 'schedule_change') return colors.warning;
  if (type.startsWith('estimate') || type === 'sms_sent' || type === 'email_sent') return colors.success;
  return colors.mutedForeground;
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  item: { gap: 2 },
  strong: { fontFamily: 'Inter_600SemiBold' },
});
