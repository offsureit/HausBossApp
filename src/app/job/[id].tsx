import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, AlertTriangle, Camera, CheckCircle2, ClipboardList, Clock, FileText, Info, LogIn, LogOut, Mail, MapPin, MessageSquare, MessageSquareText, Navigation, Phone, Receipt, StickyNote, UserCog, UserRound, Wrench } from 'lucide-react-native';
import { jobNumber } from '@/services/adapters/jobAdapter';
import { getContractorColor } from '@/utils/contractorColors';
import { formatLength } from '@/components/calendarLayout';
import { fullName, matchesAssignedName } from '@/utils/names';
import { lateLabel, runningLate, scheduleWindow } from '@/utils/schedule';
import type { Job, JobStatus } from '@/types';
import { Confetti } from '~/components/motion/Confetti';
import { EstimateList } from '~/components/jobs/EstimateList';
import { JobActivityFeed } from '~/components/jobs/JobActivityFeed';
import { JobChat } from '~/components/jobs/JobChat';
import { JobDetailsEditor } from '~/components/jobs/JobDetailsEditor';
import { JobStatusStepper } from '~/components/jobs/JobStatusStepper';
import { JobTimer } from '~/components/jobs/JobTimer';
import { MediaSection } from '~/components/jobs/MediaSection';
import { OnMyWaySheet } from '~/components/jobs/OnMyWaySheet';
import { LocationPermissionSheet } from '~/components/location/LocationPermissionSheet';
import { ReassignSheet } from '~/components/jobs/ReassignSheet';
import { primaryActionFor } from '~/components/jobs/primaryAction';
import { Button, EmptyState, GradientBackdrop, HERO_TEXT_MUTED, IconButton, InfoRow, SectionCard, Skeleton, StatusBadge, Tabs, Text, Timeline } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useClockActions } from '~/features/jobs/useClockActions';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useTeamQuery } from '~/features/team/useTeam';
import { toast } from '~/features/toast/store';
import { links } from '~/lib/links';
import { backgroundLocation } from '~/services/backgroundLocation';
import { locationsService } from '~/services/locations';
import { messagesService } from '~/services/messages';
import { useTheme } from '~/theme/ThemeProvider';
import { fieldSurface, fontFamily, radius, spacing, withAlpha } from '~/theme/tokens';

type Tab = 'details' | 'time' | 'media' | 'chat' | 'estimates' | 'activity' | 'notes';
const TABS: { value: Tab; label: string; icon: typeof Info }[] = [
  { value: 'details', label: 'Details', icon: Info }, { value: 'time', label: 'Time', icon: Clock }, { value: 'media', label: 'Media', icon: Camera }, { value: 'chat', label: 'Chat', icon: MessageSquare },
  { value: 'estimates', label: 'Estimates', icon: FileText }, { value: 'activity', label: 'Activity', icon: Activity }, { value: 'notes', label: 'Notes', icon: StickyNote },
];
const DIVISION_LABEL: Record<string, string> = { residential: 'Residential', commercial: 'Commercial' };

