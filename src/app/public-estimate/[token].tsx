import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Building2, CheckCircle2, FileText, Mail, Phone, XCircle } from 'lucide-react-native';
import { formatMoney } from '@/utils/estimateMath';
import type { EstimateLineItem } from '@/types';
import { Button, Card, Dialog, EmptyState, Screen, ScreenHeader, Skeleton, Text } from '~/components/ui';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { ESTIMATE_STATUS_LABELS, estimatesService, type PublicEstimate } from '~/services/estimates';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/**
 * Customer-facing estimate (`hausboss.app/estimate/:token`, web `PublicEstimate`): the company
 * block, line items, totals and Accept / Decline while the estimate is `sent`. No sign-in needed.
 */
export default function PublicEstimateScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<'accept' | 'decline' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setError('This link is missing its token.'); setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await estimatesService.getPublic(token);
    setError(err?.message ?? null);
    setEstimate(data ?? null);
    setLoading(false);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const respond = async () => {
    if (!token || !confirm) return;
    setBusy(true);
    const { data, error: err } = await estimatesService.respondPublic(token, confirm);
    setBusy(false);
    setConfirm(null);
    if (err || !data) { toast.error(err?.message ?? 'Could not send your answer'); haptics.error(); return; }
    haptics.success();
    setEstimate((e) => (e ? { ...e, status: data.status, responded_at: new Date().toISOString() } : e));
    toast.success(data.status === 'accepted' ? 'Estimate accepted — the company has been notified' : 'Estimate declined');
  };

  const parts = estimate?.line_items.filter((i) => i.kind === 'part') ?? [];
  const services = estimate?.line_items.filter((i) => i.kind === 'service') ?? [];
  const money = (n: number | string | null | undefined) => formatMoney(Number(n ?? 0));

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Estimate' }} />
      {loading ? (
        <View style={styles.stack}><Skeleton height={28} width="60%" /><Skeleton height={16} width="40%" /><Skeleton height={160} /></View>
      ) : error || !estimate ? (
        <EmptyState icon={FileText} title="Estimate unavailable" message={error ?? 'This estimate is no longer available.'} action={<Button label="Try again" variant="outline" onPress={() => void load()} />} />
      ) : (
        <>
          <ScreenHeader title={estimate.title} subtitle={`${estimate.estimate_number} · ${ESTIMATE_STATUS_LABELS[estimate.status] ?? estimate.status}`} large={false} />
          {estimate.company ? (
            <Card style={styles.stack}>
              <View style={styles.row}><Building2 size={16} color={colors.mutedForeground} /><Text variant="bodyMedium">{estimate.company.name ?? 'Your contractor'}</Text></View>
              {estimate.company.phone ? <Text variant="small" color="accent" onPress={() => void links.call(estimate.company?.phone ?? '')}><Phone size={12} color={colors.accent} /> {estimate.company.phone}</Text> : null}
              {estimate.company.email ? <Text variant="small" color="accent" onPress={() => void links.email(estimate.company?.email ?? '')}><Mail size={12} color={colors.accent} /> {estimate.company.email}</Text> : null}
              {estimate.company.address ? <Text variant="small" color="mutedForeground">{estimate.company.address}</Text> : null}
            </Card>
          ) : null}
          {estimate.client_name || estimate.client_address ? (
            <Card style={styles.stack}>
              <Text variant="overline" color="mutedForeground">Prepared for</Text>
              {estimate.client_name ? <Text variant="bodyMedium">{estimate.client_name}</Text> : null}
              {estimate.client_address ? <Text variant="small" color="mutedForeground">{estimate.client_address}</Text> : null}
            </Card>
          ) : null}
          {estimate.description ? <Text variant="body">{estimate.description}</Text> : null}
          {([['Parts', parts], ['Services', services]] as const).map(([title, rows]) => rows.length ? (
            <Card key={title} style={styles.stack}>
              <Text variant="label">{title}</Text>
              {rows.map((i: EstimateLineItem) => (
                <View key={i.id} style={styles.line}>
                  <View style={styles.lineText}>
                    <Text variant="body">{i.name}</Text>
                    <Text variant="caption" color="mutedForeground">{Number(i.quantity)} {i.unit ?? ''} × {money(i.unit_price)}</Text>
                  </View>
                  <Text variant="bodyMedium">{money(Number(i.quantity) * Number(i.unit_price))}</Text>
                </View>
              ))}
            </Card>
          ) : null)}
          {estimate.line_items.length === 0 ? <Text variant="small" color="mutedForeground">No line items.</Text> : null}
          <Card style={styles.stack}>
            <Total label="Parts" value={money(estimate.subtotal_parts)} />
            <Total label="Services" value={money(estimate.subtotal_services)} />
            {Number(estimate.discount_amount) > 0 ? <Total label="Discount" value={`−${money(estimate.discount_amount)}`} /> : null}
            {Number(estimate.tax_rate) > 0 ? <Total label={`Tax (${Number(estimate.tax_rate)}%)`} value={money(estimate.tax_amount)} /> : null}
            <View style={[styles.line, styles.grand, { borderTopColor: colors.border }]}><Text variant="heading">Total</Text><Text variant="heading">{money(estimate.total)}</Text></View>
          </Card>
          {estimate.notes ? <Text variant="small" color="mutedForeground">{estimate.notes}</Text> : null}
          {estimate.status === 'sent' ? (
            <View style={styles.stack}>
              <Button label="Accept estimate" size="lg" fullWidth icon={<CheckCircle2 size={20} color={colors.accentForeground} />} onPress={() => setConfirm('accept')} />
              <Button label="Decline" variant="outline" fullWidth icon={<XCircle size={18} color={colors.foreground} />} onPress={() => setConfirm('decline')} />
            </View>
          ) : (
            <View style={[styles.row, styles.answer]}>
              {estimate.status === 'accepted' ? <CheckCircle2 size={20} color={colors.success} /> : <XCircle size={20} color={colors.mutedForeground} />}
              <Text variant="small" color="mutedForeground">{estimate.status === 'accepted' ? 'You accepted this estimate.' : estimate.status === 'declined' ? 'You declined this estimate.' : 'This estimate is not awaiting a response.'}</Text>
            </View>
          )}
          <Dialog
            open={!!confirm}
            onClose={() => setConfirm(null)}
            title={confirm === 'accept' ? 'Accept this estimate?' : 'Decline this estimate?'}
            description={confirm === 'accept' ? `${money(estimate.total)} total. The company will be notified and will get in touch to schedule the work.` : 'The company will be notified. You can always ask for a revised estimate.'}
            confirmLabel={confirm === 'accept' ? 'Accept' : 'Decline'}
            confirmVariant={confirm === 'accept' ? 'primary' : 'destructive'}
            onConfirm={respond}
            busy={busy}
          />
        </>
      )}
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return <View style={styles.line}><Text variant="small" color="mutedForeground">{label}</Text><Text variant="small">{value}</Text></View>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  lineText: { flex: 1, minWidth: 0 },
  grand: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], marginTop: spacing[1] },
  answer: { paddingVertical: spacing[2] },
});
