import { useCallback, useMemo, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNowStrict, isToday } from 'date-fns';
import { Activity, CheckCircle2, ChevronRight, Inbox, Plus, Search, Truck, Users, WifiOff, Wrench } from 'lucide-react-native';
import { getContractorColor } from '@/utils/contractorColors';
import { EMPLOYEE_ROLE_LABEL, assignableEmployees, employeeOptionLabel, isAssignedTo, openJobsFor } from '@/utils/employees';
import { JOB_STATUSES, JOB_STATUS_LABELS, isClosedStatus, isOverdue } from '@/utils/jobStatus';
import type { Employee, Job, JobStatus } from '@/types';
import { CheckStatusButton } from '~/components/dashboard/CheckStatusButton';
import { DispatchMap } from '~/components/dashboard/DispatchMap';
import { EmployeeSheet } from '~/components/dashboard/EmployeeSheet';
import { JobCard } from '~/components/jobs/JobCard';
import { ReassignSheet } from '~/components/jobs/ReassignSheet';
import { SwipeableJobRow } from '~/components/jobs/SwipeableJobRow';
import { Button, Card, EmptyState, IconButton, Screen, ScreenHeader, Select, Skeleton, SkeletonCard, StatusBadge, Text } from '~/components/ui';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useCompanyLocations } from '~/features/locations/useLocations';
import { useTeamQuery } from '~/features/team/useTeam';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';
import Animated from 'react-native-reanimated';

const ALL = 'all';