/** The job hub: details, time, media, chat, estimates, activity, notes (web `JobDetailsModal`). */
export default function JobScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, profile, isStaff, isContractor } = useAuth();
  const { company, companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const team = useTeamQuery(companyId);
  const actions = useJobActions();
  const job = useMemo(() => jobs.data?.find((j) => j.id === id) ?? null, [jobs.data, id]);
  const employees = useMemo(() => team.data ?? [], [team.data]);
  const [tab, setTab] = useState<Tab>(initialTab && TABS.some((t) => t.value === initialTab) ? initialTab : 'details');
  const [onMyWay, setOnMyWay] = useState(false);
  const [explain, setExplain] = useState(false);
  const [reassign, setReassign] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const assignee = useMemo(() => job && (employees.find((e) => e.id === job.assignedUserId) ?? employees.find((e) => matchesAssignedName(job.assignedTo, { firstName: e.firstName, lastName: e.lastName }))), [job, employees]);
  const isAssignee = !!job && !!user && (job.assignedUserId === user.id || (!job.assignedUserId && matchesAssignedName(job.assignedTo, { firstName: profile?.first_name, lastName: profile?.last_name })));
  const canControlTime = isStaff || isAssignee;
  const clock = useClockActions({ job, userId: user?.id, updateJob: actions.updateJob, updateJobStatus: actions.updateJobStatus, moveStatus: isContractor, actorIsContractor: isContractor });
  const [burst, setBurst] = useState<number | null>(null);
  const pendingBurst = useRef(false);
  const lastStatus = useRef<JobStatus | null>(null);
  useEffect(() => {
    // Confetti when this job becomes completed while open (own action or a realtime echo),
    // held until the clock sheets have closed so the burst is not hidden behind the modal.
    if (job && lastStatus.current && lastStatus.current !== 'completed' && job.status === 'completed') pendingBurst.current = true;
    lastStatus.current = job?.status ?? null;
    if (pendingBurst.current && !clock.busy) { pendingBurst.current = false; const t = setTimeout(() => setBurst(Date.now()), 350); return () => clearTimeout(t); }
    return undefined;
  }, [job, clock.busy]);

  const move = useCallback(async (status: JobStatus) => {
    if (!job) return false;
    setBusy('status');
    const ok = await actions.updateJobStatus(job.id, status, { previousStatus: job.status, actorIsContractor: isContractor, isStaff });
    setBusy(null);
    return ok;
  }, [job, actions, isContractor, isStaff]);

  const primary = job ? primaryActionFor(job.status) : null;
  const onPrimary = () => {
    if (!job || !primary) return;
    switch (primary.kind) {
      case 'accept': return void move('accepted');
      case 'on-my-way':
        if (isContractor && !backgroundLocation.wasExplained()) return setExplain(true);
        return void locationsService.ensureForegroundPermission().then(() => setOnMyWay(true));
      case 'arrived': return void move('arrived');
      case 'clock-in': return clock.clockIn();
      case 'complete': return clock.complete();
      default: return undefined;
    }
  };

  if (jobs.isPending && !job) {
    return <View style={[styles.root, { backgroundColor: colors.background }]}><Stack.Screen options={{ title: 'Job' }} /><View style={styles.pad}><Skeleton height={28} width="60%" /><Skeleton height={16} width="40%" /><Skeleton height={120} /></View></View>;
  }
  if (!job) {
    return <View style={[styles.root, { backgroundColor: colors.background }]}><Stack.Screen options={{ title: 'Job' }} /><View style={styles.pad}><EmptyState icon={Info} title="Job not found" message="It may have been reassigned or removed." action={<Button label="Back" variant="outline" onPress={() => router.back()} />} /></View></View>;
  }

  const unit = job.businessUnitId ? company?.businessUnits.find((u) => u.id === job.businessUnitId) : null;
  const lateSince = runningLate(job);
  const PrimaryIcon = primary?.icon ?? CheckCircle2;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Job details', headerBackTitle: 'Back', headerRight: isStaff ? () => <IconButton icon={UserCog} label="Reassign" onPress={() => setReassign(true)} /> : undefined }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={styles.pad}>
          <Confetti burst={burst} />
          {/* Hero card: the brand gradient with the job's identity and the quick actions. */}
          <View style={styles.heroCard}>
            <GradientBackdrop rounded={radius.xxl} />
            <View style={styles.badges}>
              <Text variant="mono" color={HERO_TEXT_MUTED}>#{jobNumber(job.id)}</Text>
              <StatusBadge status={job.status} />
              {job.priority && job.priority !== 'medium' ? <View style={styles.heroChip}><Text variant="caption" color="#ffffff">{job.priority}</Text></View> : null}
            </View>
            <Text variant="display" color="#ffffff">{job.clientName}</Text>
            <View style={styles.metaRow}><Clock size={14} color={HERO_TEXT_MUTED} /><Text variant="small" color={HERO_TEXT_MUTED}>{scheduleWindow(job.scheduledDate, job.durationMinutes)}</Text></View>
            <View style={styles.metaRow}><View style={[styles.dot, { backgroundColor: getContractorColor(assignee?.name ?? job.assignedTo, assignee?.color) }]} /><Text variant="small" color={HERO_TEXT_MUTED}>{assignee?.name || job.assignedTo || 'Unassigned'}</Text></View>
            {lateSince ? <View style={styles.heroLate}><AlertTriangle size={14} color="#ffffff" /><Text variant="caption" color="#ffffff" style={styles.strong}>{lateLabel(lateSince)}</Text></View> : null}
            <View style={styles.quick}>
            {job.clientPhone ? <QuickAction icon={Phone} label="Call" onPress={() => void links.call(job.clientPhone)} /> : null}
            {job.clientPhone ? <QuickAction icon={MessageSquareText} label="Text" onPress={() => void links.sms(job.clientPhone)} /> : null}
            {job.clientAddress ? <QuickAction icon={Navigation} label="Navigate" onPress={() => void links.navigate(job.clientAddress)} /> : null}
            {job.clientEmail ? <QuickAction icon={Mail} label="Email" onPress={() => void links.email(job.clientEmail)} /> : null}
            </View>
          </View>
          {isStaff ? <JobStatusStepper status={job.status} isStaff onChange={(s) => void move(s)} disabled={busy === 'status'} /> : null}
          {isContractor && isAssignee && primary?.kind ? (
            <Button label={primary.label} size="lg" fullWidth icon={<PrimaryIcon size={20} color={colors.accentForeground} />} loading={busy === 'status' || clock.busy} onPress={onPrimary} />
          ) : null}
        </View>
        <View style={{ backgroundColor: colors.background }}><Tabs value={tab} items={TABS} onChange={setTab} /></View>
        <View style={styles.pad}>
          {tab === 'details' ? (
            <View style={styles.section}>
              <SectionCard title={[job.clientSalutation, job.clientName].filter(Boolean).join(' ')} subtitle="Customer" icon={UserRound} flush>
                {contactRows([
                  { icon: Phone, label: `Phone${job.clientPhoneType ? ` · ${job.clientPhoneType}` : ''}`, value: job.clientPhone, onPress: () => void links.call(job.clientPhone) },
                  { icon: Phone, label: `Second phone${job.clientPhone2Type ? ` · ${job.clientPhone2Type}` : ''}`, value: job.clientPhone2, onPress: () => void links.call(job.clientPhone2) },
                  { icon: Mail, label: `Email${job.clientEmailType ? ` · ${job.clientEmailType}` : ''}`, value: job.clientEmail, onPress: () => void links.email(job.clientEmail) },
                  { icon: Mail, label: `Second email${job.clientEmail2Type ? ` · ${job.clientEmail2Type}` : ''}`, value: job.clientEmail2, onPress: () => void links.email(job.clientEmail2) },
                  { icon: MapPin, label: 'Service address', value: job.clientAddress, onPress: () => void links.navigate(job.clientAddress) },
                ])}
              </SectionCard>
              {job.billingName || job.billingAddress || job.billingPhone || job.billingEmail ? (
                <SectionCard title="Billing" icon={Receipt} color={colors.success} flush>
                  {contactRows([
                    { icon: UserRound, label: 'Bill to', value: job.billingName },
                    { icon: MapPin, label: 'Billing address', value: job.billingAddress },
                    { icon: Phone, label: 'Billing phone', value: job.billingPhone, onPress: () => void links.call(job.billingPhone) },
                    { icon: Mail, label: 'Billing email', value: job.billingEmail, onPress: () => void links.email(job.billingEmail) },
                  ])}
                </SectionCard>
              ) : null}
              {unit || job.division || job.serviceType || job.durationMinutes ? (
                <SectionCard title="Service" icon={Wrench} color={colors.warning}>
                  <View style={styles.facts}>
                    {unit ? <Fact label="Business unit" value={unit.name} /> : null}
                    {job.division ? <Fact label="Division" value={DIVISION_LABEL[job.division]} /> : null}
                    {job.serviceType ? <Fact label="Service type" value={job.serviceType} /> : null}
                    {job.durationMinutes ? <Fact label="Length" value={formatLength(job.durationMinutes)} /> : null}
                    {!isStaff && job.category ? <Fact label="Category" value={job.category} /> : null}
                  </View>
                </SectionCard>
              ) : null}
              {isStaff ? <JobDetailsEditor job={job} employees={employees} onUpdateJob={actions.updateJob} /> : (
                <SectionCard title="Job description" icon={ClipboardList}>
                  <Text variant="body">{job.jobDetails || 'No description.'}</Text>
                  {job.importantDetails ? <View style={[styles.important, { backgroundColor: withAlpha(colors.warning, 0.1), borderColor: withAlpha(colors.warning, 0.35) }]}><AlertTriangle size={16} color={colors.warning} /><Text variant="small" style={styles.grow}><Text variant="label" color="warning">Important: </Text>{job.importantDetails}</Text></View> : null}
                </SectionCard>
              )}
            </View>
          ) : null}
          {tab === 'time' ? (
            <View style={styles.section}>
              <JobTimer entries={job.timeEntries} showBreakdown plannedMinutes={job.durationMinutes ?? null} />
              {canControlTime && job.status !== 'completed' ? (
                <View style={styles.timeActions}>
                  {clock.isActive ? (
                    <>
                      <Button label="Clock out" variant="outline" size="lg" style={styles.grow} icon={<LogOut size={18} color={colors.foreground} />} onPress={clock.clockOut} disabled={clock.busy} />
                      <Button label="Complete job" size="lg" style={styles.grow} icon={<CheckCircle2 size={18} color={colors.accentForeground} />} onPress={clock.complete} loading={clock.busy} />
                    </>
                  ) : <Button label="Clock in" size="lg" style={styles.grow} icon={<LogIn size={18} color={colors.accentForeground} />} onPress={clock.clockIn} loading={clock.busy} />}
                </View>
              ) : null}
              {job.status === 'completed' ? <View style={[styles.notice, { backgroundColor: withAlpha(colors.success, 0.1) }]}><CheckCircle2 size={16} color={colors.success} /><Text variant="small" color="success" style={styles.grow}>This job is completed; time is no longer accruing.</Text></View> : null}
              {job.timeEntries.length > 0 ? (
                <SectionCard title="Time entries" subtitle={`${job.timeEntries.length} entr${job.timeEntries.length === 1 ? 'y' : 'ies'}`} icon={Clock}>
                  <Timeline items={[...job.timeEntries].reverse().map((e, i) => ({
                    key: `${e.timestamp}-${i}`,
                    title: ENTRY_LABEL[e.type] ?? e.type,
                    meta: `${new Date(e.timestamp).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${e.notes ? ` · ${e.notes}` : ''}`,
                    color: e.type === 'start' ? colors.success : e.type === 'complete' ? colors.accent : colors.warning,
                    icon: e.type === 'start' ? LogIn : e.type === 'complete' ? CheckCircle2 : LogOut,
                  }))} />
                </SectionCard>
              ) : null}
            </View>
          ) : null}
          {tab === 'media' ? <MediaSection job={job} /> : null}
          {tab === 'chat' ? <JobChat jobId={job.id} /> : null}
          {tab === 'estimates' ? <EstimateList job={job} /> : null}
          {tab === 'activity' ? <JobActivityFeed jobId={job.id} employees={employees} /> : null}
          {tab === 'notes' ? <NotesTab job={job} onUpdateJob={actions.updateJob} senderName={fullName({ firstName: profile?.first_name, lastName: profile?.last_name }) || user?.email || 'Note'} userId={user?.id} /> : null}
        </View>
      </ScrollView>

      <OnMyWaySheet open={onMyWay} job={job} onClose={() => setOnMyWay(false)} busy={busy === 'status'} onConfirm={() => move('en-route')} />
      <LocationPermissionSheet open={explain} onClose={() => setExplain(false)} onDone={() => { setExplain(false); setTimeout(() => setOnMyWay(true), 350); }} />
      <ReassignSheet job={reassign ? job : null} employees={employees} onClose={() => setReassign(false)} onUpdateJob={actions.updateJob} />
      {clock.sheets}
    </View>
  );
}

