import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Search, UserRound } from 'lucide-react-native';
import type { Customer } from '@/types';
import { EmptyState, Sheet, Text, TextField } from '~/components/ui';
import { customersService } from '~/services/customers';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

/** Search the company's customers and pick one (job form, customers screen). */
export function CustomerPickerSheet({ open, customers, onClose, onPick }: { open: boolean; customers: Customer[]; onClose: () => void; onPick: (customer: Customer) => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => customers.filter((c) => customersService.matchesCustomer(c, query)).slice(0, 30), [customers, query]);
  return (
    <Sheet open={open} onClose={onClose} title="Existing customer">
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name, phone, email or address" autoFocus leading={<Search size={18} color={colors.mutedForeground} />} autoCorrect={false} />
      {matches.length === 0 ? <EmptyState icon={UserRound} title="No customers found" /> : matches.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Pick ${c.name}`} onPress={() => { onPick(c); onClose(); }} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.text}>
            <Text variant="bodyMedium">{c.name}</Text>
            <Text variant="caption" color="mutedForeground">{[c.phone, c.address].filter(Boolean).join(' · ')}</Text>
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3] },
  text: { gap: 2 },
});
