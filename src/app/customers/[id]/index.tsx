import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ban, Briefcase, FileText, Info, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Trash2, Undo2, UserRound, Wrench } from 'lucide-react-native';
import type { Customer, CustomerEquipment, Job, ServiceAgreement } from '@/types';
import { JobCard } from '~/components/jobs/JobCard';
import { Button, Card, Dialog, EmptyState, IconButton, Skeleton, Tabs, Text, TextField, Toggle } from '~/components/ui';
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
import { radius, spacing, withAlpha } from '~/theme/tokens';

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
      <Stack.Screen options={{ title: customer.name, headerBackTitle: 'Back', headerRight: isStaff ? () => <IconButton icon={Pencil} label="Edit customer" onPress={() => router.push({ pathname: '/customers/[id]/edit', params: { id: customer.id } })} /> : undefined }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={styles.pad}>
          <Text variant="display">{customer.name}</Text>
          {customer.is_active === false ? <Text variant="caption" color="mutedForeground">Inactive customer</Text> : null}
          <View style={styles.quick}>
            {customer.phone ? <QuickAction icon={Phone} label="Call" onPress={() => void links.call(customer.phone as string)} /> : null}
            {customer.email ? <QuickAction icon={Mail} label="Email" onPress={() => void links.email(customer.email as string)} /> : null}
            {customer.address ? <QuickAction icon={MapPin} label="Navigate" onPress={() => void links.navigate(customer.address as string)} /> : null}
            {isStaff ? <QuickAction icon={Plus} label="New job" onPress={() => router.push({ pathname: '/job/new', params: { customerId: customer.id } })} /> : null}
          </View>
        </View>
        <View style={{ backgroundColor: colors.background }}><Tabs value={tab} items={TABS} onChange={setTab} /></View>
        <View style={styles.pad}>
          {tab === 'details' ? (
            <View style={styles.section}>
              <Card style={styles.section}>
                <ContactLine icon={Phone} value={customer.phone} onPress={() => void links.call(customer.phone as string)} />
                <ContactLine icon={Phone} value={customer.phone2} onPress={() => void links.call(customer.phone2 as string)} />
                <ContactLine icon={Mail} value={customer.email} onPress={() => void links.email(customer.email as string)} />
                <ContactLine icon={Mail} value={customer.email2} onPress={() => void links.email(customer.email2 as string)} />
                <ContactLine icon={MapPin} value={customer.address} onPress={() => void links.navigate(customer.address as string)} />
                {!customer.phone && !customer.email && !customer.address ? <Text variant="small" color="mutedForeground">No contact details.</Text> : null}
              </Card>
              {customer.billing_name || customer.billing_address || customer.billing_phone || customer.billing_email ? (
                <Card style={styles.section}>
                  <Text variant="overline" color="mutedForeground">Billing</Text>
                  {customer.billing_name ? <Text variant="small">{customer.billing_name}</Text> : null}
                  <ContactLine icon={MapPin} value={customer.billing_address} />
                  <ContactLine icon={Phone} value={customer.billing_phone} onPress={() => void links.call(customer.billing_phone as string)} />
                  <ContactLine icon={Mail} value={customer.billing_email} onPress={() => void links.email(customer.billing_email as string)} />
                </Card>
              ) : null}
              {unit || customer.division ? (
                <View style={[styles.serviceLine, { backgroundColor: withAlpha(colors.muted, 0.6), borderColor: colors.border }]}>
                  {unit ? <Text variant="small"><Text variant="small" color="mutedForeground">Business unit: </Text>{unit.name}</Text> : null}
                  {customer.division ? <Text variant="small"><Text variant="small" color="mutedForeground">Division: </Text>{DIVISION_LABEL[customer.division] ?? customer.division}</Text> : null}
                </View>
              ) : null}
              {customer.notes ? <Card><Text variant="overline" color="mutedForeground">Notes</Text><Text variant="body">{customer.notes}</Text></Card> : null}
              <Card style={styles.section} accessibilityLabel="SMS consent">
                <Text variant="bodyMedium">Text messages</Text>
                <Text variant="caption" color="mutedForeground">
                  {optedOut ? `Opted out on ${format(new Date(customer.sms_opted_out_at as string), 'MMM d, yyyy')}` : 'OK to text'}
                  {!optedOut && customer.sms_consent_at ? ` · consent ${format(new Date(customer.sms_consent_at), 'MMM d, yyyy')}` : ''}
                  {!textable ? ' · no valid mobile number' : ''}
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
              </Card>
              {isAdmin ? <Button label="Delete customer" variant="ghost" icon={<Trash2 size={18} color={colors.destructive} />} onPress={() => setConfirm('delete')} disabled={!!busy} /> : null}
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
              {equipment === null ? <Skeleton height={80} /> : equipment.length === 0 ? <Text variant="small" color="mutedForeground">No equipment recorded.</Text> : equipment.map((e) => (
                <Card key={e.id} style={styles.itemRow}>
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{[e.equipment_type, e.brand, e.model].filter(Boolean).join(' · ')}</Text>
                    <Text variant="caption" color="mutedForeground">{[e.serial_number && `S/N ${e.serial_number}`, e.location, e.install_date && `Installed ${day(e.install_date)}`, e.warranty_expires && `Warranty to ${day(e.warranty_expires)}`].filter(Boolean).join(' · ')}</Text>
                    {e.notes ? <Text variant="caption">{e.notes}</Text> : null}
                  </View>
                  {isStaff ? <IconButton icon={Trash2} label={`Remove ${e.equipment_type}`} tone="destructive" onPress={() => void removeEquipment(e)} /> : null}
                </Card>
              ))}
              {isStaff ? (eqOpen ? (
                <Card style={styles.section}>
                  <Text variant="heading">Add equipment</Text>
                  <TextField label="Equipment type *" value={eq.equipment_type} onChangeText={(v) => setEq({ ...eq, equipment_type: v })} placeholder="e.g. Furnace" />
                  <View style={styles.row}><View style={styles.grow}><TextField label="Brand" value={eq.brand} onChangeText={(v) => setEq({ ...eq, brand: v })} /></View><View style={styles.grow}><TextField label="Model" value={eq.model} onChangeText={(v) => setEq({ ...eq, model: v })} /></View></View>
                  <View style={styles.row}><View style={styles.grow}><TextField label="Serial number" value={eq.serial_number} onChangeText={(v) => setEq({ ...eq, serial_number: v })} autoCapitalize="characters" /></View><View style={styles.grow}><TextField label="Location" value={eq.location} onChangeText={(v) => setEq({ ...eq, location: v })} /></View></View>
                  <View style={styles.row}><View style={styles.grow}><TextField label="Install date" value={eq.install_date} onChangeText={(v) => setEq({ ...eq, install_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View><View style={styles.grow}><TextField label="Warranty expires" value={eq.warranty_expires} onChangeText={(v) => setEq({ ...eq, warranty_expires: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View></View>
                  <TextField label="Notes" value={eq.notes} onChangeText={(v) => setEq({ ...eq, notes: v })} />
                  <View style={styles.row}><Button label="Cancel" variant="ghost" onPress={() => setEqOpen(false)} /><Button label="Add equipment" onPress={() => void addEquipment()} loading={busy === 'eq'} style={styles.grow} /></View>
                </Card>
              ) : <Button label="Add equipment" variant="outline" icon={<Plus size={16} color={colors.foreground} />} onPress={() => setEqOpen(true)} />) : null}
            </View>
          ) : null}
          {tab === 'agreements' ? (
            <View style={styles.section}>
              {agreements === null ? <Skeleton height={80} /> : agreements.length === 0 ? <Text variant="small" color="mutedForeground">No service agreements.</Text> : agreements.map((a) => (
                <Card key={a.id} style={styles.itemRow}>
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{a.plan_name} <Text variant="caption" color="mutedForeground">· {a.frequency} · {a.visits_per_year}/yr · ${Number(a.price).toFixed(2)}</Text></Text>
                    <Text variant="caption" color="mutedForeground">{[`From ${day(a.start_date)}`, a.end_date && `to ${day(a.end_date)}`, a.next_service_date && `next ${day(a.next_service_date)}`].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {isStaff ? <><Toggle value={!!a.is_active} onValueChange={() => void toggleAgreement(a)} accessibilityLabel={`${a.plan_name} active`} /><IconButton icon={Trash2} label={`Remove ${a.plan_name}`} tone="destructive" onPress={() => void removeAgreement(a)} /></> : null}
                </Card>
              ))}
              {isStaff ? (agOpen ? (
                <Card style={styles.section}>
                  <Text variant="heading">Add agreement</Text>
                  <TextField label="Plan name *" value={ag.plan_name} onChangeText={(v) => setAg({ ...ag, plan_name: v })} />
                  <TextField label="Frequency" value={ag.frequency} onChangeText={(v) => setAg({ ...ag, frequency: v })} placeholder="annual / semi-annual / quarterly" autoCapitalize="none" />
                  <View style={styles.row}><View style={styles.grow}><TextField label="Visits per year *" value={ag.visits_per_year} onChangeText={(v) => setAg({ ...ag, visits_per_year: v })} keyboardType="number-pad" /></View><View style={styles.grow}><TextField label="Price *" value={ag.price} onChangeText={(v) => setAg({ ...ag, price: v })} keyboardType="decimal-pad" /></View></View>
                  <View style={styles.row}><View style={styles.grow}><TextField label="Start date *" value={ag.start_date} onChangeText={(v) => setAg({ ...ag, start_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View><View style={styles.grow}><TextField label="End date" value={ag.end_date} onChangeText={(v) => setAg({ ...ag, end_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /></View></View>
                  <TextField label="Next service" value={ag.next_service_date} onChangeText={(v) => setAg({ ...ag, next_service_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                  <View style={styles.row}><Button label="Cancel" variant="ghost" onPress={() => setAgOpen(false)} /><Button label="Add agreement" onPress={() => void addAgreement()} loading={busy === 'ag'} style={styles.grow} /></View>
                </Card>
              ) : <Button label="Add agreement" variant="outline" icon={<Plus size={16} color={colors.foreground} />} onPress={() => setAgOpen(true)} />) : null}
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
  const { colors } = useTheme();
  return (
    <Button label={label} variant="secondary" size="sm" icon={<Icon size={16} color={colors.accent} />} onPress={onPress} style={styles.quickBtn} />
  );
}

function ContactLine({ icon: Icon, value, onPress }: { icon: typeof Phone; value: string | null | undefined; onPress?: () => void }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.contact}>
      <Icon size={16} color={colors.mutedForeground} />
      <Text variant="small" color={onPress ? 'accent' : 'foreground'} style={styles.grow} onPress={onPress}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing[12] },
  pad: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickBtn: { flexGrow: 1 },
  section: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  contact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  serviceLine: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