function QuickAction({ icon: Icon, label, onPress }: { icon: typeof Phone; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.7 }]}>
      <View style={styles.quickIcon}><Icon size={20} color="#ffffff" /></View>
      <Text variant="caption" color="#ffffff" style={styles.strong}>{label}</Text>
    </Pressable>
  );
}

const ENTRY_LABEL: Record<string, string> = { start: 'Clocked in', stop: 'Clocked out', complete: 'Completed' };

/** InfoRows for the values that are present (empty ones are skipped; the first gets no divider). */
function contactRows(rows: { icon: typeof Phone; label: string; value: string | null | undefined; onPress?: () => void }[]) {
  return rows.filter((r) => !!r.value).map((r, i) => <InfoRow key={`${r.label}-${i}`} first={i === 0} icon={r.icon} label={r.label} value={r.value as string} onPress={r.onPress} />);
}

/** A small labelled fact chip (service details). */
function Fact({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: colors.muted }]}>
      <Text variant="caption" color="mutedForeground">{label}</Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

function NotesTab({ job, onUpdateJob, senderName, userId }: { job: Job; onUpdateJob: (jobId: string, patch: Partial<Job>) => Promise<boolean>; senderName: string; userId?: string }) {
  const { colors, scheme } = useTheme();
  const [draft, setDraft] = useState(job.notes ?? '');
  const [saving, setSaving] = useState(false);
  const unchanged = draft.trim() === (job.notes ?? '').trim();
  const save = async () => {
    const notes = draft.trim();
    if (unchanged) return;
    setSaving(true);
    const ok = await onUpdateJob(job.id, { notes });
    if (ok && notes && userId) {
      // Mirror the note into the chat thread (web JobDetailsModal).
      const { error } = await messagesService.send(job.id, { senderId: userId, senderName, content: notes, isFromNote: true });
      if (error) console.warn('[notes] chat mirror failed:', error.message);
    }
    setSaving(false);
    if (ok) toast.success('Notes saved');
  };
  return (
    <SectionCard title="Job notes" subtitle="Saved notes are also posted to the team chat" icon={StickyNote} color={colors.warning}>
      <TextInput accessibilityLabel="Job notes" value={draft} onChangeText={setDraft} multiline placeholder="Internal notes about this job…" placeholderTextColor={colors.mutedForeground} textAlignVertical="top" style={[styles.notes, fieldSurface(colors, scheme), { color: colors.foreground }]} />
      <Button label="Save notes" size="lg" fullWidth onPress={() => void save()} disabled={unchanged} loading={saving} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing[12] },
  pad: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  priority: { borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[2], paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  quickAction: { flexGrow: 1, flexBasis: 64, alignItems: 'center', gap: 6, paddingVertical: spacing[1], minHeight: 56, justifyContent: 'center' },
  quickIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  heroCard: { borderRadius: radius.xxl, padding: spacing[5], gap: spacing[2], overflow: 'hidden' },
  heroChip: { borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: spacing[2], paddingVertical: 2 },
  heroLate: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-start', backgroundColor: 'rgba(220,38,38,0.85)', borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  strong: { fontFamily: fontFamily.semibold },
  section: { gap: spacing[3] },
  grow: { flex: 1, minWidth: 0 },
  serviceLine: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: 2 },
  important: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3] },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  fact: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: 2 },
  timeActions: { flexDirection: 'row', gap: spacing[2] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: radius.md, padding: spacing[3] },
  entry: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2], paddingVertical: 4 },
  notes: { minHeight: 160, borderRadius: radius.lg - 4, padding: spacing[4], fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
});
