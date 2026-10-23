import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, isToday } from 'date-fns';
import { AlertTriangle } from 'lucide-react-native';
import { MINUTES_PER_DAY, arrivalWindow, layoutDay, minutesFromMidnight, type PositionedJob } from '@/components/calendarLayout';
import { jobNumber } from '@/services/adapters/jobAdapter';
import { isOverdue, jobStatusLabel } from '@/utils/jobStatus';
import { lateLabel, runningLate } from '@/utils/schedule';
import type { Job } from '@/types';
import { Text } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, statusColors, withAlpha } from '~/theme/tokens';

export const HOUR_HEIGHT = 64;
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const GUTTER = 48;

export interface DayTimelineProps {
  day: Date;
  jobs: Job[];
  colorFor: (job: Job) => string;
  /** Scroll to the first job (else 7 am) when the day becomes visible. */
  active: boolean;
}

/** One day of the 24-hour grid; overlapping jobs share the column width (web `CalendarTimeGrid`). */
export function DayTimeline({ day, jobs, colorFor, active }: DayTimelineProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const layout = useMemo(() => layoutDay(jobs), [jobs]);
  const [nowMinutes, setNowMinutes] = useState(() => minutesFromMidnight(new Date()));
  const today = isToday(day);

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(minutesFromMidnight(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  const dayKey = format(day, 'yyyy-MM-dd');
  useEffect(() => {
    if (!active) return;
    const first = layout.reduce<number | null>((min, p) => (min === null || p.startMinutes < min ? p.startMinutes : min), null);
    const target = Math.max(0, ((first ?? 7 * 60) - 60) * PX_PER_MINUTE);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: false }), 0);
    return () => clearTimeout(t);
    // Scroll when the visible day changes, not on every job update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, active]);

  return (
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ height: 24 * HOUR_HEIGHT + spacing[8] }} showsVerticalScrollIndicator={false}>
      <View style={styles.gutter} pointerEvents="none">
        {Array.from({ length: 24 }, (_, h) => (
          <Text key={h} variant="caption" color="mutedForeground" style={[styles.hour, { top: h * HOUR_HEIGHT - 8 }]}>{h === 0 ? '' : format(new Date(2000, 0, 1, h), 'h a')}</Text>
        ))}
      </View>
      <View style={[styles.column, { borderLeftColor: colors.border }, today && { backgroundColor: withAlpha(colors.accent, 0.03) }]} accessibilityLabel={format(day, 'EEEE, MMMM d')}>
        {Array.from({ length: 24 }, (_, h) => <View key={h} style={[styles.hourLine, { top: h * HOUR_HEIGHT, borderTopColor: withAlpha(colors.border, 0.8) }]} />)}
        {today && nowMinutes >= 0 && nowMinutes <= MINUTES_PER_DAY ? (
          <View pointerEvents="none" style={[styles.now, { top: nowMinutes * PX_PER_MINUTE, borderTopColor: colors.destructive }]}><View style={[styles.nowDot, { backgroundColor: colors.destructive }]} /></View>
        ) : null}
        {layout.map((p) => <JobBlock key={p.job.id} p={p} color={colorFor(p.job)} onPress={() => router.push({ pathname: '/job/[id]', params: { id: p.job.id } })} />)}
      </View>
    </ScrollView>
  );
}

function JobBlock({ p, color, onPress }: { p: PositionedJob; color: string; onPress: () => void }) {
  const { colors, scheme } = useTheme();
  const lateSince = runningLate(p.job);
  // Pending past its start, or the window ended before the technician arrived (same rule as the web).
  const overdue = isOverdue(p.job) || !!lateSince;
  const label = jobStatusLabel(p.job.status);
  const widthPct = 100 / p.columns;
  const status = statusColors[p.job.status];
  const height = Math.max(32, (p.endMinutes - p.startMinutes) * PX_PER_MINUTE - 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.job.clientName}, ${label}${lateSince ? `, ${lateLabel(lateSince)}` : ''}, ${arrivalWindow(p.startMinutes, p.endMinutes - p.startMinutes)}`}
      onPress={onPress}
      style={[
        styles.block,
        { top: p.startMinutes * PX_PER_MINUTE, height, left: `${p.column * widthPct}%`, width: `${widthPct}%`, backgroundColor: withAlpha(status, scheme === 'dark' ? 0.22 : 0.12), borderLeftColor: color, borderColor: overdue ? colors.destructive : withAlpha(status, 0.35) },
      ]}
    >
      <Text variant="caption" style={styles.blockTitle} numberOfLines={height < 48 ? 1 : 2}>{p.job.clientName}</Text>
      {/* What the technician is doing now (On My Way, At Job Site…), plus Late when the window has passed. */}
      <Text variant="caption" style={styles.blockStatus} numberOfLines={1}>{label}{lateSince ? <Text variant="caption" color="destructive" style={styles.blockStatus}> · Late</Text> : null}</Text>
      {height >= 64 ? <Text variant="caption" color="mutedForeground" numberOfLines={1}>{arrivalWindow(p.startMinutes, p.endMinutes - p.startMinutes)}</Text> : null}
      {height >= 80 ? <Text variant="caption" color="mutedForeground" numberOfLines={1}>#{jobNumber(p.job.id)} · {p.job.assignedTo || 'Unassigned'}</Text> : null}
      {overdue ? <AlertTriangle size={12} color={colors.destructive} style={styles.overdue} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  gutter: { position: 'absolute', left: 0, top: 0, bottom: 0, width: GUTTER },
  hour: { position: 'absolute', right: spacing[1], fontSize: 10 },
  column: { marginLeft: GUTTER, flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, height: 24 * HOUR_HEIGHT, position: 'relative' },
  hourLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  now: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, zIndex: 10 },
  nowDot: { position: 'absolute', left: -4, top: -5, width: 8, height: 8, borderRadius: 4 },
  block: { position: 'absolute', borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, paddingHorizontal: 6, paddingVertical: 3, marginHorizontal: 2, overflow: 'hidden' },
  blockTitle: { fontFamily: 'Inter_600SemiBold' },
  blockStatus: { fontFamily: 'Inter_500Medium' },
  overdue: { position: 'absolute', right: 4, top: 4 },
});
