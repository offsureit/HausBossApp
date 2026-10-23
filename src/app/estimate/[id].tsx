import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format, parse } from 'date-fns';
import { Check, FileText, Link2, Percent, Send, ShieldCheck, ShieldX, Trash2, UserRound, XCircle } from 'lucide-react-native';
import { DEFAULT_TAX_RATE, computeTotals, formatMoney } from '@/utils/estimateMath';
import type { Estimate, EstimateLineItem, EstimateLineItemInput, EstimateSaveInput, Job, LineItemKind } from '@/types';
import { CatalogPickerSheet } from '~/components/estimates/CatalogPickerSheet';
import { LineItemsSection } from '~/components/estimates/LineItemsSection';
import { EstimateStatusBadge } from '~/components/jobs/EstimateList';
import { Button, Card, DateTimeField, Dialog, EmptyState, GradientBackdrop, HERO_TEXT_MUTED, SectionCard, Skeleton, Text, TextField, Toggle } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { estimatesService } from '~/services/estimates';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

interface Draft {
  title: string; description: string; valid_until: string; client_name: string; client_email: string; client_phone: string; client_address: string; notes: string;
  discount_amount: string; tax_rate: string; taxEnabled: boolean; items: EstimateLineItemInput[];
}

function fromEstimate(job: Job, estimate: Estimate | null, lineItems: EstimateLineItem[]): Draft {
  if (!estimate) {
    return { title: `${job.category || job.serviceType || 'Service'} estimate`, description: '', valid_until: '', client_name: job.clientName, client_email: job.clientEmail, client_phone: job.clientPhone, client_address: job.clientAddress, notes: '', discount_amount: '0', tax_rate: String(DEFAULT_TAX_RATE), taxEnabled: true, items: [] };
  }
  const rate = Number(estimate.tax_rate);
  return {
    title: estimate.title, description: estimate.description ?? '', valid_until: estimate.valid_until ?? '', client_name: estimate.client_name ?? '', client_email: estimate.client_email ?? '', client_phone: estimate.client_phone ?? '', client_address: estimate.client_address ?? '', notes: estimate.notes ?? '',
    discount_amount: String(Number(estimate.discount_amount)), tax_rate: String(rate > 0 ? rate : DEFAULT_TAX_RATE), taxEnabled: rate > 0,
    items: lineItems.map((li) => ({ id: li.id, kind: li.kind as LineItemKind, name: li.name, description: li.description, quantity: Number(li.quantity), unit: li.unit, unit_price: Number(li.unit_price), sort_order: li.sort_order, catalog_item_id: li.catalog_item_id })),
  };
}

const money = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Estimate editor (web `EstimateEditor`): header, parts / services with the catalog picker,
 * discount / tax / notes, live totals and the §14 workflow actions. `id=new&jobId=…` creates.
 */
