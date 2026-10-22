import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';
import { formatMoney } from '@/utils/estimateMath';
import type { Estimate, EstimateLineItem, EstimateStatus, Job } from '@/types';
import { Button, Card, EmptyState, Sheet, Skeleton, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useJobEstimates } from '~/features/jobs/useJobEstimates';
import { toast } from '~/features/toast/store';
import { estimatesService } from '~/services/estimates';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

const STATUS_COLOR: Record<EstimateStatus, string> = { draft: '#64748b', pending_approval: '#d97706', approved: '#0284c7', rejected: '#dc2626', sent: '#4f46e5', accepted: '#059669', declined: '#e11d48', void: '#94a3b8' };

export function EstimateStatusBadge({ status }: { status: EstimateStatus | string }) {
  const s = status as EstimateStatus;
  const color = STATUS_COLOR[s] ?? STATUS_COLOR.draft;
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.12), borderColor: withAlpha(color, 0.4) }]}>
      <Text variant="caption" color={color}>{estimatesService.ESTIMATE_STATUS_LABELS[s] ?? status}</Text>
    </View>
  );
}

/** Estimates for a job: list, quick detail sheet with the workflow actions; rows and "New estimate" open the editor screen. */
export function EstimateList({ job }: { job: Job }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { isStaff } = useAuth();
  const { estimates, loading, error, upsert } = useJobEstimates(job.id);
  const openEditor = (id: string) => router.push({ pathname: '/estimate/[id]', params: { id, jobId: job.id } });
  const [open, setOpen] = useState<Estimate | null>(null);
  const [items, setItems] = useState<EstimateLineItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const show = async (e: Estimate) => {
    setOpen(e);
    setItems(null);
    const { data } = await estimatesService.listLineItems(e.id);
    setItems(data ?? []);
  };

  const run = async (label: string, action: () => Promise<{ data: Estimate | null; error: { message: string } | null } | { data: { success: boolean } | null; error: { message: string } | null }>) => {
    setBusy(label);
    const result = await action();
    setBusy(null);
    if (result.error) { toast.error(result.error.message); return; }
    if (result.data && 'id' in result.data) { upsert(result.data); setOpen(result.data); }
    toast.success(label === 'Send' ? 'Estimate emailed to the client' : `Estimate ${label.toLowerCase()}ed`.replace('Submitted', 'submitted'));
  };

  const current = open ? estimates.find((e) => e.id === open.id) ?? open : null;

  return (
    <View style={styles.wrap}>
      {job.status !== 'completed' ? <Button label="New estimate" variant="outline" icon={<Plus size={16} color={colors.foreground} />} onPress={() => openEditor('new')} /> : null}
      {loading && estimates.length === 0 ? <View style={styles.wrap}><Skeleton height={64} /><Skeleton height={64} /></View>
        : estimates.length === 0 ? <EmptyState icon={FileText} title="No estimates yet for this job" message={error ?? 'Create one with the catalog picker and send it to the client.'} />
        : estimates.map((e) => (
          <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`Estimate ${e.estimate_number}, ${e.title}, ${formatMoney(Number(e.total))}`} onPress={() => void show(e)}>
            <Card style={styles.rowCard}>
              <View style={styles.rowText}>
                <View style={styles.rowHead}><Text variant="mono" color="mutedForeground">{e.estimate_number}</Text><EstimateStatusBadge status={e.status} /></View>
                <Text variant="bodyMedium">{e.title}</Text>
                <Text variant="caption" color="mutedForeground">{new Date(e.created_at).toLocaleDateString()}{e.valid_until ? ` · valid until ${new Date(`${e.valid_until}T12:00:00`).toLocaleDateString()}` : ''}</Text>
              </View>
              <Text variant="heading">{formatMoney(Number(e.total))}</Text>
            </Card>
          </Pressable>
        ))}

      <Sheet open={!!current} onClose={() => setOpen(null)} title={current?.title} description={current ? `${current.estimate_number} · ${estimatesService.ESTIMATE_STATUS_LABELS[current.status]}` : undefined}>
        {current ? (
          <>
            {current.description ? <Text variant="small" color="mutedForeground">{current.description}</Text> : null}
            {items === null ? <Skeleton height={48} /> : items.length === 0 ? <Text variant="small" color="mutedForeground">No line items.</Text> : items.map((li) => (
              <View key={li.id} style={[styles.line, { borderBottomColor: colors.border }]}>
                <View style={styles.rowText}>
                  <Text variant="small">{li.name}</Text>
                  <Text variant="caption" color="mutedForeground">{li.kind} · {li.quantity} {li.unit ?? ''} × {formatMoney(Number(li.unit_price))}</Text>
                </View>
                <Text variant="small">{formatMoney(Number(li.quantity) * Number(li.unit_price))}</Text>
              </View>
            ))}
            <View style={styles.totals}>
              <Row label="Parts" value={formatMoney(Number(current.subtotal_parts))} />
              <Row label="Services" value={formatMoney(Number(current.subtotal_services))} />
              {Number(current.discount_amount) > 0 ? <Row label="Discount" value={`-${formatMoney(Number(current.discount_amount))}`} /> : null}
              <Row label={`Tax (${Number(current.tax_rate)}%)`} value={formatMoney(Number(current.tax_amount))} />
              <Row label="Total" value={formatMoney(Number(current.total))} bold />
            </View>
            {current.rejection_reason ? <Text variant="small" color="destructive">Rejected: {current.rejection_reason}</Text> : null}
            <View style={styles.actions}>
              <Button label={estimatesService.isReadOnly(current.status) ? 'View details' : 'Edit'} variant="outline" onPress={() => { setOpen(null); openEditor(current.id); }} />
              {estimatesService.canSubmit(current.status) ? <Button label="Submit for approval" onPress={() => void run('Submit', () => estimatesService.submitForApproval(current))} loading={busy === 'Submit'} /> : null}
              {estimatesService.canApprove(current.status, isStaff) ? <Button label="Approve" onPress={() => void run('Approv', () => estimatesService.approve(current))} loading={busy === 'Approv'} /> : null}
              {estimatesService.canReject(current.status, isStaff) ? <Button label="Reject" variant="outline" onPress={() => void run('Reject', () => estimatesService.reject(current))} loading={busy === 'Reject'} /> : null}
              {estimatesService.canSend(current, isStaff) ? <Button label="Send to client" onPress={() => void run('Send', () => estimatesService.sendToClient(current))} loading={busy === 'Send'} /> : null}
              {current.status === 'void' && isStaff ? <Button label="Reopen" variant="outline" onPress={() => void run('Reopen', () => estimatesService.reopen(current))} loading={busy === 'Reopen'} /> : null}
              {estimatesService.canVoid(current.status, isStaff) ? <Button label="Void" variant="ghost" onPress={() => void run('Void', () => estimatesService.voidEstimate(current))} loading={busy === 'Void'} /> : null}
            </View>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <View style={styles.totalRow}><Text variant={bold ? 'bodyMedium' : 'small'} color={bold ? 'foreground' : 'mutedForeground'}>{label}</Text><Text variant={bold ? 'heading' : 'small'}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  badge: { borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[2], paddingVertical: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth },
  totals: { gap: 4, paddingTop: spacing[2] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingTop: spacing[2] },
});
