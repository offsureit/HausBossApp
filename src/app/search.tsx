import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Briefcase, Search, UserRound } from 'lucide-react-native';
import { jobNumber } from '@/services/adapters/jobAdapter';
import { searchInMemory } from '@/utils/search';
import { Button, EmptyState, PressableScale, StatusBadge, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCustomersQuery } from '~/features/customers/useCustomers';
import { useJobsQuery } from '~/features/jobs/useJobs';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Global search over loaded jobs + customers (web `GlobalSearch`, shared `searchInMemory`). */
export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isStaff } = useAuth();
  const { companyId } = useCompany();
  const jobs = useJobsQuery(companyId);
  const customers = useCustomersQuery(companyId, isStaff);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchInMemory(query, jobs.data ?? [], customers.data ?? []), [query, jobs.data, customers.data]);
  const empty = results.jobs.length === 0 && results.customers.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Search', headerLeft: () => <Button label="Close" variant="ghost" size="sm" onPress={() => router.back()} /> }} />
      <View style={styles.field}>
        <TextField label="Search jobs and customers" value={query} onChangeText={setQuery} placeholder="Name, address, phone, job number…" autoFocus autoCorrect={false} returnKeyType="search" leading={<Search size={18} color={colors.mutedForeground} />} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!query.trim() ? <Text variant="small" color="mutedForeground" align="center">Type to search {isStaff ? 'jobs and customers' : 'your jobs'}.</Text>
          : empty ? <EmptyState icon={Search} title="No matches" />
          : (
            <>
              {results.jobs.length > 0 ? <Text variant="overline" color="mutedForeground">Jobs</Text> : null}
              {results.jobs.map((j) => (
                <PressableScale key={j.id} accessibilityRole="button" accessibilityLabel={`Open job ${j.clientName}`} onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })} scaleTo={0.985} style={[styles.row, { borderBottomColor: colors.border }]}>
                  <Briefcase size={18} color={colors.mutedForeground} />
                  <View style={styles.grow}>
                    <Text variant="bodyMedium"><Text variant="mono" color="mutedForeground">#{jobNumber(j.id)}</Text> {j.clientName}</Text>
                    <Text variant="caption" color="mutedForeground">{j.clientAddress}</Text>
                  </View>
                  <StatusBadge status={j.status} size="sm" />
                </PressableScale>
              ))}
              {results.customers.length > 0 ? <Text variant="overline" color="mutedForeground" style={styles.section}>Customers</Text> : null}
              {results.customers.map((c) => (
                <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={`Open customer ${c.name}`} onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })} scaleTo={0.985} style={[styles.row, { borderBottomColor: colors.border }]}>
                  <UserRound size={18} color={colors.mutedForeground} />
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{c.name}</Text>
                    <Text variant="caption" color="mutedForeground">{c.phone ?? c.email ?? c.address ?? ''}</Text>
                  </View>
                </PressableScale>
              ))}
            </>
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  field: { paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  content: { padding: spacing[4], gap: spacing[1], paddingBottom: spacing[8] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  section: { paddingTop: spacing[3] },
});
