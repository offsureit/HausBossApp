import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ban, Briefcase, Building2, FileSignature, FileText, Info, Layers, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Receipt, StickyNote, Trash2, Undo2, UserRound, Wrench } from 'lucide-react-native';
import type { Customer, CustomerEquipment, Job, ServiceAgreement } from '@/types';
import { JobCard } from '~/components/jobs/JobCard';
import { Avatar, Button, Card, Dialog, EmptyState, GradientBackdrop, HERO_TEXT_MUTED, HeroIconButton, IconButton, IconTile, InfoRow, SectionCard, Skeleton, Tabs, Text, TextField, Toggle } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCustomersQuery } from '~/features/customers/useCustomers';
import { useSmsInbox } from '~/features/sms/SmsInboxProvider';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { customersService } from '~/services/customers';
import { smsService } from '~/services/sms';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

type Tab = 'details' | 'jobs' | 'equipment' | 'agreements';
const TABS: { value: Tab; label: string; icon: typeof Info }[] = [
  { value: 'details', label: 'Details', icon: Info }, { value: 'jobs', label: 'Jobs', icon: Briefcase }, { value: 'equipment', label: 'Equipment', icon: Wrench }, { value: 'agreements', label: 'Agreements', icon: FileText },
];
const DIVISION_LABEL: Record<string, string> = { residential: 'Residential', commercial: 'Commercial' };
/** Date-only columns come back as ISO timestamps from the API; show the calendar day. */
const day = (v: string | null | undefined) => (v ? format(new Date(v.length === 10 ? `${v}T12:00:00` : v), 'MMM d, yyyy') : '');

type EquipmentDraft = { equipment_type: string; brand: string; model: string; serial_number: string; location: string; install_date: string; warranty_expires: string; notes: string };
type AgreementDraft = { plan_name: string; frequency: string; visits_per_year: string; price: string; start_date: string; end_date: string; next_service_date: string };
const EMPTY_EQUIPMENT: EquipmentDraft = { equipment_type: '', brand: '', model: '', serial_number: '', location: '', install_date: '', warranty_expires: '', notes: '' };
const EMPTY_AGREEMENT: AgreementDraft = { plan_name: '', frequency: 'annual', visits_per_year: '1', price: '', start_date: '', end_date: '', next_service_date: '' };

