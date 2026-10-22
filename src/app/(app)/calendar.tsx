import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { addDays, format, isSameDay } from 'date-fns';
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
import { Button, DateTimeField, EmptyState, IconButton, Screen, SegmentedControl, Select, Sheet, SkeletonCard, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useTeamQuery } from '~/features/team/useTeam';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

type CalendarView = 'day' | 'list';
const ALL = 'all';

/** Calendar: swipe between days on the 24-hour grid, or a list; filters by employee ("All Employees") and status. */
export default function CalendarScreen() {
  const { colors } = useTheme();
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
  const activeFilters = (technician !== ALL ? 1 : 0) + (status !== ALL ? 1 : 0);

  return (
    <Screen padded={false} contentContainerStyle={styles.root}>
      <View style={styles.header}>
        <View style={styles.nav}>
          <IconButton icon={ChevronLeft} label="Previous day" variant="outline" onPress={() => setAnchor((a) => addDays(a, -1))} />
          <View style={styles.title}>
            <Text variant="title">{format(anchor, 'EEEE')}</Text>
            <Text variant="small" color="mutedForeground">{format(anchor, 'MMM d, yyyy')} · {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}</Text>
          </View>
          <IconButton icon={ChevronRight} label="Next day" variant="outline" onPress={() => setAnchor((a) => addDays(a, 1))} />
        </View>
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
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2], gap: spacing[2] },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, alignItems: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  grow: { flex: 1 },
  pad: { padding: spacing[4], gap: spacing[3] },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
});
