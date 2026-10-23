import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { format, isToday } from 'date-fns';
import { AlertTriangle, Briefcase, CalendarCheck2, CheckCircle2, Clock3, Wifi, WifiOff } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import type { Job, JobStatus } from '@/types';
import { JobCard } from '~/components/jobs/JobCard';
import { LocationPermissionSheet } from '~/components/location/LocationPermissionSheet';
import { OnMyWaySheet } from '~/components/jobs/OnMyWaySheet';
import { SwipeableJobRow } from '~/components/jobs/SwipeableJobRow';
import { primaryActionFor, type PrimaryActionKind } from '~/components/jobs/primaryAction';
import { Button, EmptyState, HeroHeader, HeroPill, HeroStat, Screen, SectionHeader, SkeletonCard, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { groupTechnicianJobs, isMine, nextJob } from '~/features/jobs/grouping';
import { useClockActions } from '~/features/jobs/useClockActions';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useLocationTracking } from '~/features/locations/useLocations';
import { backgroundLocation } from '~/services/backgroundLocation';
import { locationsService } from '~/services/locations';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Technician home: the next job as a hero with the big status action, then the rest of today / upcoming / completed (§8.4). */
export default function TodayScreen() {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const { companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const actions = useJobActions();
  const { enterUp } = useMotion();
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [onMyWay, setOnMyWay] = useState<Job | null>(null);
  const [clockJobId, setClockJobId] = useState<string | null>(null);
  const [explain, setExplain] = useState<Job | null>(null);

  const me = useMemo(() => (user ? { id: user.id, firstName: profile?.first_name, lastName: profile?.last_name } : null), [user, profile?.first_name, profile?.last_name]);
  const mine = useMemo(() => (jobs.data ?? []).filter((j) => isMine(j, me)), [jobs.data, me]);
  const groups = useMemo(() => groupTechnicianJobs(mine), [mine]);
  const hero = nextJob(groups);
  const rest = groups.today.filter((j) => j.id !== hero?.id);
  const activeJob = mine.some((j) => j.status === 'en-route' || j.status === 'in-progress');
  const tracking = useLocationTracking({ companyId, userId: user?.id, enabled: true, active: activeJob });

  const clockJob = useMemo(() => mine.find((j) => j.id === clockJobId) ?? null, [mine, clockJobId]);
  const clock = useClockActions({ job: clockJob, userId: user?.id, updateJob: actions.updateJob, updateJobStatus: actions.updateJobStatus, moveStatus: true, actorIsContractor: true });

  const move = async (job: Job, status: JobStatus) => {
    setBusyJob(job.id);
    const ok = await actions.updateJobStatus(job.id, status, { previousStatus: job.status, actorIsContractor: true });
    setBusyJob(null);
    return ok;
  };
  const act = (job: Job, kind: PrimaryActionKind) => {
    switch (kind) {
      case 'accept': return void move(job, 'accepted');
      case 'on-my-way':
        // First time: the explainer, then the OS prompts (foreground + "all the time"), then the sheet.
        if (!backgroundLocation.wasExplained() || tracking.permission === 'undetermined') return setExplain(job);
        return void locationsService.ensureForegroundPermission().then(() => setOnMyWay(job));
      case 'arrived': return void move(job, 'arrived');
      case 'clock-in': setClockJobId(job.id); return setTimeout(() => clock.clockIn(), 0);
      case 'complete': setClockJobId(job.id); return setTimeout(() => clock.complete(), 0);
      default: return undefined;
    }
  };
  const actionButton = (job: Job, size: 'md' | 'lg') => {
    const action = primaryActionFor(job.status);
    if (!action.kind) return null;
    const Icon = action.icon;
    const busy = busyJob === job.id || (clock.busy && clockJob?.id === job.id);
    return <Button label={action.label} size={size} fullWidth={size === 'lg'} icon={<Icon size={size === 'lg' ? 20 : 18} color={colors.accentForeground} />} loading={busy} onPress={() => act(job, action.kind)} />;
  };
  const firstName = profile?.first_name?.trim();
  const doneToday = groups.completed.filter((j) => j.updatedAt && isToday(new Date(j.updatedAt))).length;

  return (
    <Screen scroll hero refreshing={jobs.isRefetching} onRefresh={() => void jobs.refetch()}>
      <HeroHeader eyebrow={format(new Date(), 'EEEE, MMM d')} title={firstName ? `Hi ${firstName}` : 'My jobs'} subtitle={hero ? `Next: ${hero.clientName}` : 'You are all caught up'}>
        {activeJob ? (
          tracking.mode === 'background'
            ? <HeroPill icon={Wifi} label="Sharing location" tone="#bbf7d0" />
            : <HeroPill icon={AlertTriangle} label="Location only while open · Fix" tone="#fde68a" onPress={() => setExplain(hero ?? mine[0] ?? null)} />
        ) : null}
        <View style={styles.stats}>
          <HeroStat icon={Briefcase} value={groups.today.length} label="Jobs today" />
          <HeroStat icon={CheckCircle2} value={doneToday} label="Done today" />
          <HeroStat icon={Clock3} value={hero?.scheduledDate ? format(new Date(hero.scheduledDate), 'h:mm') : '—'} label={hero?.scheduledDate ? `Next · ${format(new Date(hero.scheduledDate), 'a')}` : 'Next job'} />
        </View>
      </HeroHeader>
      {jobs.isPending ? (
        <View style={styles.list}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
      ) : jobs.isError && !jobs.data ? (
        <EmptyState icon={WifiOff} title="Couldn't load your jobs" message={jobs.error.message} action={<Button label="Retry" variant="outline" onPress={() => void jobs.refetch()} />} />
      ) : (
        <>
          <Section title="Next up" count={hero ? 1 : 0}>
            {hero ? <Animated.View entering={enterUp(0)}><JobCard job={hero} hero footer={actionButton(hero, 'lg')} /></Animated.View> : <EmptyState icon={CalendarCheck2} title="Nothing scheduled for today" message="New assignments appear here as soon as they are made." tone="accent" />}
          </Section>
          {rest.length > 0 ? <Section title="Also today" count={rest.length}>{rest.map((j, i) => <Animated.View key={j.id} entering={enterUp(i + 1)}><SwipeableJobRow job={j} onAdvance={(job) => act(job, primaryActionFor(job.status).kind)}><JobCard job={j} footer={actionButton(j, 'md')} /></SwipeableJobRow></Animated.View>)}</Section> : null}
          <Section title="Upcoming" count={groups.upcoming.length}>
            {groups.upcoming.length === 0 ? <Text variant="small" color="mutedForeground">No upcoming jobs.</Text> : groups.upcoming.map((j, i) => <Animated.View key={j.id} entering={enterUp(i)}><JobCard job={j} /></Animated.View>)}
          </Section>
          <Section title="Completed" count={groups.completed.length}>
            {groups.completed.length === 0 ? <Text variant="small" color="mutedForeground">No completed jobs yet.</Text> : groups.completed.slice(0, 10).map((j, i) => <Animated.View key={j.id} entering={enterUp(i)}><JobCard job={j} /></Animated.View>)}
          </Section>
        </>
      )}
      <OnMyWaySheet open={!!onMyWay} job={onMyWay} onClose={() => setOnMyWay(null)} busy={busyJob === onMyWay?.id} onConfirm={() => (onMyWay ? move(onMyWay, 'en-route') : false)} />
      <LocationPermissionSheet
        open={!!explain}
        current={tracking.permission}
        onClose={() => setExplain(null)}
        onDone={() => { const job = explain; setExplain(null); void tracking.refresh(); if (job && primaryActionFor(job.status).kind === 'on-my-way') setTimeout(() => setOnMyWay(job), 350); }}
      />
      {clock.sheets}
    </Screen>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} count={count} />
      <View style={styles.list}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  list: { gap: spacing[3] },
  stats: { flexDirection: 'row', gap: spacing[2] },
});
