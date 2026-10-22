import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EMPTY_JOB_FORM, customerOnlySchema, customerToForm, toCustomerPayload, type JobFormValues } from '@/components/jobForm/schema';
import type { Customer } from '@/types';
import { CustomerFields } from '~/components/customers/CustomerFields';
import { Button, Card, Text, TextField, Toggle } from '~/components/ui';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCustomersQuery } from '~/features/customers/useCustomers';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { customersService } from '~/services/customers';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Create / edit a customer record with the shared job-form contact rules (web `CustomerDialog` details tab). */
export function CustomerForm({ customer }: { customer: Customer | null }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { company, companyId } = useCompany();
  const customers = useCustomersQuery(companyId);
  const [values, setValues] = useState<JobFormValues>(() => ({ ...EMPTY_JOB_FORM, ...(customer ? customerToForm(customer) : {}) }));
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [active, setActive] = useState(customer?.is_active !== false);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormValues, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) => { setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); };

  const save = async () => {
    if (!companyId) return;
    const parsed = customerOnlySchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof JobFormValues, string>> = {};
      parsed.error.issues.forEach((i) => { const k = i.path[0] as keyof JobFormValues; if (k && !next[k]) next[k] = i.message; });
      setErrors(next);
      toast.error(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setSaving(true);
    const payload = { ...toCustomerPayload(values, companyId), notes: notes.trim() || null, is_active: active };
    const result = customer ? await customersService.update(customer.id, payload) : await customersService.create(payload);
    setSaving(false);
    if (result.error || !result.data) { toast.error('Could not save customer', { description: result.error?.message }); haptics.error(); return; }
    customers.upsertLocal(result.data);
    toast.success(customer ? 'Customer saved' : 'Customer created');
    haptics.success();
    if (customer) router.back();
    else router.replace({ pathname: '/customers/[id]', params: { id: result.data.id } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CustomerFields values={values} errors={errors} set={set} units={company?.businessUnits ?? []} divisions={company?.divisions ?? []} showTypes={false} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} style={styles.multiline} placeholder="Gate codes, preferences, history…" />
        <Card style={styles.rowBetween}>
          <Text variant="small" style={styles.grow}>Active customer</Text>
          <Toggle value={active} onValueChange={setActive} accessibilityLabel="Active customer" />
        </Card>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={saving} />
        <Button label={customer ? 'Save changes' : 'Create customer'} onPress={() => void save()} loading={saving} style={styles.grow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', gap: spacing[2], padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
});
