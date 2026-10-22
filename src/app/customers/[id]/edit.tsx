import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { CustomerForm } from '~/components/customers/CustomerForm';
import { Button, EmptyState, Skeleton } from '~/components/ui';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCustomersQuery } from '~/features/customers/useCustomers';
import { spacing } from '~/theme/tokens';

export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { companyId } = useCompany();
  const customers = useCustomersQuery(companyId, true, true);
  const customer = useMemo(() => customers.data?.find((c) => c.id === id) ?? null, [customers.data, id]);
  return (
    <>
      <Stack.Screen options={{ title: customer ? `Edit ${customer.name}` : 'Edit customer' }} />
      {customer ? <CustomerForm key={customer.id} customer={customer} />
        : customers.isPending ? <View style={styles.pad}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></View>
        : <View style={styles.pad}><EmptyState icon={UserRound} title="Customer not found" action={<Button label="Back" variant="outline" onPress={() => router.back()} />} /></View>}
    </>
  );
}

const styles = StyleSheet.create({ pad: { padding: spacing[4], gap: spacing[3] } });
