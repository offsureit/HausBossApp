import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MapPin, Phone, Plus, Search, UserRound, WifiOff } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { Button, EmptyState, IconButton, PressableScale, Screen, SkeletonCard, Text, TextField, Toggle } from '~/components/ui';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCustomersQuery } from '~/features/customers/useCustomers';
import { customersService } from '~/services/customers';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Customers (staff): searchable company list → detail; "+" creates (brief screen 6). */
export default function CustomersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { companyId } = useCompany();
  const [includeInactive, setIncludeInactive] = useState(false);
  const customers = useCustomersQuery(companyId, true, includeInactive);
  const { enterUp } = useMotion();
  const [query, setQuery] = useState('');
  const list = useMemo(() => (customers.data ?? []).filter((c) => customersService.matchesCustomer(c, query)), [customers.data, query]);

  return (
    <Screen scroll edges={['left', 'right']} refreshing={customers.isRefetching} onRefresh={() => void customers.refetch()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Customers', headerBackTitle: 'Back', headerRight: () => <IconButton icon={Plus} label="New customer" variant="filled" tone="accent" onPress={() => router.push('/customers/new')} /> }} />
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name, company, phone, email or address" autoCorrect={false} leading={<Search size={18} color={colors.mutedForeground} />} />
      <View style={styles.toggle}>
        <Text variant="small" color="mutedForeground" style={styles.grow}>{list.length} customer{list.length === 1 ? '' : 's'}</Text>
        <Text variant="caption" color="mutedForeground">Show inactive</Text>
        <Toggle value={includeInactive} onValueChange={setIncludeInactive} accessibilityLabel="Show inactive customers" />
      </View>
      {customers.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        : customers.isError && !customers.data ? <EmptyState icon={WifiOff} title="Couldn't load customers" message={customers.error.message} action={<Button label="Retry" variant="outline" onPress={() => void customers.refetch()} />} />
        : list.length === 0 ? <EmptyState icon={UserRound} title={query ? 'No customers match' : 'No customers yet'} message={query ? undefined : 'Customers are created from jobs or with the + button.'} action={query ? undefined : <Button label="New customer" onPress={() => router.push('/customers/new')} />} />
        : (
          <View>
            {list.map((c, i) => (
              <Animated.View key={c.id} entering={enterUp(i)}>
                <PressableScale accessibilityRole="button" accessibilityLabel={`Open ${c.name}`} onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })} scaleTo={0.985} style={[styles.row, { borderBottomColor: colors.border }]}>
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{c.name}{c.is_active === false ? <Text variant="caption" color="mutedForeground"> · inactive</Text> : null}</Text>
                    {c.phone ? <View style={styles.meta}><Phone size={12} color={colors.mutedForeground} /><Text variant="caption" color="mutedForeground">{c.phone}</Text></View> : null}
                    {c.address ? <View style={styles.meta}><MapPin size={12} color={colors.mutedForeground} /><Text variant="caption" color="mutedForeground" style={styles.grow}>{c.address}</Text></View> : null}
                  </View>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[3] },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  row: { paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
});
