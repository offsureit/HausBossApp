import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Clock, Play } from 'lucide-react-native';
import { calculateJobTotalTime, formatDuration } from '@/utils/timeCalculations';
import type { TimeEntry } from '@/types';
import { TimerRing } from '~/components/jobs/TimerRing';
import { Card, Text } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

export interface JobTimerProps {
  entries: readonly TimeEntry[] | null | undefined;
  compact?: boolean;
  showBreakdown?: boolean;
  /** Planned length; the ring fills over it (defaults to the current hour). */
  plannedMinutes?: number | null;
}

/** Live elapsed time (§14): ticks once a second only while a session is open; the full card shows the progress ring. */
export function JobTimer({ entries, compact = false, showBreakdown = false, plannedMinutes }: JobTimerProps) {
  const { colors } = useTheme();
  const hasOpenSession = useMemo(() => calculateJobTotalTime(entries).isCurrentlyActive, [entries]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!hasOpenSession) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [hasOpenSession]);
  const summary = useMemo(() => calculateJobTotalTime(entries, now), [entries, now]);
  const days = Object.entries(summary.byDay).sort(([a], [b]) => (a < b ? 1 : -1));

  if (compact) {
    return (
      <View style={styles.compact} accessibilityLiveRegion="polite">
        {summary.isCurrentlyActive ? <Play size={14} color={colors.success} /> : <Clock size={14} color={colors.mutedForeground} />}
        <Text variant={summary.isCurrentlyActive ? 'label' : 'caption'} color={summary.isCurrentlyActive ? 'success' : 'mutedForeground'} style={styles.mono}>{formatDuration(summary.totalMinutes)}</Text>
      </View>
    );
  }

  // Ring: share of the planned length, else the current hour's minutes.
  const progress = plannedMinutes && plannedMinutes > 0 ? Math.min(1, summary.totalMinutes / plannedMinutes) : (summary.totalMinutes % 60) / 60;

  return (
    <Card accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <TimerRing progress={progress} active={summary.isCurrentlyActive} size={112}>
          <Text variant="heading" style={styles.mono}>{formatDuration(summary.totalMinutes)}</Text>
          <Text variant="caption" color="mutedForeground">{plannedMinutes ? `of ${formatDuration(plannedMinutes)}` : 'total'}</Text>
        </TimerRing>
        <View style={styles.side}>
          <Text variant="overline" color="mutedForeground">Total time</Text>
          <View style={[styles.pill, { backgroundColor: summary.isCurrentlyActive ? withAlpha(colors.success, 0.12) : colors.muted }]}>
            <View style={[styles.dot, { backgroundColor: summary.isCurrentlyActive ? colors.success : colors.mutedForeground }]} />
            <Text variant="caption" color={summary.isCurrentlyActive ? 'success' : 'mutedForeground'}>{summary.isCurrentlyActive ? 'Clocked in' : 'Not clocked in'}</Text>
          </View>
          {summary.isCurrentlyActive && summary.activeSince ? <Text variant="caption" color="mutedForeground">Since {new Date(summary.activeSince).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text> : null}
        </View>
      </View>
      {showBreakdown && days.length > 0 ? (
        <View style={[styles.days, { borderTopColor: colors.border }]}>
          {days.map(([date, minutes]) => (
            <View key={date} style={styles.dayRow}>
              <Text variant="small" color="mutedForeground">{new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
              <Text variant="small" style={styles.mono}>{formatDuration(minutes)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mono: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  side: { flex: 1, minWidth: 0, gap: spacing[2], alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  days: { marginTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], gap: spacing[1] },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
