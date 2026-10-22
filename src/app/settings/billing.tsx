import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { format } from 'date-fns';
import { CreditCard, ExternalLink } from 'lucide-react-native';
import type { SeatStatus } from '@/types';
import { Button, Card, Screen, Skeleton, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { API_URL } from '~/lib/env';
import { links } from '~/lib/links';
import { billingService } from '~/services/billing';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Billing, read-only (brief: purchases happen on the web): plan, status, renewal, seats. */
export default function BillingScreen() {
  const { colors } = useTheme();
  const { isStaff } = useAuth();
  const { subscription, refresh } = useCompany();
  const [seats, setSeats] = useState<SeatStatus | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStaff) { setSeats(null); return; }
    let alive = true;
    void billingService.getSeats().then(({ data, error: err }) => { if (!alive) return; setSeats(data ?? null); setError(err?.message ?? null); });
    return () => { alive = false; };
  }, [isStaff]);

  const plan = subscription?.tier ? billingService.PLAN_TITLE[subscription.tier] ?? subscription.tier : '—';
  const status = subscription ? billingService.STATUS_LABEL[subscription.status] ?? subscription.status : '—';
  const ends = subscription?.currentPeriodEnd ? format(new Date(subscription.currentPeriodEnd), 'PP') : subscription?.status === 'lifetime' || subscription?.tier === 'lifetime' ? 'Never' : '—';

  return (
    <Screen scroll edges={['left', 'right']} contentContainerStyle={styles.content} onRefresh={() => void refresh()} refreshing={false}>
      <Stack.Screen options={{ title: 'Billing', headerBackTitle: 'Back' }} />
      <Card style={styles.card}>
        <View style={styles.head}><CreditCard size={18} color={colors.accent} /><Text variant="heading">Plan</Text></View>
        <Row label="Package" value={plan} />
        <Row label="Status" value={status} tone={subscription?.isEntitled ? 'success' : 'mutedForeground'} />
        <Row label={subscription?.cancelAtPeriodEnd ? 'Ends' : 'Renews / ends'} value={ends} />
        <Row label="Source" value={subscription?.source ?? '—'} last />
      </Card>
      {isStaff ? (
        <Card style={styles.card}>
          <Text variant="heading">Users</Text>
          {seats === undefined ? <Skeleton height={44} /> : !seats || !seats.enabled ? <Text variant="small" color="mutedForeground">{error ?? 'Seat limits are not enabled for this company.'}</Text> : (
            <>
              <Row label="In use" value={`${seats.used} of ${seats.seats}`} tone={seats.over_limit ? 'destructive' : 'foreground'} />
              <Row label="Included" value={`${seats.included}${seats.lifetime_seats ? ` + ${seats.lifetime_seats} lifetime seat${seats.lifetime_seats === 1 ? '' : 's'}` : ''}${seats.extra_users ? ` + ${seats.extra_users} extra` : ''}`} />
              <Row label="Extra user" value={seats.seat_price_cents != null ? `${billingService.formatCents(seats.seat_price_cents)} ${seats.seat_price_interval === 'once' ? 'once' : 'per month'}` : '—'} last />
            </>
          )}
        </Card>
      ) : null}
      <Card style={styles.card}>
        <Text variant="small" color="mutedForeground">Plans, payment methods, SMS and email credits are managed on the web. Changes apply here after the next refresh.</Text>
        <Button label="Open billing on the web" variant="outline" icon={<ExternalLink size={16} color={colors.foreground} />} onPress={() => void links.url(`${API_URL}/settings#billing`)} />
      </Card>
    </Screen>
  );
}

function Row({ label, value, tone = 'foreground', last = false }: { label: string; value: string; tone?: 'foreground' | 'success' | 'mutedForeground' | 'destructive'; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text variant="small" color="mutedForeground">{label}</Text>
      <Text variant="small" color={tone} style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  card: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3], paddingVertical: spacing[2] },
  value: { flex: 1, textAlign: 'right' },
});
