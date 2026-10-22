import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, Camera, Clock, FileText, Info, LogIn, LogOut, Mail, MapPin, MessageSquare, MessageSquareText, Navigation, Phone, StickyNote, UserCog, CheckCircle2 } from 'lucide-react-native';
import { jobNumber } from '@/services/adapters/jobAdapter';
import { getContractorColor } from '@/utils/contractorColors';
import { formatLength } from '@/components/calendarLayout';
import { fullName, matchesAssignedName } from '@/utils/names';
import { scheduleWindow } from '@/utils/schedule';
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
import { Button, Card, EmptyState, IconButton, Skeleton, StatusBadge, Tabs, Text } from '~/components/ui';
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
import { fontFamily, radius, spacing, withAlpha } from '~/theme/tokens';

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
  const PrimaryIcon = primary?.icon ?? CheckCircle2;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: job.clientName, headerBackTitle: 'Back', headerRight: isStaff ? () => <IconButton icon={UserCog} label="Reassign" onPress={() => setReassign(true)} /> : undefined }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={styles.pad}>
          <Confetti burst={burst} />
          <View style={styles.badges}>
            <Text variant="mono" color="mutedForeground">#{jobNumber(job.id)}</Text>
            <StatusBadge status={job.status} />
            {job.priority && job.priority !== 'medium' ? <View style={[styles.priority, { borderColor: colors.border }]}><Text variant="caption" color="mutedForeground">{job.priority}</Text></View> : null}
          </View>
          <Text variant="display">{job.clientName}</Text>
          <View style={styles.metaRow}><Clock size={14} color={colors.mutedForeground} /><Text variant="small" color="mutedForeground">{scheduleWindow(job.scheduledDate, job.durationMinutes)}</Text></View>
          <View style={styles.metaRow}><View style={[styles.dot, { backgroundColor: getContractorColor(assignee?.name ?? job.assignedTo, assignee?.color) }]} /><Text variant="small" color="mutedForeground">{assignee?.name || job.assignedTo || 'Unassigned'}</Text></View>
          <View style={styles.quick}>
            {job.clientPhone ? <QuickAction icon={Phone} label="Call" onPress={() => void links.call(job.clientPhone)} /> : null}
            {job.clientPhone ? <QuickAction icon={MessageSquareText} label="Text" onPress={() => void links.sms(job.clientPhone)} /> : null}
            {job.clientAddress ? <QuickAction icon={Navigation} label="Navigate" onPress={() => void links.navigate(job.clientAddress)} /> : null}
            {job.clientEmail ? <QuickAction icon={Mail} label="Email" onPress={() => void links.email(job.clientEmail)} /> : null}
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
              <Card style={styles.section}>
                <Text variant="heading">{[job.clientSalutation, job.clientName].filter(Boolean).join(' ')}</Text>
                <ContactLine icon={Phone} value={job.clientPhone} label={job.clientPhoneType} onPress={() => void links.call(job.clientPhone)} />
                <ContactLine icon={Phone} value={job.clientPhone2} label={job.clientPhone2Type} onPress={() => void links.call(job.clientPhone2)} />
                <ContactLine icon={Mail} value={job.clientEmail} label={job.clientEmailType} onPress={() => void links.email(job.clientEmail)} />
                <ContactLine icon={Mail} value={job.clientEmail2} label={job.clientEmail2Type} onPress={() => void links.email(job.clientEmail2)} />
                <ContactLine icon={MapPin} value={job.clientAddress} onPress={() => void links.navigate(job.clientAddress)} />
              </Card>
              {job.billingName || job.billingAddress || job.billingPhone || job.billingEmail ? (
                <Card style={styles.section}>
                  <Text variant="overline" color="mutedForeground">Billing</Text>
                  {job.billingName ? <Text variant="small">{job.billingName}</Text> : null}
                  <ContactLine icon={MapPin} value={job.billingAddress} />
                  <ContactLine icon={Phone} value={job.billingPhone} onPress={() => void links.call(job.billingPhone)} />
                  <ContactLine icon={Mail} value={job.billingEmail} onPress={() => void links.email(job.billingEmail)} />
                </Card>
              ) : null}
              {unit || job.division || job.serviceType || job.durationMinutes ? (
                <View style={[styles.serviceLine, { backgroundColor: withAlpha(colors.muted, 0.6), borderColor: colors.border }]}>
                  {unit ? <Text variant="small"><Text variant="small" color="mutedForeground">Business unit: </Text>{unit.name}</Text> : null}
                  {job.division ? <Text variant="small"><Text variant="small" color="mutedForeground">Division: </Text>{DIVISION_LABEL[job.division]}</Text> : null}
                  {job.serviceType ? <Text variant="small"><Text variant="small" color="mutedForeground">Service type: </Text>{job.serviceType}</Text> : null}
                  {job.durationMinutes ? <Text variant="small"><Text variant="small" color="mutedForeground">Length: </Text>{formatLength(job.durationMinutes)}</Text> : null}
                </View>
              ) : null}
              {isStaff ? <JobDetailsEditor job={job} employees={employees} onUpdateJob={actions.updateJob} /> : (
                <View style={styles.section}>
                  {job.category ? <Text variant="small"><Text variant="small" color="mutedForeground">Category: </Text>{job.category}</Text> : null}
                  <Text variant="body">{job.jobDetails}</Text>
                  {job.importantDetails ? <View style={[styles.important, { backgroundColor: withAlpha(colors.warning, 0.12), borderColor: withAlpha(colors.warning, 0.4) }]}><Text variant="small"><Text variant="label">Important: </Text>{job.importantDetails}</Text></View> : null}
                </View>
              )}
            </View>
          ) : null}
          {tab === 'time' ? (
            <View style={styles.section}>
              <JobTimer entries={job.timeEntries} showBreakdown plannedMinutes={job.durationMinutes ?? null} />
              {canControlTime && job.status !== 'completed' ? (
                <View style={styles.quick}>
                  {clock.isActive ? (
                    <>
                      <Button label="Clock out" variant="outline" icon={<LogOut size={18} color={colors.foreground} />} onPress={clock.clockOut} disabled={clock.busy} />
                      <Button label="Complete job" icon={<CheckCircle2 size={18} color={colors.accentForeground} />} onPress={clock.complete} loading={clock.busy} />
                    </>
                  ) : <Button label="Clock in" icon={<LogIn size={18} color={colors.accentForeground} />} onPress={clock.clockIn} loading={clock.busy} />}
                </View>
              ) : null}
              {job.status === 'completed' ? <Text variant="small" color="mutedForeground">This job is completed; time is no longer accruing.</Text> : null}
              {job.timeEntries.length > 0 ? (
                <Card>
                  <Text variant="overline" color="mutedForeground">Entries ({job.timeEntries.length})</Text>
                  {[...job.timeEntries].reverse().map((e, i) => (
                    <View key={`${e.timestamp}-${i}`} style={styles.entry}>
                      <Text variant="small" style={styles.grow}>{e.type}{e.notes ? ` — ${e.notes}` : ''}</Text>
                      <Text variant="caption" color="mutedForeground">{new Date(e.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
                    </View>
                  ))}
                </Card>
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
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.quickAction, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
      <Icon size={18} color={colors.accent} />
      <Text variant="caption" color="accent">{label}</Text>
    </Pressable>
  );
}

function ContactLine({ icon: Icon, value, label, onPress }: { icon: typeof Phone; value: string; label?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <Pressable accessibilityRole={onPress ? 'link' : 'text'} onPress={onPress} disabled={!onPress} style={styles.contact}>
      <Icon size={16} color={colors.mutedForeground} />
      <Text variant="small" color={onPress ? 'accent' : 'foreground'} style={styles.grow}>{value}{label ? <Text variant="caption" color="mutedForeground"> ({label})</Text> : null}</Text>
    </Pressable>
  );
}

function NotesTab({ job, onUpdateJob, senderName, userId }: { job: Job; onUpdateJob: (jobId: string, patch: Partial<Job>) => Promise<boolean>; senderName: string; userId?: string }) {
  const { colors } = useTheme();
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
    <View style={styles.section}>
      <Text variant="label">Job notes</Text>
      <TextInput accessibilityLabel="Job notes" value={draft} onChangeText={setDraft} multiline placeholder="Internal notes about this job. Saved notes are also posted to the chat thread." placeholderTextColor={colors.mutedForeground} textAlignVertical="top" style={[styles.notes, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]} />
      <Button label="Save notes" onPress={() => void save()} disabled={unchanged} loading={saving} />
    </View>
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
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickAction: { flexGrow: 1, flexBasis: 70, alignItems: 'center', gap: 4, paddingVertical: spacing[2], borderRadius: radius.md, minHeight: 56, justifyContent: 'center' },
  section: { gap: spacing[3] },
  contact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  serviceLine: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: 2 },
  important: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3] },
  entry: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2], paddingVertical: 4 },
  notes: { minHeight: 140, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, padding: spacing[3], fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
});