/** Staff dashboard: KPIs, the live dispatch map, the employee roster, the employee sheet with Reassign. */
export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { company, companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const team = useTeamQuery(companyId);
  const actions = useJobActions();
  const { locations, merge } = useCompanyLocations(companyId);
  const { enterUp } = useMotion();
  const [technician, setTechnician] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [selected, setSelected] = useState<Job | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [reassign, setReassign] = useState<Job | null>(null);

  const list = useMemo(() => jobs.data ?? [], [jobs.data]);
  const employees = useMemo(() => team.data ?? [], [team.data]);
  const people = useMemo(() => assignableEmployees(employees), [employees]);
  const person = useMemo(() => employees.find((e) => e.id === personId) ?? null, [employees, personId]);
  const colorFor = useCallback((emp: Employee | null, fallback: string) => getContractorColor(emp?.name ?? fallback, emp?.color), []);
  const visible = useMemo(() => list.filter((j) =>
    (technician === ALL || (() => { const e = employees.find((x) => x.id === technician); return !!e && isAssignedTo(j, e); })())
    && (statusFilter === ALL ? !isClosedStatus(j.status) || isOverdue(j) : j.status === statusFilter)), [list, technician, statusFilter, employees]);
  const visibleLocations = useMemo(() => (technician === ALL ? locations : new Map(Array.from(locations.entries()).filter(([id]) => id === technician))), [locations, technician]);

  const stats = useMemo(() => ({
    today: list.filter((j) => j.scheduledDate && isToday(new Date(j.scheduledDate))).length,
    inProgress: list.filter((j) => j.status === 'in-progress' || j.status === 'arrived' || j.status === 'en-route').length,
    completedToday: list.filter((j) => j.status === 'completed' && isToday(new Date(j.updatedAt))).length,
    located: locations.size,
  }), [list, locations.size]);
  const upcoming = useMemo(() => list.filter((j) => !isClosedStatus(j.status)).sort((a, b) => (a.scheduledDate || 'z').localeCompare(b.scheduledDate || 'z')).slice(0, 6), [list]);
  const assigneeOf = useCallback((job: Job) => employees.find((e) => isAssignedTo(job, e)) ?? null, [employees]);

  return (
    <Screen scroll refreshing={jobs.isRefetching} onRefresh={() => { void jobs.refetch(); void team.refetch(); }}>
      <ScreenHeader title="Dashboard" subtitle={company?.name} right={<><IconButton icon={Search} label="Search" variant="outline" onPress={() => router.push('/search')} /><IconButton icon={Plus} label="New job" variant="filled" tone="accent" onPress={() => router.push('/job/new')} /></>} />
      <View style={styles.kpis}>
        <Kpi icon={Activity} label="Jobs today" value={stats.today} color={colors.accent} loading={jobs.isPending} index={0} />
        <Kpi icon={Wrench} label="In progress" value={stats.inProgress} color="#3b82f6" loading={jobs.isPending} index={1} />
        <Kpi icon={CheckCircle2} label="Completed today" value={stats.completedToday} color={colors.success} loading={jobs.isPending} index={2} />
        <Kpi icon={Truck} label="Employees located" value={stats.located} color="#8b5cf6" loading={false} index={3} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="overline" color="mutedForeground">Live map</Text>
          <CheckStatusButton companyId={companyId} technicians={people.filter((p) => p.role === 'contractor')} onLocations={merge} />
        </View>
        <View style={styles.filters}>
          <View style={styles.grow}><Select label="Employee" value={technician} onChange={setTechnician} options={[{ value: ALL, label: 'All Employees' }, ...people.map((t) => ({ value: t.id, label: employeeOptionLabel(t), leading: <View style={[styles.dot, { backgroundColor: getContractorColor(t.name, t.color) }]} /> }))]} /></View>
          <View style={styles.grow}><Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: ALL, label: 'Open jobs' }, ...JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s as JobStatus] }))]} /></View>
        </View>
        <DispatchMap jobs={visible} locations={visibleLocations} employees={employees} colorFor={colorFor} onSelectJob={setSelected} onSelectEmployee={(id) => { setSelected(null); setPersonId(id); }} height={Math.min(420, Math.round(width * 0.9))} />
        {selected ? (
          <Card highlighted>
            <View style={styles.selectedHead}>
              <View style={styles.grow}>
                <Text variant="heading">{selected.clientName}</Text>
                <Text variant="caption" color="mutedForeground">{selected.clientAddress}</Text>
                {(() => { const a = assigneeOf(selected); return a ? <Pressable accessibilityRole="button" onPress={() => setPersonId(a.id)}><Text variant="caption" color="accent">{a.name}</Text></Pressable> : <Text variant="caption" color="mutedForeground">{selected.assignedTo || 'Unassigned'}</Text>; })()}
              </View>
              <StatusBadge status={selected.status} />
            </View>
            <View style={styles.selectedActions}>
              <Button label="Open" size="sm" onPress={() => router.push({ pathname: '/job/[id]', params: { id: selected.id } })} />
              <Button label="Reassign" size="sm" variant="outline" onPress={() => setReassign(selected)} />
              <Button label="Close" size="sm" variant="ghost" onPress={() => setSelected(null)} />
            </View>
          </Card>
        ) : null}
        <Text variant="caption" color="mutedForeground">{visible.length} job{visible.length === 1 ? '' : 's'} · {visibleLocations.size} employee{visibleLocations.size === 1 ? '' : 's'} located</Text>
        {technician !== ALL ? <Button label="View queue" variant="outline" size="sm" onPress={() => setPersonId(technician)} /> : null}
      </View>

      <View style={styles.section}>
        <Text variant="overline" color="mutedForeground">Employees</Text>
        {team.isPending ? <SkeletonCard /> : people.length === 0 ? <EmptyState icon={Users} title="No employees yet" /> : (
          <Card padded={false}>
            {people.map((e, i) => {
              const loc = locations.get(e.id);
              const count = openJobsFor(list, e).length;
              return (
                <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.name}: ${count} open job${count === 1 ? '' : 's'}`} onPress={() => setPersonId(e.id)} style={[styles.rosterRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.dot, { backgroundColor: getContractorColor(e.name, e.color) }]} />
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{e.name} <Text variant="caption" color="mutedForeground">· {EMPLOYEE_ROLE_LABEL[e.role]}</Text></Text>
                    <Text variant="caption" color="mutedForeground">{count} open job{count === 1 ? '' : 's'} · {loc ? `seen ${formatDistanceToNowStrict(new Date(loc.captured_at), { addSuffix: true })}` : 'no location'}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="overline" color="mutedForeground">Upcoming jobs</Text>
        {jobs.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
          : jobs.isError && !jobs.data ? <EmptyState icon={WifiOff} title="Couldn't load jobs" message={jobs.error.message} />
          : upcoming.length === 0 ? <EmptyState icon={Inbox} title="No open jobs" message="Everything is done. New jobs show up here." />
          : <View style={styles.list}>{upcoming.map((j, i) => { const a = assigneeOf(j); return <Animated.View key={j.id} entering={enterUp(i)}><SwipeableJobRow job={j} onAdvance={(job, status) => void actions.updateJobStatus(job.id, status, { previousStatus: job.status })} onReassign={setReassign}><JobCard job={j} assigneeName={a?.name ?? (j.assignedTo || 'Unassigned')} assigneeColor={a?.color} /></SwipeableJobRow></Animated.View>; })}</View>}
      </View>

      <EmployeeSheet employee={person} jobs={list} location={person ? locations.get(person.id) ?? null : null} onClose={() => setPersonId(null)} onReassign={(j) => { setPersonId(null); setReassign(j); }} />
      <ReassignSheet job={reassign} employees={employees} onClose={() => setReassign(null)} onUpdateJob={actions.updateJob} />
    </Screen>
  );
}

function Kpi({ icon: Icon, label, value, color, loading, index }: { icon: ComponentType<{ size?: number; color?: string }>; label: string; value: number; color: string; loading: boolean; index: number }) {
  const { enterUp } = useMotion();
  return (
    <Animated.View entering={enterUp(index)} style={styles.kpi}>
      <Card style={styles.kpiCard} accessible accessibilityLabel={`${label}: ${value}`}>
        <View style={[styles.kpiIcon, { backgroundColor: withAlpha(color, 0.12) }]}><Icon size={18} color={color} /></View>
        <View style={styles.grow}>
          {loading ? <Skeleton width={36} height={22} /> : <Text variant="title">{value}</Text>}
          <Text variant="caption" color="mutedForeground">{label}</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  kpi: { flexBasis: '47%', flexGrow: 1 },
  kpiCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  kpiIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0 },
  section: { gap: spacing[2] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filters: { flexDirection: 'row', gap: spacing[2] },
  list: { gap: spacing[3] },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
  selectedHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  selectedActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
});
