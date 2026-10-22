import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
import { CalendarPlus, Inbox, Mail, MapPin, Phone, XCircle } from 'lucide-react-native';
import { snapToSlot } from '@/components/calendarLayout';
import { getContractorColor } from '@/utils/contractorColors';
import { assignableEmployees, employeeOptionLabel } from '@/utils/employees';
import type { CustomerRequest, Job } from '@/types';
import { Button, Card, DateTimeField, Dialog, EmptyState, Screen, SegmentedControl, Select, Sheet, SkeletonCard, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useJobsQuery, jobsKey } from '~/features/jobs/useJobs';
import { useTeamQuery } from '~/features/team/useTeam';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { jobsService } from '~/services/jobs';
import { leadsService } from '~/services/leads';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

type Filter = 'pending' | 'all';
const NONE = 'none';
const leadsKey = (companyId: string | null, filter: Filter) => ['leads', companyId, filter] as const;

/** Leads from the public request form: schedule into a job or reject (web `LeadManagement`). */
export default function LeadsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const team = useTeamQuery(companyId);
  useJobsQuery(companyId);
  useJobActions();
  const [filter, setFilter] = useState<Filter>('pending');
  const query = useQuery({ queryKey: leadsKey(companyId, filter), enabled: !!companyId, queryFn: async () => { const { data, error } = filter === 'pending' ? await leadsService.listPending() : await leadsService.listAll(); if (error) throw new Error(error.message); return data ?? []; } });
  const [scheduling, setScheduling] = useState<CustomerRequest | null>(null);
  const [rejecting, setRejecting] = useState<CustomerRequest | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState(NONE);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const technicians = useMemo(() => assignableEmployees(team.data ?? []), [team.data]);
  const leads = query.data ?? [];

  const openSchedule = (lead: CustomerRequest) => {
    setScheduling(lead);
    setDate(lead.preferred_date ? parse(lead.preferred_date.slice(0, 10), 'yyyy-MM-dd', new Date()) : null);
    setTime(null); setAssignee(NONE); setNotes('');
  };
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['leads', companyId] });

  const schedule = async () => {
    if (!scheduling || !companyId || !user) return;
    if (!date || !time) { toast.error('Pick a date and time'); return; }
    const minutes = snapToSlot(time.getHours() * 60 + time.getMinutes());
    const when = new Date(date); when.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const tech = technicians.find((t) => t.id === assignee);
    setBusy(true);
    const { data, error } = await leadsService.schedule(scheduling, { scheduledDate: when.toISOString(), assignedTo: tech?.name ?? '', assignedUserId: tech?.id ?? null, notes: notes.trim() || undefined }, { companyId, userId: user.id });
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? 'Could not schedule'); haptics.error(); return; }
    queryClient.setQueryData<Job[]>(jobsKey(companyId), (prev) => jobsService.upsertJobInList(prev ?? [], data));
    invalidate(); setScheduling(null);
    toast.success('Job scheduled'); haptics.success();
    router.push({ pathname: '/job/[id]', params: { id: data.id } });
  };
  const reject = async () => {
    if (!rejecting) return;
    setBusy(true);
    const { error } = await leadsService.reject(rejecting.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    invalidate(); setRejecting(null); toast.success('Request rejected');
  };

  return (
    <Screen scroll edges={['left', 'right']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Leads', headerBackTitle: 'Back' }} />
      <SegmentedControl<Filter> value={filter} segments={[{ value: 'pending', label: 'Pending' }, { value: 'all', label: 'All' }]} onChange={setFilter} accessibilityLabel="Lead filter" />
      {query.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : leads.length === 0 ? <EmptyState icon={Inbox} title={filter === 'pending' ? 'No pending requests' : 'No requests yet'} message="Requests arrive from your public lead form (Settings → General on the web)." />
        : (
          <View style={styles.list}>
            {leads.map((l) => (
              <Card key={l.id} style={styles.card}>
                <View style={styles.head}><Text variant="heading" style={styles.grow}>{l.client_name}</Text><Text variant="caption" color={l.status === 'pending' ? 'warningForeground' : l.status === 'scheduled' ? 'success' : 'mutedForeground'}>{l.status}</Text></View>
                <Text variant="body">{l.job_details}</Text>
                <View style={styles.meta}><MapPin size={14} color={colors.mutedForeground} /><Text variant="caption" color="mutedForeground" style={styles.grow}>{l.client_address}</Text></View>
                <View style={styles.meta}><Phone size={14} color={colors.mutedForeground} /><Text variant="caption" color="accent" onPress={() => void links.call(l.client_phone)}>{l.client_phone}</Text>{l.client_email ? <><Mail size={14} color={colors.mutedForeground} /><Text variant="caption" color="accent" onPress={() => void links.email(l.client_email as string)}>{l.client_email}</Text></> : null}</View>
                <Text variant="caption" color="mutedForeground">Received {format(new Date(l.created_at), 'MMM d, h:mm a')}{l.preferred_date ? ` · prefers ${l.preferred_date.slice(0, 10)}` : ''}{l.source ? ` · ${l.source}` : ''}</Text>
                {l.status === 'pending' ? (
                  <View style={styles.actions}>
                    <Button label="Schedule" size="sm" icon={<CalendarPlus size={14} color={colors.accentForeground} />} onPress={() => openSchedule(l)} />
                    <Button label="Reject" size="sm" variant="outline" icon={<XCircle size={14} color={colors.foreground} />} onPress={() => setRejecting(l)} />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}

      <Sheet open={!!scheduling} onClose={() => setScheduling(null)} title="Schedule request" description={scheduling ? `${scheduling.client_name} · ${scheduling.client_address}` : undefined} footer={<Button label="Create job" size="lg" fullWidth onPress={() => void schedule()} loading={busy} />}>
        <View style={styles.rowFields}>
          <View style={styles.grow}><DateTimeField label="Date" mode="date" value={date} onChange={setDate} minimumDate={new Date()} /></View>
          <View style={styles.grow}><DateTimeField label="Time (15-min)" mode="time" value={time} onChange={setTime} /></View>
        </View>
        <Select label="Technician" value={assignee} onChange={setAssignee} options={[{ value: NONE, label: 'Unassigned' }, ...technicians.map((t) => ({ value: t.id, label: employeeOptionLabel(t), leading: <View style={[styles.dot, { backgroundColor: getContractorColor(t.name, t.color) }]} /> }))]} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Sheet>
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} title="Reject this request?" description={`${rejecting?.client_name ?? ''} will be marked as rejected. This is recorded and can be reviewed later.`} confirmLabel="Reject" confirmVariant="destructive" busy={busy} onConfirm={reject} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  grow: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: spacing[2], paddingTop: spacing[1] },
  rowFields: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
});