export default function EstimateScreen() {
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isStaff, isAdmin } = useAuth();
  const { companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const isNew = id === 'new';
  const [current, setCurrent] = useState<Estimate | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<LineItemKind | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const job = useMemo(() => jobs.data?.find((j) => j.id === (current?.job_id ?? jobId)) ?? null, [jobs.data, current?.job_id, jobId]);

  useEffect(() => {
    if (isNew || current) return;
    let cancelled = false;
    void estimatesService.get(id).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { toast.error(error?.message ?? 'Estimate not found'); router.back(); return; }
      setCurrent(data);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [id, isNew, current, router]);

  useEffect(() => {
    if (!job || draft || !loaded) return;
    setDraft(fromEstimate(job, current, (current as (Estimate & { line_items?: EstimateLineItem[] }) | null)?.line_items ?? []));
  }, [job, current, draft, loaded]);

  const status = current?.status ?? 'draft';
  const readOnly = estimatesService.isReadOnly(status) || (status === 'approved' && !isStaff);
  const totals = useMemo(() => (draft ? computeTotals({ items: draft.items, taxRate: money(draft.tax_rate), discountAmount: money(draft.discount_amount), taxEnabled: draft.taxEnabled }) : null), [draft]);
  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d)), []);

  const buildInput = (statusOverride?: Estimate['status']): EstimateSaveInput | null => {
    if (!draft || !job) return null;
    return {
      id: current?.id, job_id: job.id, company_id: job.companyId, title: draft.title, description: draft.description || null, status: statusOverride,
      client_name: draft.client_name || null, client_email: draft.client_email || null, client_phone: draft.client_phone || null, client_address: draft.client_address || null,
      discount_amount: money(draft.discount_amount), tax_rate: draft.taxEnabled ? money(draft.tax_rate) : 0, notes: draft.notes || null, valid_until: draft.valid_until || null, items: draft.items,
    };
  };

  const applySaved = (saved: Estimate) => {
    setCurrent(saved);
    const items = (saved as Estimate & { line_items?: EstimateLineItem[] }).line_items;
    if (items && job) setDraft(fromEstimate(job, saved, items));
    if (isNew) router.setParams({ id: saved.id });
  };

  const run = async (label: string, fn: () => Promise<{ data: Estimate | null; error: { message: string } | null }>, success: string) => {
    setBusy(label);
    const { data, error } = await fn();
    setBusy(null);
    if (error) { toast.error(error.message); haptics.error(); return null; }
    if (data) { applySaved(data); toast.success(success); haptics.success(); }
    return data;
  };
  const save = async () => { const input = buildInput(); if (input) return run('save', () => estimatesService.saveEstimate(input), 'Estimate saved'); return null; };
  const submit = async () => {
    const input = buildInput(); if (!input) return;
    setBusy('submit');
    const saved = await estimatesService.saveEstimate(input);
    if (saved.error || !saved.data) { setBusy(null); toast.error(saved.error?.message ?? 'Could not save'); return; }
    applySaved(saved.data);
    const { data, error } = await estimatesService.submitForApproval(saved.data);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    if (data) { setCurrent(data); toast.success('Submitted for approval'); haptics.success(); }
  };
  const saveAndApprove = async () => {
    const input = buildInput(); if (!input) return;
    await run('approve', async () => { const saved = await estimatesService.saveEstimate(input); if (saved.error || !saved.data) return saved; return estimatesService.approve(saved.data); }, 'Estimate approved');
  };
  const send = async () => {
    if (!current) return;
    setBusy('send');
    const { error } = await estimatesService.sendToClient(current);
    if (error) { setBusy(null); toast.error(error.message); return; }
    const fresh = await estimatesService.get(current.id);
    setBusy(null);
    if (fresh.data) setCurrent(fresh.data);
    toast.success(`Estimate emailed to ${current.client_email}`);
    haptics.success();
  };
  const remove = async () => {
    if (!current) return;
    setBusy('delete');
    const { error } = await estimatesService.remove(current.id);
    setBusy(null);
    setDeleteOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Estimate deleted');
    router.back();
  };
  const link = current ? estimatesService.publicLink(current) : null;
  const shareLink = async () => { if (link) await Share.share({ message: link, url: link }).catch(() => undefined); };

  if (!loaded || !draft || !job || !totals) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: isNew ? 'New estimate' : 'Estimate' }} />
        {jobs.isPending || !loaded ? <View style={styles.pad}><Skeleton height={28} width="60%" /><Skeleton height={120} /><Skeleton height={120} /></View>
          : <View style={styles.pad}><EmptyState icon={XCircle} title="Job not found" message="The estimate's job is not in your job list." action={<Button label="Back" variant="outline" onPress={() => router.back()} />} /></View>}
      </View>
    );
  }

  const showSubmit = !isStaff && estimatesService.canSubmit(status);
  const showApprove = isStaff && estimatesService.canApprove(status, true);
  const showReject = isStaff && !!current && ['draft', 'pending_approval', 'approved'].includes(status);
  const showSend = isStaff && !!current && estimatesService.canSend(current, true);
  const showVoid = isStaff && !!current && !['accepted', 'void'].includes(status);
  const validUntil = draft.valid_until ? parse(draft.valid_until, 'yyyy-MM-dd', new Date()) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: current ? current.estimate_number : 'New estimate', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Summary card: the brand gradient with the title, customer, status and live total. */}
        <View style={styles.heroCard}>
          <GradientBackdrop rounded={radius.xxl} />
          <View style={styles.headRow}>
            <Text variant="mono" color={HERO_TEXT_MUTED} style={styles.grow}>{current ? current.estimate_number : 'NEW ESTIMATE'}</Text>
            <EstimateStatusBadge status={status} />
          </View>
          <Text variant="title" color="#ffffff">{draft.title || (current ? current.title : 'New estimate')}</Text>
          <Text variant="small" color={HERO_TEXT_MUTED}>{job.clientName} · Job #{job.id.slice(0, 8).toUpperCase()}</Text>
          <View style={styles.heroTotal}>
            <Text variant="caption" color={HERO_TEXT_MUTED}>Total</Text>
            <Text style={styles.heroAmount} color="#ffffff">{formatMoney(totals.total)}</Text>
          </View>
        </View>
        {current?.rejection_reason && status === 'rejected' ? <View style={[styles.note, { backgroundColor: withAlpha(colors.destructive, 0.08), borderColor: withAlpha(colors.destructive, 0.4) }]}><Text variant="small" color="destructive">Rejected: {current.rejection_reason}</Text></View> : null}
        {readOnly ? <Text variant="caption" color="mutedForeground">Read-only — this estimate has been {status.replace('_', ' ')}.</Text> : null}
        {link && ['sent', 'accepted', 'declined'].includes(status) ? (
          <Card style={styles.linkCard}>
            <Link2 size={16} color={colors.mutedForeground} />
            <Text variant="caption" color="mutedForeground" style={styles.grow}>{link}</Text>
            <Button label="Share" variant="outline" size="sm" onPress={() => void shareLink()} />
          </Card>
        ) : null}

        <SectionCard title="Estimate" icon={FileText}>
        <TextField label="Title *" value={draft.title} onChangeText={(v) => set('title', v)} editable={!readOnly} />
        <TextField label="Description" value={draft.description} onChangeText={(v) => set('description', v)} multiline editable={!readOnly} />
        </SectionCard>
        <SectionCard title="Client" icon={UserRound} color={colors.success}>
        <TextField label="Client name" value={draft.client_name} onChangeText={(v) => set('client_name', v)} editable={!readOnly} />
        <TextField label="Client email" value={draft.client_email} onChangeText={(v) => set('client_email', v)} keyboardType="email-address" autoCapitalize="none" editable={!readOnly} hint="Needed to send the estimate." />
        <View style={styles.row}>
          <View style={styles.grow}><TextField label="Client phone" value={draft.client_phone} onChangeText={(v) => set('client_phone', v)} keyboardType="phone-pad" editable={!readOnly} /></View>
          <View style={styles.grow}><DateTimeField label="Valid until" mode="date" value={validUntil} onChange={(d) => set('valid_until', d ? format(d, 'yyyy-MM-dd') : '')} disabled={readOnly} /></View>
        </View>
        <TextField label="Client address" value={draft.client_address} onChangeText={(v) => set('client_address', v)} multiline editable={!readOnly} />
        </SectionCard>

        <LineItemsSection kind="part" items={draft.items} onChange={(items) => set('items', items)} readOnly={readOnly} onPickFromCatalog={() => setPicker('part')} />
        <LineItemsSection kind="service" items={draft.items} onChange={(items) => set('items', items)} readOnly={readOnly} onPickFromCatalog={() => setPicker('service')} />

        <SectionCard title="Pricing" icon={Percent} color={colors.warning} action={<Toggle value={draft.taxEnabled} onValueChange={(v) => set('taxEnabled', v)} disabled={readOnly} accessibilityLabel="Apply tax" />} subtitle={draft.taxEnabled ? 'Tax applied' : 'No tax'}>
        <View style={styles.row}>
          <View style={styles.grow}><TextField label="Discount ($)" value={draft.discount_amount} onChangeText={(v) => set('discount_amount', v)} keyboardType="decimal-pad" editable={!readOnly} /></View>
          <View style={styles.grow}><TextField label="Tax rate (%)" value={draft.tax_rate} onChangeText={(v) => set('tax_rate', v)} keyboardType="decimal-pad" editable={!readOnly && draft.taxEnabled} /></View>
        </View>
        <TextField label="Internal notes" value={draft.notes} onChangeText={(v) => set('notes', v)} multiline editable={!readOnly} />
        </SectionCard>

        <Card style={styles.totals} accessibilityLabel="Totals">
          <TotalRow label="Parts" value={formatMoney(totals.subtotalParts)} />
          <TotalRow label="Services" value={formatMoney(totals.subtotalServices)} />
          {totals.discountAmount > 0 ? <TotalRow label="Discount" value={`−${formatMoney(totals.discountAmount)}`} /> : null}
          <TotalRow label={`Tax (${totals.taxRate}%)`} value={formatMoney(totals.taxAmount)} />
          <View style={[styles.grandTotal, { borderTopColor: colors.border }]}><Text variant="heading">Total</Text><Text variant="title" color="accent" style={styles.mono}>{formatMoney(totals.total)}</Text></View>
          {current && Number(current.total) !== totals.total && !readOnly ? <Text variant="caption" color="mutedForeground">Saved total: {formatMoney(Number(current.total))}</Text> : null}
        </Card>

        <View style={styles.actions}>
          {!readOnly ? <Button label="Save draft" variant="outline" size="lg" fullWidth onPress={() => void save()} loading={busy === 'save'} disabled={!!busy} /> : null}
          {showSubmit ? <Button size="lg" fullWidth label="Submit for approval" icon={<Check size={18} color={colors.accentForeground} />} onPress={() => void submit()} loading={busy === 'submit'} disabled={!!busy} /> : null}
          {showApprove && current ? <Button size="lg" fullWidth label="Approve" icon={<ShieldCheck size={18} color={colors.accentForeground} />} onPress={() => void run('approve', () => estimatesService.approve(current), 'Estimate approved')} loading={busy === 'approve'} disabled={!!busy} /> : null}
          {showApprove && !current ? <Button size="lg" fullWidth label="Save & approve" icon={<ShieldCheck size={18} color={colors.accentForeground} />} onPress={() => void saveAndApprove()} loading={busy === 'approve'} disabled={!!busy} /> : null}
          {showReject ? <Button size="lg" fullWidth label="Reject" variant="outline" icon={<ShieldX size={18} color={colors.foreground} />} onPress={() => setRejectOpen(true)} disabled={!!busy} /> : null}
          {showSend ? <Button size="lg" fullWidth label="Send to client" icon={<Send size={18} color={colors.accentForeground} />} onPress={() => void send()} loading={busy === 'send'} disabled={!!busy || !draft.client_email} /> : null}
          {showVoid ? <Button fullWidth label="Void" variant="ghost" icon={<XCircle size={18} color={colors.foreground} />} onPress={() => void run('void', () => estimatesService.voidEstimate(current as Estimate), 'Estimate voided')} loading={busy === 'void'} disabled={!!busy} /> : null}
          {status === 'void' && isStaff && current ? <Button size="lg" fullWidth label="Reopen" variant="outline" onPress={() => void run('reopen', () => estimatesService.reopen(current), 'Estimate reopened')} loading={busy === 'reopen'} disabled={!!busy} /> : null}
          {current && isAdmin && !readOnly ? <Button fullWidth label="Delete estimate" variant="danger-ghost" icon={<Trash2 size={18} color={colors.destructive} />} onPress={() => setDeleteOpen(true)} disabled={!!busy} /> : null}
        </View>
      </ScrollView>

      <CatalogPickerSheet open={picker !== null} kind={picker} onClose={() => setPicker(null)} onPick={(item) => set('items', [...draft.items, { ...item, sort_order: draft.items.filter((i) => i.kind === item.kind).length }])} />
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject estimate" description="The technician will see your reason and can revise it." confirmLabel="Reject" confirmVariant="destructive" busy={busy === 'reject'}
        onConfirm={async () => { if (!current) return; const r = await run('reject', () => estimatesService.reject(current, rejectReason), 'Estimate rejected'); if (r) { setRejectOpen(false); setRejectReason(''); } }}>
        <TextField label="Reason" value={rejectReason} onChangeText={setRejectReason} multiline />
      </Dialog>
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this estimate?" description="This cannot be undone." confirmLabel="Delete" confirmVariant="destructive" busy={busy === 'delete'} onConfirm={remove} />
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.totalLine}><Text variant="small" color="mutedForeground">{label}</Text><Text variant="small" style={styles.mono}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { padding: spacing[4], gap: spacing[3] },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[12] },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  note: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3] },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  totals: { gap: spacing[1] },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing[2], paddingTop: spacing[3] },
  heroCard: { borderRadius: radius.xxl, padding: spacing[5], gap: spacing[1], overflow: 'hidden' },
  heroTotal: { marginTop: spacing[3], gap: 2 },
  heroAmount: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing[1] },
  mono: { fontVariant: ['tabular-nums'] },
  actions: { gap: spacing[2], paddingTop: spacing[2] },
});
