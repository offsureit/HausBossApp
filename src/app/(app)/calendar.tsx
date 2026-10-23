import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Plus } from 'lucide-react-native';
import { bucketJobsByLocalDay } from '@/components/calendarLayout';
import { getContractorColor } from '@/utils/contractorColors';
import { assignableEmployees, employeeOptionLabel } from '@/utils/employees';
import { JOB_STATUSES, JOB_STATUS_LABELS } from '@/utils/jobStatus';
import type { Job, JobStatus } from '@/types';
import { DayPager } from '~/components/calendar/DayPager';
import { JobCard } from '~/components/jobs/JobCard';
import { ReassignSheet } from '~/components/jobs/ReassignSheet';
import { SwipeableJobRow } from '~/components/jobs/SwipeableJobRow';
import { Button, DateTimeField, EmptyState, GradientBackdrop, HERO_TEXT_MUTED, HeroIconButton, IconButton, Screen, SegmentedControl, Select, Sheet, SkeletonCard, Text, useLightStatusBar } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useTeamQuery } from '~/features/team/useTeam';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

type CalendarView = 'day' | 'list';
const ALL = 'all';

/** Calendar: swipe between days on the 24-hour grid, or a list; filters by employee ("All Employees") and status. */
export default function CalendarScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const router = useRouter();
  const { isStaff } = useAuth();
  const { companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const team = useTeamQuery(companyId);
  const [view, setView] = useState<CalendarView>('day');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [technician, setTechnician] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [filters, setFilters] = useState(false);
  const [reassign, setReassign] = useState<Job | null>(null);
  const actions = useJobActions();

  const employees = useMemo(() => team.data ?? [], [team.data]);
  const people = useMemo(() => assignableEmployees(employees, { includeInactive: true }), [employees]);
  const colorFor = useCallback((job: Job) => {
    const emp = employees.find((e) => e.id === job.assignedUserId) ?? employees.find((e) => e.name.toLowerCase() === job.assignedTo.toLowerCase());
    return getContractorColor(job.assignedTo || null, emp?.color);
  }, [employees]);

  const filtered = useMemo(() => (jobs.data ?? []).filter((j) =>
    (technician === ALL || j.assignedUserId === technician || (technician === 'unassigned' && !j.assignedTo && !j.assignedUserId) || employees.find((e) => e.id === technician)?.name.toLowerCase() === j.assignedTo.toLowerCase())
    && (status === ALL || j.status === status)), [jobs.data, technician, status, employees]);
  const { byDay, unscheduled } = useMemo(() => bucketJobsByLocalDay(filtered), [filtered]);
  const dayJobs = useMemo(() => byDay.get(format(anchor, 'yyyy-MM-dd')) ?? [], [byDay, anchor]);
  const listJobs = useMemo(() => [...dayJobs, ...unscheduled].sort((a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || (a.scheduledDate || 'z').localeCompare(b.scheduledDate || 'z')), [dayJobs, unscheduled]);
  const week = useMemo(() => { const start = startOfWeek(anchor, { weekStartsOn: 1 }); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }, [anchor]);
  const activeFilters = (technician !== ALL ? 1 : 0) + (status !== ALL ? 1 : 0);

  return (
    <Screen padded={false} hero contentContainerStyle={styles.root}>
      {/* Gradient header: day navigation and a week strip (dots mark days with jobs). */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing[2] }]}>
        <GradientBackdrop watermark={false} />
        <View style={styles.nav}>
          <HeroIconButton icon={ChevronLeft} label="Previous week" onPress={() => setAnchor((a) => addDays(a, -7))} />
          <View style={styles.title}>
            <Text variant="title" color="#ffffff">{format(anchor, 'MMMM yyyy')}</Text>
            <Text variant="small" color={HERO_TEXT_MUTED}>{format(anchor, 'EEEE, MMM d')} · {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}</Text>
          </View>
          <HeroIconButton icon={ChevronRight} label="Next week" onPress={() => setAnchor((a) => addDays(a, 7))} />
        </View>
        <View style={styles.week} accessibilityRole="tablist">
          {week.map((d) => {
            const selected = isSameDay(d, anchor);
            const count = byDay.get(format(d, 'yyyy-MM-dd'))?.length ?? 0;
            return (
              <Pressable key={d.toISOString()} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={`${format(d, 'EEEE, MMMM d')}, ${count} job${count === 1 ? '' : 's'}`} onPress={() => setAnchor(d)} style={[styles.day, selected && styles.daySelected]}>
                <Text variant="caption" color={selected ? colors.primary : HERO_TEXT_MUTED} style={styles.dayName}>{format(d, 'EEEEE')}</Text>
                <Text variant="heading" color={selected ? colors.primary : '#ffffff'}>{format(d, 'd')}</Text>
                <View style={[styles.dayDot, { backgroundColor: count ? (selected ? colors.accent : '#ffffff') : 'transparent' }, isToday(d) && !count && { borderWidth: 1, borderColor: selected ? colors.accent : '#ffffff' }]} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.header}>
        <View style={styles.tools}>
          <Button label="Today" variant="outline" size="sm" onPress={() => setAnchor(new Date())} disabled={isSameDay(anchor, new Date())} />
          <Button label={activeFilters ? `Filters (${activeFilters})` : 'Filters'} variant={activeFilters ? 'secondary' : 'outline'} size="sm" onPress={() => setFilters(true)} />
          <View style={styles.grow}><SegmentedControl value={view} segments={[{ value: 'day', label: 'Day' }, { value: 'list', label: 'List' }]} onChange={setView} accessibilityLabel="Calendar view" /></View>
          {isStaff ? <IconButton icon={Plus} label="New job" variant="filled" tone="accent" onPress={() => router.push('/job/new')} /> : null}
        </View>
      </View>

      {jobs.isPending ? <View style={styles.pad}><SkeletonCard /><SkeletonCard /></View>
        : view === 'day' ? <DayPager anchor={anchor} onAnchorChange={setAnchor} jobsByDay={byDay} colorFor={colorFor} />
        : (
          <ScrollView contentContainerStyle={styles.pad}>
            {listJobs.length === 0 ? <EmptyState icon={Inbox} title="No jobs match these filters" message="Change the day or the filters, or create a job." /> : listJobs.map((j) => {
              const emp = employees.find((e) => e.id === j.assignedUserId) ?? employees.find((e) => e.name.toLowerCase() === j.assignedTo.toLowerCase());
              return <SwipeableJobRow key={j.id} job={j} onAdvance={isStaff ? (job, status) => void actions.updateJobStatus(job.id, status, { previousStatus: job.status }) : undefined} onReassign={isStaff ? setReassign : undefined}><JobCard job={j} assigneeName={emp?.name ?? (j.assignedTo || 'Unassigned')} assigneeColor={colorFor(j)} /></SwipeableJobRow>;
            })}
            {unscheduled.length > 0 && view === 'list' ? <Text variant="caption" color="mutedForeground">{unscheduled.length} unscheduled job{unscheduled.length === 1 ? '' : 's'} listed at the end.</Text> : null}
          </ScrollView>
        )}

      <ReassignSheet job={reassign} employees={employees} onClose={() => setReassign(null)} onUpdateJob={actions.updateJob} />
      <Sheet open={filters} onClose={() => setFilters(false)} title="Filters" footer={<Button label="Done" size="lg" fullWidth onPress={() => setFilters(false)} />}>
        <DateTimeField label="Jump to date" mode="date" value={anchor} onChange={(d) => d && setAnchor(d)} clearable={false} />
        <Select
          label="Employee"
          value={technician}
          onChange={setTechnician}
          options={[{ value: ALL, label: 'All Employees' }, { value: 'unassigned', label: 'Unassigned' }, ...people.map((t) => ({ value: t.id, label: employeeOptionLabel(t), leading: <View style={[styles.dot, { backgroundColor: getContractorColor(t.name, t.color) }]} /> }))]}
        />
        <Select label="Status" value={status} onChange={setStatus} options={[{ value: ALL, label: 'All statuses' }, ...JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s as JobStatus] }))]} />
        {activeFilters ? <Button label="Clear filters" variant="ghost" onPress={() => { setTechnician(ALL); setStatus(ALL); }} /> : null}
        <View style={styles.legend}><CalendarDays size={14} color={colors.mutedForeground} /><Text variant="caption" color="mutedForeground">Blocks are coloured by employee; the red line is now.</Text></View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2], gap: spacing[2] },
  hero: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3], borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl, overflow: 'hidden' },
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.md, gap: 2 },
  daySelected: { backgroundColor: '#ffffff' },
  dayName: { fontFamily: 'Inter_600SemiBold' },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, alignItems: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  grow: { flex: 1 },
  pad: { padding: spacing[4], gap: spacing[3] },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
});