/** Customer record: details, job history, equipment, service agreements; text / opt-out / new job / delete (web `CustomerDialog`). */
export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isStaff, isAdmin } = useAuth();
  const { company, companyId } = useCompany();
  const customers = useCustomersQuery(companyId, true, true);
  const inbox = useSmsInbox();
  const [tab, setTab] = useState<Tab>('details');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [equipment, setEquipment] = useState<CustomerEquipment[] | null>(null);
  const [agreements, setAgreements] = useState<ServiceAgreement[] | null>(null);
  const [eq, setEq] = useState<EquipmentDraft>(EMPTY_EQUIPMENT);
  const [ag, setAg] = useState<AgreementDraft>(EMPTY_AGREEMENT);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'optout' | 'delete' | null>(null);
  const [eqOpen, setEqOpen] = useState(false);
  const [agOpen, setAgOpen] = useState(false);

  const customer = useMemo(() => customers.data?.find((c) => c.id === id) ?? null, [customers.data, id]);
  const apply = useCallback((c: Customer) => customers.upsertLocal(c), [customers]);

  useEffect(() => {
    if (!customer) return;
    if (tab === 'jobs' && jobs === null) void customersService.listCustomerJobs(customer.id).then((r) => { if (r.error) toast.error(r.error.message); setJobs(r.data ?? []); });
    if (tab === 'equipment' && equipment === null) void customersService.listEquipment(customer.id).then((r) => { if (r.error) toast.error(r.error.message); setEquipment(r.data ?? []); });
    if (tab === 'agreements' && agreements === null) void customersService.listAgreements(customer.id).then((r) => { if (r.error) toast.error(r.error.message); setAgreements(r.data ?? []); });
  }, [tab, customer, jobs, equipment, agreements]);

  if (!customer) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Customer' }} />
        <View style={styles.pad}>{customers.isPending ? <><Skeleton height={28} width="60%" /><Skeleton height={100} /></> : <EmptyState icon={UserRound} title="Customer not found" action={<Button label="Back" variant="outline" onPress={() => router.back()} />} />}</View>
      </View>
    );
  }

  const optedOut = !!customer.sms_opted_out_at;
  const textable = customersService.textableNumber(customer);
  const canText = isStaff && inbox.inPlan && inbox.configured && !optedOut && !!textable;
  const unit = customer.business_unit_id ? company?.businessUnits.find((u) => u.id === customer.business_unit_id) : null;

  const setConsent = async (optOut: boolean) => {
    setBusy('consent');
    const { data, error } = await smsService.setConsent(customer.id, optOut);
    setBusy(null);
    setConfirm(null);
    if (error || !data) { toast.error(error?.message ?? 'Could not update SMS consent'); return; }
    apply(data);
    toast.success(optOut ? 'Customer opted out of SMS' : 'SMS consent restored');
  };
  const textCustomer = async () => {
    setBusy('text');
    const { data, error } = await smsService.start(customer.id);
    setBusy(null);
    if (error || !data) { toast.error(error?.message ?? 'Could not start the conversation'); return; }
    inbox.upsertLocal(data);
    router.push({ pathname: '/messages/[id]', params: { id: data.id } });
  };
  const remove = async () => {
    setBusy('delete');
    const { error } = await customersService.remove(customer.id);
    setBusy(null);
    setConfirm(null);
    if (error) { toast.error('Could not delete customer', { description: error.message }); return; }
    customers.removeLocal(customer.id);
    toast.success('Customer deleted');
    router.back();
  };
  const addEquipment = async () => {
    if (!eq.equipment_type.trim()) { toast.error('Equipment type is required'); return; }
    setBusy('eq');
    const { data, error } = await customersService.addEquipment({ customer_id: customer.id, company_id: customer.company_id, equipment_type: eq.equipment_type.trim(), brand: eq.brand || null, model: eq.model || null, serial_number: eq.serial_number || null, location: eq.location || null, install_date: eq.install_date || null, warranty_expires: eq.warranty_expires || null, notes: eq.notes || null });
    setBusy(null);
    if (error || !data) { toast.error('Could not add equipment', { description: error?.message }); return; }
    setEquipment((p) => [...(p ?? []), data]); setEq(EMPTY_EQUIPMENT); setEqOpen(false); haptics.success();
  };
  const removeEquipment = async (item: CustomerEquipment) => {
    const { error } = await customersService.deleteEquipment(item.id);
    if (error) { toast.error(error.message); return; }
    setEquipment((p) => (p ?? []).filter((e) => e.id !== item.id));
  };
  const addAgreement = async () => {
    const visits = Number(ag.visits_per_year); const price = Number(ag.price);
    if (!ag.plan_name.trim() || !ag.start_date || Number.isNaN(visits) || Number.isNaN(price)) { toast.error('Plan name, start date, visits and price are required'); return; }
    setBusy('ag');
    const { data, error } = await customersService.addAgreement({ customer_id: customer.id, company_id: customer.company_id, plan_name: ag.plan_name.trim(), frequency: ag.frequency, visits_per_year: visits, price, start_date: ag.start_date, end_date: ag.end_date || null, next_service_date: ag.next_service_date || null, is_active: true });
    setBusy(null);
    if (error || !data) { toast.error('Could not add agreement', { description: error?.message }); return; }
    setAgreements((p) => [...(p ?? []), data]); setAg(EMPTY_AGREEMENT); setAgOpen(false); haptics.success();
  };
  const toggleAgreement = async (a: ServiceAgreement) => {
    const { data, error } = await customersService.updateAgreement(a.id, { is_active: !a.is_active });
    if (error || !data) { toast.error(error?.message ?? 'Failed'); return; }
    setAgreements((p) => (p ?? []).map((x) => (x.id === a.id ? data : x)));
  };
  const removeAgreement = async (a: ServiceAgreement) => {
    const { error } = await customersService.deleteAgreement(a.id);
    if (error) { toast.error(error.message); return; }
    setAgreements((p) => (p ?? []).filter((x) => x.id !== a.id));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: customer.name, headerBackTitle: 'Back', headerRight: isStaff ? () => <HeroIconButton icon={Pencil} label="Edit customer" onPress={() => router.push({ pathname: '/customers/[id]/edit', params: { id: customer.id } })} /> : undefined }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={styles.pad}>
          {/* Profile card: the brand gradient, avatar, name and round quick actions (same family as job details). */}
          <View style={styles.heroCard}>
            <GradientBackdrop rounded={radius.xxl} />
            <View style={styles.heroTop}>
              <View style={styles.avatarRing}><Avatar name={customer.name} size={56} /></View>
              <View style={styles.grow}>
                <Text variant="title" color="#ffffff">{customer.name}</Text>
                <Text variant="small" color={HERO_TEXT_MUTED}>{[unit?.name, customer.is_active === false ? 'Inactive customer' : null].filter(Boolean).join(' · ') || 'Customer'}</Text>
              </View>
            </View>
          <View style={styles.quick}>
            {customer.phone ? <QuickAction icon={Phone} label="Call" onPress={() => void links.call(customer.phone as string)} /> : null}
            {customer.email ? <QuickAction icon={Mail} label="Email" onPress={() => void links.email(customer.email as string)} /> : null}
            {customer.address ? <QuickAction icon={MapPin} label="Navigate" onPress={() => void links.navigate(customer.address as string)} /> : null}
            {isStaff ? <QuickAction icon={Plus} label="New job" onPress={() => router.push({ pathname: '/job/new', params: { customerId: customer.id } })} /> : null}
          </View>
          </View>
        </View>
        <View style={{ backgroundColor: colors.background }}><Tabs value={tab} items={TABS} onChange={setTab} /></View>
        <View style={styles.pad}>
          {tab === 'details' ? (
            <View style={styles.section}>
              <SectionCard title="Contact" icon={UserRound} flush>
                {rows([
                  { icon: Phone, label: 'Phone', value: customer.phone, onPress: () => void links.call(customer.phone as string) },
                  { icon: Phone, label: 'Second phone', value: customer.phone2, onPress: () => void links.call(customer.phone2 as string) },
                  { icon: Mail, label: 'Email', value: customer.email, onPress: () => void links.email(customer.email as string) },
                  { icon: Mail, label: 'Second email', value: customer.email2, onPress: () => void links.email(customer.email2 as string) },
                  { icon: MapPin, label: 'Service address', value: customer.address, onPress: () => void links.navigate(customer.address as string) },
                ])}
                {!customer.phone && !customer.email && !customer.address ? <Text variant="small" color="mutedForeground" style={styles.empty}>No contact details.</Text> : null}
              </SectionCard>
              {customer.billing_name || customer.billing_address || customer.billing_phone || customer.billing_email ? (
                <SectionCard title="Billing" icon={Receipt} color={colors.success} flush>
                  {rows([
                    { icon: UserRound, label: 'Bill to', value: customer.billing_name },
                    { icon: MapPin, label: 'Billing address', value: customer.billing_address },
                    { icon: Phone, label: 'Billing phone', value: customer.billing_phone, onPress: () => void links.call(customer.billing_phone as string) },
                    { icon: Mail, label: 'Billing email', value: customer.billing_email, onPress: () => void links.email(customer.billing_email as string) },
                  ])}
                </SectionCard>
              ) : null}
              {unit || customer.division ? (
                <SectionCard title="Service line" icon={Building2} color={colors.warning} flush>
                  {rows([
                    { icon: Building2, label: 'Business unit', value: unit?.name },
                    { icon: Layers, label: 'Division', value: customer.division ? DIVISION_LABEL[customer.division] ?? customer.division : null },
                  ])}
                </SectionCard>
              ) : null}
              {customer.notes ? <SectionCard title="Notes" icon={StickyNote} color={colors.warning}><Text variant="body">{customer.notes}</Text></SectionCard> : null}
              <SectionCard title="Text messages" icon={MessageCircle} color={optedOut ? colors.destructive : colors.success} subtitle={optedOut ? 'Opted out' : 'OK to text'}>
                <Text variant="caption" color="mutedForeground">
                  {optedOut ? `Since ${format(new Date(customer.sms_opted_out_at as string), 'MMM d, yyyy')}. No texts are sent until consent is restored.` : customer.sms_consent_at ? `Consent given ${format(new Date(customer.sms_consent_at), 'MMM d, yyyy')}.` : 'Appointment updates and replies by text.'}
                  {!textable ? ' No valid mobile number.' : ''}
                </Text>
                {isStaff ? (
                  <View style={styles.quick}>
                    <Button label="Text customer" size="sm" icon={<MessageCircle size={14} color={colors.accentForeground} />} onPress={() => void textCustomer()} disabled={!canText || !!busy} loading={busy === 'text'} />
                    {optedOut
                      ? <Button label="Restore consent" size="sm" variant="secondary" icon={<Undo2 size={14} color={colors.foreground} />} onPress={() => void setConsent(false)} loading={busy === 'consent'} disabled={!!busy} />
                      : <Button label="Opt out" size="sm" variant="outline" icon={<Ban size={14} color={colors.foreground} />} onPress={() => setConfirm('optout')} disabled={!!busy} />}
                  </View>
                ) : null}
                {isStaff && !inbox.inPlan ? <Text variant="caption" color="mutedForeground">Texting is not included in the Individual plan.</Text> : isStaff && !inbox.configured ? <Text variant="caption" color="mutedForeground">No SMS number configured for your company.</Text> : null}
              </SectionCard>
              {isAdmin ? <Button label="Delete customer" variant="danger-ghost" size="lg" fullWidth icon={<Trash2 size={18} color={colors.destructive} />} onPress={() => setConfirm('delete')} disabled={!!busy} /> : null}
            </View>
          ) : null}
          {tab === 'jobs' ? (
            <View style={styles.section}>
              {jobs === null ? <><Skeleton height={100} /><Skeleton height={100} /></> : jobs.length === 0 ? <EmptyState icon={Briefcase} title="No jobs for this customer yet" action={isStaff ? <Button label="New job" onPress={() => router.push({ pathname: '/job/new', params: { customerId: customer.id } })} /> : undefined} />
                : jobs.map((j) => <JobCard key={j.id} job={j} assigneeName={j.assignedTo || 'Unassigned'} />)}
            </View>
          ) : null}
          {tab === 'equipment' ? (
            <View style={styles.section}>
              {equipment === null ? <Skeleton height={80} /> : equipment.length === 0 ? <EmptyState icon={Wrench} title="No equipment recorded" message="Furnaces, condensers, water heaters… with serial numbers and warranty dates." /> : equipment.map((e) => (
                <Card key={e.id} style={styles.itemRow}>
                  <IconTile icon={Wrench} color={colors.warning} />
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{[e.equipment_type, e.brand, e.model].filter(Boolean).join(' · ')}</Text>
                    <Text variant="caption" color="mutedForeground">{[e.serial_number && `S/N ${e.serial_number}`, e.location, e.install_date && `Installed ${day(e.install_date)}`, e.warranty_expires && `Warranty to ${day(e.warranty_expires)}`].filter(Boolean).join(' · ')}</Text>
                    {e.notes ? <Text variant="caption">{e.notes}</Text> : null}
                  </View>
                  {isStaff ? <IconButton icon={Trash2} label={`Remove ${e.equipment_type}`} tone="destructive" onPress={() => void removeEquipment(e)} /> : null}
                </Card>
              ))}
              {isStaff ? (eqOpen ? (
                <SectionCard title="Add equipment" icon={Wrench} color={colors.warning}>
                  <TextField label="Equipment type *" value={eq.equipment_type} onChangeText={(v) => setEq({ ...eq, equipment_type: v })} placeholder="e.g. Furnace" />
                  <View style={styles.row}><View style={styles.grow}><TextField label="Brand" value={eq.brand} onChangeText={(v) => setEq({ ...eq, brand: v })} /></View><View style={styles.grow}><TextField label="Model" value={eq.model} onChangeText={(v) => setEq({ ...eq, model: v })} /></View></View>
                  <View style={styles.row}><View style={styles.grow}><TextField label="Serial number" value={eq.serial_number} onChangeText={(v) => setEq({ ...eq, serial_number: v })} autoCapitalize="characters" /></View><View style={styles.grow}><TextField label="Location" value={eq.location} onChangeText={(v) => setEq({ ...eq, location: v })} /></View></View>
                  <View style={styles.row}><View style={styles.grow}><TextField label="Install date" value={eq.install_date} onChangeText={(v) => setEq({ ...eq, install_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View><View style={styles.grow}><TextField label="Warranty expires" value={eq.warranty_expires} onChangeText={(v) => setEq({ ...eq, warranty_expires: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View></View>
                  <TextField label="Notes" value={eq.notes} onChangeText={(v) => setEq({ ...eq, notes: v })} />
                  <View style={styles.row}><Button label="Cancel" variant="outline" onPress={() => setEqOpen(false)} /><Button label="Add equipment" onPress={() => void addEquipment()} loading={busy === 'eq'} style={styles.grow} /></View>
                </SectionCard>
              ) : <Button label="Add equipment" size="lg" fullWidth icon={<Plus size={18} color={colors.accentForeground} />} onPress={() => setEqOpen(true)} />) : null}
            </View>
          ) : null}
          {tab === 'agreements' ? (
            <View style={styles.section}>
              {agreements === null ? <Skeleton height={80} /> : agreements.length === 0 ? <EmptyState icon={FileSignature} title="No service agreements" message="Maintenance plans with visits per year and the next service date." /> : agreements.map((a) => (
                <Card key={a.id} style={styles.itemRow}>
                  <IconTile icon={FileSignature} color={colors.success} />
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{a.plan_name} <Text variant="caption" color="mutedForeground">· {a.frequency} · {a.visits_per_year}/yr · ${Number(a.price).toFixed(2)}</Text></Text>
                    <Text variant="caption" color="mutedForeground">{[`From ${day(a.start_date)}`, a.end_date && `to ${day(a.end_date)}`, a.next_service_date && `next ${day(a.next_service_date)}`].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {isStaff ? <><Toggle value={!!a.is_active} onValueChange={() => void toggleAgreement(a)} accessibilityLabel={`${a.plan_name} active`} /><IconButton icon={Trash2} label={`Remove ${a.plan_name}`} tone="destructive" onPress={() => void removeAgreement(a)} /></> : null}
                </Card>
              ))}
              {isStaff ? (agOpen ? (
                <SectionCard title="Add agreement" icon={FileSignature} color={colors.success}>
                  <TextField label="Plan name *" value={ag.plan_name} onChangeText={(v) => setAg({ ...ag, plan_name: v })} />
                  <TextField label="Frequency" value={ag.frequency} onChangeText={(v) => setAg({ ...ag, frequency: v })} placeholder="annual / semi-annual / quarterly" autoCapitalize="none" />
                  <View style={styles.row}><View style={styles.grow}><TextField label="Visits per year *" value={ag.visits_per_year} onChangeText={(v) => setAg({ ...ag, visits_per_year: v })} keyboardType="number-pad" /></View><View style={styles.grow}><TextField label="Price *" value={ag.price} onChangeText={(v) => setAg({ ...ag, price: v })} keyboardType="decimal-pad" /></View></View>
                  <View style={styles.row}><View style={styles.grow}><TextField label="Start date *" value={ag.start_date} onChangeText={(v) => setAg({ ...ag, start_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View><View style={styles.grow}><TextField label="End date" value={ag.end_date} onChangeText={(v) => setAg({ ...ag, end_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View></View>
                  <TextField label="Next service" value={ag.next_service_date} onChangeText={(v) => setAg({ ...ag, next_service_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                  <View style={styles.row}><Button label="Cancel" variant="outline" onPress={() => setAgOpen(false)} /><Button label="Add agreement" onPress={() => void addAgreement()} loading={busy === 'ag'} style={styles.grow} /></View>
                </SectionCard>
              ) : <Button label="Add agreement" size="lg" fullWidth icon={<Plus size={18} color={colors.accentForeground} />} onPress={() => setAgOpen(true)} />) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <Dialog open={confirm === 'optout'} onClose={() => setConfirm(null)} title={`Opt ${customer.name} out of SMS?`} description="No text messages will be sent to this customer until consent is restored. Status updates by text stop too." confirmLabel="Opt out" confirmVariant="destructive" busy={busy === 'consent'} onConfirm={() => setConsent(true)} />
      <Dialog open={confirm === 'delete'} onClose={() => setConfirm(null)} title={`Delete ${customer.name}?`} description="Jobs keep their details but lose the link to this customer. This cannot be undone." confirmLabel="Delete" confirmVariant="destructive" busy={busy === 'delete'} onConfirm={remove} />
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

/** InfoRows for the values that are present (the first gets no divider). */
function rows(items: { icon: typeof Phone; label: string; value: string | null | undefined; onPress?: () => void }[]) {
  return items.filter((r) => !!r.value).map((r, i) => <InfoRow key={`${r.label}-${i}`} first={i === 0} icon={r.icon} label={r.label} value={r.value as string} onPress={r.onPress} />);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing[12] },
  pad: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  quickAction: { flexGrow: 1, flexBasis: 64, alignItems: 'center', gap: 6, paddingVertical: spacing[1], minHeight: 56, justifyContent: 'center' },
  quickIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  heroCard: { borderRadius: radius.xxl, padding: spacing[5], gap: spacing[2], overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatarRing: { padding: 3, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.22)' },
  strong: { fontFamily: 'Inter_600SemiBold' },
  empty: { padding: spacing[4] },
  section: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
});
