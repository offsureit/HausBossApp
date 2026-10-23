import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Building2, CheckCircle2, FileText, Mail, MapPin, Package, Phone, UserRound, Wrench, XCircle } from 'lucide-react-native';
import { formatMoney } from '@/utils/estimateMath';
import type { EstimateLineItem } from '@/types';
import { Button, Card, Dialog, EmptyState, GradientBackdrop, HERO_TEXT_MUTED, InfoRow, Screen, SectionCard, Skeleton, Text } from '~/components/ui';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { ESTIMATE_STATUS_LABELS, estimatesService, type PublicEstimate } from '~/services/estimates';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

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
    <Screen scroll edges={['left', 'right', 'bottom']} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ headerShown: true, title: 'Estimate' }} />
      {loading ? (
        <View style={styles.stack}><Skeleton height={28} width="60%" /><Skeleton height={16} width="40%" /><Skeleton height={160} /></View>
      ) : error || !estimate ? (
        <EmptyState icon={FileText} title="Estimate unavailable" message={error ?? 'This estimate is no longer available.'} action={<Button label="Try again" variant="outline" onPress={() => void load()} />} />
      ) : (
        <>
          {/* Summary card: the brand gradient with the title, number, status and total. */}
          <View style={styles.heroCard}>
            <GradientBackdrop rounded={radius.xxl} />
            <View style={styles.row}>
              <Text variant="mono" color={HERO_TEXT_MUTED} style={styles.lineText}>{estimate.estimate_number}</Text>
              <View style={styles.heroChip}><Text variant="caption" color="#ffffff" style={styles.strong}>{ESTIMATE_STATUS_LABELS[estimate.status] ?? estimate.status}</Text></View>
            </View>
            <Text variant="title" color="#ffffff">{estimate.title}</Text>
            {estimate.company?.name ? <Text variant="small" color={HERO_TEXT_MUTED}>From {estimate.company.name}</Text> : null}
            <Text variant="caption" color={HERO_TEXT_MUTED} style={styles.heroLabel}>Total</Text>
            <Text style={styles.heroAmount} color="#ffffff">{money(estimate.total)}</Text>
          </View>
          {estimate.company ? (
            <SectionCard title={estimate.company.name ?? 'Your contractor'} subtitle="Contractor" icon={Building2} flush>
              {[
                estimate.company.phone ? <InfoRow key="p" first icon={Phone} label="Phone" value={estimate.company.phone} onPress={() => void links.call(estimate.company?.phone ?? '')} /> : null,
                estimate.company.email ? <InfoRow key="e" first={!estimate.company.phone} icon={Mail} label="Email" value={estimate.company.email} onPress={() => void links.email(estimate.company?.email ?? '')} /> : null,
                estimate.company.address ? <InfoRow key="a" first={!estimate.company.phone && !estimate.company.email} icon={MapPin} label="Address" value={estimate.company.address} /> : null,
              ]}
            </SectionCard>
          ) : null}
          {estimate.client_name || estimate.client_address ? (
            <SectionCard title={estimate.client_name || 'Prepared for you'} subtitle="Prepared for" icon={UserRound} color={colors.success}>
              {estimate.client_address ? <Text variant="small" color="mutedForeground">{estimate.client_address}</Text> : null}
            </SectionCard>
          ) : null}
          {estimate.description ? <Text variant="body">{estimate.description}</Text> : null}
          {([['Parts', parts], ['Services', services]] as const).map(([title, rows]) => rows.length ? (
            <SectionCard key={title} title={title} icon={title === 'Parts' ? Package : Wrench} color={title === 'Parts' ? colors.accent : colors.success}>
              {rows.map((i: EstimateLineItem) => (
                <View key={i.id} style={styles.line}>
                  <View style={styles.lineText}>
                    <Text variant="body">{i.name}</Text>
                    <Text variant="caption" color="mutedForeground">{Number(i.quantity)} {i.unit ?? ''} × {money(i.unit_price)}</Text>
                  </View>
                  <Text variant="bodyMedium">{money(Number(i.quantity) * Number(i.unit_price))}</Text>
                </View>
              ))}
            </SectionCard>
          ) : null)}
          {estimate.line_items.length === 0 ? <Text variant="small" color="mutedForeground">No line items.</Text> : null}
          <Card style={styles.stack}>
            <Total label="Parts" value={money(estimate.subtotal_parts)} />
            <Total label="Services" value={money(estimate.subtotal_services)} />
            {Number(estimate.discount_amount) > 0 ? <Total label="Discount" value={`−${money(estimate.discount_amount)}`} /> : null}
            {Number(estimate.tax_rate) > 0 ? <Total label={`Tax (${Number(estimate.tax_rate)}%)`} value={money(estimate.tax_amount)} /> : null}
            <View style={[styles.line, styles.grand, { borderTopColor: colors.border }]}><Text variant="heading">Total</Text><Text variant="title" color="accent">{money(estimate.total)}</Text></View>
          </Card>
          {estimate.notes ? <Text variant="small" color="mutedForeground">{estimate.notes}</Text> : null}
          {estimate.status === 'sent' ? (
            <View style={styles.stack}>
              <Button label="Accept estimate" size="lg" fullWidth icon={<CheckCircle2 size={20} color={colors.accentForeground} />} onPress={() => setConfirm('accept')} />
              <Button label="Decline" variant="outline" size="lg" fullWidth icon={<XCircle size={18} color={colors.foreground} />} onPress={() => setConfirm('decline')} />
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
  page: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  lineText: { flex: 1, minWidth: 0 },
  grand: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], marginTop: spacing[1] },
  answer: { paddingVertical: spacing[2] },
  heroCard: { borderRadius: radius.xxl, padding: spacing[5], gap: spacing[1], overflow: 'hidden' },
  heroChip: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: spacing[2], paddingVertical: 2 },
  heroLabel: { marginTop: spacing[3] },
  heroAmount: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  strong: { fontFamily: 'Inter_600SemiBold' },
});
