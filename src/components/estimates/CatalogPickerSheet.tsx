import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Package, Search } from 'lucide-react-native';
import { formatMoney } from '@/utils/estimateMath';
import type { CatalogItem, EstimateLineItemInput, LineItemKind } from '@/types';
import { EmptyState, SegmentedControl, Sheet, Skeleton, Text, TextField } from '~/components/ui';
import { catalogService, type CatalogEntry } from '~/services/catalog';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

type Filter = 'all' | LineItemKind;

/** Search the company price book plus the built-in HVAC list and pick a line (web `CatalogPicker`). */
export function CatalogPickerSheet({ open, kind, onClose, onPick }: { open: boolean; kind: LineItemKind | null; onClose: () => void; onPick: (item: EstimateLineItemInput) => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>(kind ?? 'all');

  useEffect(() => { if (open) { setFilter(kind ?? 'all'); setQuery(''); } }, [open, kind]);
  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    void catalogService.list().then(({ data }) => { if (!cancelled) setItems(data ?? []); });
    return () => { cancelled = true; };
  }, [open, items]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogService.pickerEntries(items ?? []).filter((i) => (filter === 'all' || i.kind === filter) && (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))).slice(0, 60);
  }, [items, query, filter]);

  const pick = (entry: CatalogEntry) => { onPick(catalogService.toLineItem(entry)); onClose(); };

  return (
    <Sheet open={open} onClose={onClose} title="Add from catalog" description="Your price book plus the built-in HVAC list.">
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Parts and services" autoFocus autoCorrect={false} leading={<Search size={18} color={colors.mutedForeground} />} />
      <SegmentedControl value={filter} segments={[{ value: 'all', label: 'All' }, { value: 'part', label: 'Parts' }, { value: 'service', label: 'Services' }]} onChange={setFilter} accessibilityLabel="Filter by kind" />
      {items === null ? <View style={styles.list}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></View>
        : results.length === 0 ? <EmptyState icon={Package} title="No matches" />
        : results.map((i, idx) => (
          <Pressable key={`${i.source}-${i.id ?? idx}-${i.name}`} accessibilityRole="button" accessibilityLabel={`Add ${i.name}, ${formatMoney(i.unit_price)} per ${i.unit}`} onPress={() => pick(i)} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.text}>
              <Text variant="small">{i.name}</Text>
              <Text variant="caption" color="mutedForeground">{i.kind}{i.source === 'builtin' ? ' · built-in' : ''}{i.description ? ` · ${i.description}` : ''}</Text>
            </View>
            <Text variant="small">{formatMoney(i.unit_price)}<Text variant="caption" color="mutedForeground">/{i.unit}</Text></Text>
          </Pressable>
        ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
