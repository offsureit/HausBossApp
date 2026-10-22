import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Minus, Pencil, Plus, Trash2 } from 'lucide-react-native';
import type { InventoryItem } from '@/types';
import { Button, Card, Dialog, EmptyState, IconButton, Screen, Select, Sheet, SkeletonCard, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useTeamQuery } from '~/features/team/useTeam';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { inventoryService } from '~/services/inventory';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing, withAlpha } from '~/theme/tokens';

const ALL = 'all';
const WAREHOUSE = 'warehouse';
interface Draft { id?: string; technician_id: string; name: string; sku: string; unit: string; quantity: string; min_quantity: string; unit_cost: string }
const emptyDraft = (tech: string): Draft => ({ technician_id: tech === ALL ? WAREHOUSE : tech, name: '', sku: '', unit: 'ea', quantity: '0', min_quantity: '0', unit_cost: '' });
const inventoryKey = (companyId: string | null) => ['inventory', companyId] as const;

/** Truck stock per technician with minimum levels and quick ± adjustments (web `InventoryManager`). */
export default function InventoryScreen() {
  const { colors } = useTheme();
  const { isStaff, user } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const team = useTeamQuery(companyId);
  const query = useQuery({ queryKey: inventoryKey(companyId), enabled: !!companyId, queryFn: async () => { const { data, error } = await inventoryService.list(); if (error) throw new Error(error.message); return data ?? []; } });
  const [filter, setFilter] = useState<string>(isStaff ? ALL : user?.id ?? ALL);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);

  const techs = useMemo(() => (team.data ?? []).filter((e) => e.role === 'contractor' && e.isActive), [team.data]);
  const techName = (id: string | null) => (id ? techs.find((t) => t.id === id)?.name ?? 'Unknown technician' : 'Warehouse');
  const items = useMemo(() => (query.data ?? []).filter((i) => filter === ALL || (filter === WAREHOUSE ? !i.technician_id : i.technician_id === filter)), [query.data, filter]);
  const low = items.filter((i) => inventoryService.isBelowMinimum(i)).length;
  const write = (next: (prev: InventoryItem[]) => InventoryItem[]) => queryClient.setQueryData<InventoryItem[]>(inventoryKey(companyId), (prev) => next(prev ?? []));

  const save = async () => {
    if (!draft || !companyId) return;
    const quantity = Number(draft.quantity); const min = Number(draft.min_quantity); const cost = draft.unit_cost.trim() ? Number(draft.unit_cost) : null;
    if (!draft.name.trim()) { toast.error('Item name is required'); return; }
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(min) || min < 0) { toast.error('Quantities must be zero or more'); return; }
    setSaving(true);
    const payload = { name: draft.name.trim(), sku: draft.sku.trim() || null, unit: draft.unit.trim() || 'ea', quantity, min_quantity: min, unit_cost: cost, technician_id: draft.technician_id === WAREHOUSE ? null : draft.technician_id };
    const result = draft.id ? await inventoryService.update(draft.id, payload) : await inventoryService.create({ company_id: companyId, ...payload });
    setSaving(false);
    if (result.error || !result.data) { toast.error(result.error?.message ?? 'Could not save'); return; }
    const saved = result.data;
    write((prev) => (prev.some((i) => i.id === saved.id) ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]));
    setDraft(null); toast.success(draft.id ? 'Item updated' : 'Item added'); haptics.success();
  };
  const adjust = async (item: InventoryItem, delta: number) => {
    const quantity = Math.max(0, item.quantity + delta);
    write((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity } : i)));
    const { data, error } = await inventoryService.update(item.id, { quantity });
    if (error || !data) { toast.error(error?.message ?? 'Could not update'); write((prev) => prev.map((i) => (i.id === item.id ? item : i))); return; }
    write((prev) => prev.map((i) => (i.id === item.id ? data : i)));
    haptics.light();
  };
  const remove = async () => {
    if (!deleting) return;
    const { error } = await inventoryService.remove(deleting.id);
    if (error) { toast.error(error.message); return; }
    write((prev) => prev.filter((i) => i.id !== deleting.id)); setDeleting(null); toast.success('Item deleted');
  };

  return (
    <Screen scroll edges={['left', 'right']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Truck stock', headerBackTitle: 'Back', headerRight: isStaff ? () => <IconButton icon={Plus} label="Add item" variant="filled" tone="accent" onPress={() => setDraft(emptyDraft(filter))} /> : undefined }} />
      <Select label="Stock location" value={filter} onChange={setFilter} options={[{ value: ALL, label: 'All' }, { value: WAREHOUSE, label: 'Warehouse' }, ...techs.map((t) => ({ value: t.id, label: t.name }))]} />
      {low > 0 ? <View style={[styles.low, { backgroundColor: withAlpha(colors.warning, 0.12) }]}><AlertTriangle size={16} color={colors.warningForeground} /><Text variant="small" color="warningForeground">{low} item{low === 1 ? '' : 's'} below minimum</Text></View> : null}
      {query.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : items.length === 0 ? <EmptyState icon={Boxes} title="No stock recorded" action={isStaff ? <Button label="Add item" onPress={() => setDraft(emptyDraft(filter))} /> : undefined} />
        : (
          <View style={styles.list}>
            {items.map((i) => {
              const lowItem = inventoryService.isBelowMinimum(i);
              return (
                <Card key={i.id} style={styles.row}>
                  <View style={styles.grow}>
                    <Text variant="bodyMedium">{i.name}{i.sku ? <Text variant="caption" color="mutedForeground"> · {i.sku}</Text> : null}</Text>
                    <Text variant="caption" color="mutedForeground">{techName(i.technician_id)} · min {i.min_quantity}{i.unit_cost != null ? ` · $${Number(i.unit_cost).toFixed(2)}` : ''}</Text>
                  </View>
                  <View style={styles.qty}>
                    {isStaff ? <IconButton icon={Minus} label={`Remove one ${i.name}`} variant="outline" size={36} onPress={() => void adjust(i, -1)} disabled={i.quantity <= 0} /> : null}
                    <Text variant="heading" color={lowItem ? 'warningForeground' : 'foreground'} style={styles.mono}>{i.quantity}<Text variant="caption" color="mutedForeground"> {i.unit ?? ''}</Text></Text>
                    {isStaff ? <IconButton icon={Plus} label={`Add one ${i.name}`} variant="outline" size={36} onPress={() => void adjust(i, 1)} /> : null}
                  </View>
                  {isStaff ? <View style={styles.actions}><IconButton icon={Pencil} label={`Edit ${i.name}`} size={36} onPress={() => setDraft({ id: i.id, technician_id: i.technician_id ?? WAREHOUSE, name: i.name, sku: i.sku ?? '', unit: i.unit ?? 'ea', quantity: String(i.quantity), min_quantity: String(i.min_quantity), unit_cost: i.unit_cost != null ? String(i.unit_cost) : '' })} /><IconButton icon={Trash2} label={`Delete ${i.name}`} tone="destructive" size={36} onPress={() => setDeleting(i)} /></View> : null}
                </Card>
              );
            })}
          </View>
        )}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit item' : 'New item'} footer={<Button label={draft?.id ? 'Save' : 'Add'} size="lg" fullWidth onPress={() => void save()} loading={saving} />}>
        {draft ? (
          <>
            <Select label="Stock location" value={draft.technician_id} onChange={(v) => setDraft({ ...draft, technician_id: v })} options={[{ value: WAREHOUSE, label: 'Warehouse' }, ...techs.map((t) => ({ value: t.id, label: t.name }))]} />
            <TextField label="Name *" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
            <View style={styles.rowFields}><View style={styles.grow}><TextField label="SKU" value={draft.sku} onChangeText={(v) => setDraft({ ...draft, sku: v })} autoCapitalize="characters" /></View><View style={styles.grow}><TextField label="Unit" value={draft.unit} onChangeText={(v) => setDraft({ ...draft, unit: v })} autoCapitalize="none" /></View></View>
            <View style={styles.rowFields}><View style={styles.grow}><TextField label="Quantity" value={draft.quantity} onChangeText={(v) => setDraft({ ...draft, quantity: v })} keyboardType="number-pad" /></View><View style={styles.grow}><TextField label="Minimum" value={draft.min_quantity} onChangeText={(v) => setDraft({ ...draft, min_quantity: v })} keyboardType="number-pad" /></View><View style={styles.grow}><TextField label="Unit cost" value={draft.unit_cost} onChangeText={(v) => setDraft({ ...draft, unit_cost: v })} keyboardType="decimal-pad" /></View></View>
          </>
        ) : null}
      </Sheet>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? 'item'}?`} confirmLabel="Delete" confirmVariant="destructive" onConfirm={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[2] },
  low: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: 8, padding: spacing[3] },
  row: { gap: spacing[2] },
  rowFields: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  mono: { fontVariant: ['tabular-nums'], minWidth: 56, textAlign: 'center' },
});
