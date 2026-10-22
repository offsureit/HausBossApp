import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { formatMoney } from '@/utils/estimateMath';
import type { CatalogItem, LineItemKind } from '@/types';
import { Button, Card, Dialog, EmptyState, IconButton, Screen, SegmentedControl, Sheet, SkeletonCard, Text, TextField, Toggle } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { catalogService } from '~/services/catalog';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

interface Draft { id?: string; kind: LineItemKind; name: string; description: string; unit: string; unit_price: string; is_active: boolean }
const emptyDraft = (kind: LineItemKind): Draft => ({ kind, name: '', description: '', unit: kind === 'service' ? 'hr' : 'ea', unit_price: '0', is_active: true });
const catalogKey = (companyId: string | null) => ['catalog', companyId] as const;

/** Company price book — parts and services CRUD (web `ProductsServicesManager`). */
export default function ProductsScreen() {
  const { colors } = useTheme();
  const { isStaff } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: catalogKey(companyId), enabled: !!companyId, queryFn: async () => { const { data, error } = await catalogService.list({ includeInactive: true }); if (error) throw new Error(error.message); return data ?? []; } });
  const [kind, setKind] = useState<LineItemKind>('part');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);

  const items = useMemo(() => { const q = search.trim().toLowerCase(); return (query.data ?? []).filter((i) => i.kind === kind && (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))); }, [query.data, kind, search]);
  const write = (next: (prev: CatalogItem[]) => CatalogItem[]) => queryClient.setQueryData<CatalogItem[]>(catalogKey(companyId), (prev) => next(prev ?? []));

  const save = async () => {
    if (!draft || !companyId) return;
    const price = Number(draft.unit_price);
    if (!draft.name.trim()) { toast.error('Item name is required'); return; }
    if (!Number.isFinite(price) || price < 0) { toast.error('Unit price must be zero or more'); return; }
    setSaving(true);
    const payload = { kind: draft.kind, name: draft.name.trim(), description: draft.description.trim() || null, unit: draft.unit.trim() || 'ea', unit_price: price, is_active: draft.is_active };
    const result = draft.id ? await catalogService.update(draft.id, payload) : await catalogService.create({ company_id: companyId, ...payload });
    setSaving(false);
    if (result.error || !result.data) { toast.error(result.error?.message ?? 'Could not save'); return; }
    const saved = result.data;
    write((prev) => (prev.some((i) => i.id === saved.id) ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]));
    setDraft(null);
    toast.success(draft.id ? 'Item updated' : 'Item added');
    haptics.success();
  };
  const remove = async () => {
    if (!deleting) return;
    const { error } = await catalogService.remove(deleting.id);
    if (error) { toast.error(error.message); return; }
    write((prev) => prev.filter((i) => i.id !== deleting.id));
    setDeleting(null);
    toast.success('Item deleted');
  };

  return (
    <Screen scroll edges={['left', 'right']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Products & services', headerBackTitle: 'Back', headerRight: isStaff ? () => <IconButton icon={Plus} label="Add item" variant="filled" tone="accent" onPress={() => setDraft(emptyDraft(kind))} /> : undefined }} />
      <SegmentedControl<LineItemKind> value={kind} segments={[{ value: 'part', label: 'Parts' }, { value: 'service', label: 'Services' }]} onChange={setKind} accessibilityLabel="Item kind" />
      <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Name or description" autoCorrect={false} leading={<Search size={18} color={colors.mutedForeground} />} />
      {query.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : items.length === 0 ? <EmptyState icon={Package} title={search ? 'No items match' : `No ${kind === 'part' ? 'parts' : 'services'} yet`} message={search ? undefined : 'Estimates can also pick from the built-in HVAC list.'} action={isStaff && !search ? <Button label={`Add ${kind}`} onPress={() => setDraft(emptyDraft(kind))} /> : undefined} />
        : (
          <View style={styles.list}>
            {items.map((i) => (
              <Card key={i.id} style={styles.row}>
                <View style={styles.grow}>
                  <Text variant="bodyMedium">{i.name}{!i.is_active ? <Text variant="caption" color="mutedForeground"> · inactive</Text> : null}</Text>
                  {i.description ? <Text variant="caption" color="mutedForeground">{i.description}</Text> : null}
                  <Text variant="small" style={styles.mono}>{formatMoney(Number(i.unit_price))} <Text variant="caption" color="mutedForeground">/ {i.unit ?? 'ea'}</Text></Text>
                </View>
                {isStaff ? <><IconButton icon={Pencil} label={`Edit ${i.name}`} onPress={() => setDraft({ id: i.id, kind: i.kind as LineItemKind, name: i.name, description: i.description ?? '', unit: i.unit ?? 'ea', unit_price: String(Number(i.unit_price)), is_active: i.is_active })} /><IconButton icon={Trash2} label={`Delete ${i.name}`} tone="destructive" onPress={() => setDeleting(i)} /></> : null}
              </Card>
            ))}
          </View>
        )}

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit item' : `New ${draft?.kind ?? kind}`} footer={<Button label={draft?.id ? 'Save' : 'Add'} size="lg" fullWidth onPress={() => void save()} loading={saving} />}>
        {draft ? (
          <>
            <SegmentedControl<LineItemKind> value={draft.kind} segments={[{ value: 'part', label: 'Part' }, { value: 'service', label: 'Service' }]} onChange={(k) => setDraft({ ...draft, kind: k })} accessibilityLabel="Kind" />
            <TextField label="Name *" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
            <TextField label="Description" value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} multiline />
            <View style={styles.rowFields}>
              <View style={styles.grow}><TextField label="Unit price" value={draft.unit_price} onChangeText={(v) => setDraft({ ...draft, unit_price: v })} keyboardType="decimal-pad" /></View>
              <View style={styles.grow}><TextField label="Unit" value={draft.unit} onChangeText={(v) => setDraft({ ...draft, unit: v })} autoCapitalize="none" /></View>
            </View>
            <Card style={styles.rowFields}><Text variant="small" style={styles.grow}>Active (shown in the estimate picker)</Text><Toggle value={draft.is_active} onValueChange={(v) => setDraft({ ...draft, is_active: v })} accessibilityLabel="Active" /></Card>
          </>
        ) : null}
      </Sheet>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? 'item'}?`} description="Existing estimates keep their lines." confirmLabel="Delete" confirmVariant="destructive" onConfirm={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowFields: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  mono: { fontVariant: ['tabular-nums'] },
});
