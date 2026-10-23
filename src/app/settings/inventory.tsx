import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Minus, Pencil, Plus, Trash2 } from 'lucide-react-native';
import type { InventoryItem } from '@/types';
import { Button, Card, Dialog, EmptyState, HeroIconButton, IconButton, IconTile, Screen, Select, Sheet, SkeletonCard, Text, TextField } from '~/components/ui';
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
      <Stack.Screen options={{ title: 'Truck stock', headerBackTitle: 'Back', headerRight: isStaff ? () => <HeroIconButton icon={Plus} label="Add item" onPress={() => setDraft(emptyDraft(filter))} /> : undefined }} />
      <Select label="Stock location" value={filter} onChange={setFilter} options={[{ value: ALL, label: 'All' }, { value: WAREHOUSE, label: 'Warehouse' }, ...techs.map((t) => ({ value: t.id, label: t.name }))]} />
      {low > 0 ? <View style={[styles.low, { backgroundColor: withAlpha(colors.warning, 0.12) }]}><AlertTriangle size={16} color={colors.warning} /><Text variant="small" color="warning" style={styles.strong}>{low} item{low === 1 ? '' : 's'} below minimum</Text></View> : null}
      {query.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : items.length === 0 ? <EmptyState icon={Boxes} title="No stock recorded" action={isStaff ? <Button label="Add item" onPress={() => setDraft(emptyDraft(filter))} /> : undefined} />
        : (
          <View style={styles.list}>
            {items.map((i) => {
              const lowItem = inventoryService.isBelowMinimum(i);
              return (
                <Card key={i.id} style={[styles.row, lowItem && { borderColor: colors.warning, borderWidth: 1.5 }]}>
                  <View style={styles.top}>
                    <IconTile icon={Boxes} color={lowItem ? colors.warning : colors.accent} size={42} />
                    <View style={styles.grow}>
                      <Text variant="bodyMedium" style={styles.strong}>{i.name}</Text>
                      <Text variant="caption" color="mutedForeground">{[i.sku, techName(i.technician_id), i.unit_cost != null ? `$${Number(i.unit_cost).toFixed(2)} each` : null].filter(Boolean).join(' · ')}</Text>
                      {lowItem ? <View style={[styles.lowPill, { backgroundColor: withAlpha(colors.warning, 0.12) }]}><AlertTriangle size={12} color={colors.warning} /><Text variant="caption" color="warning" style={styles.strong}>Below minimum ({i.min_quantity})</Text></View> : <Text variant="caption" color="mutedForeground">Minimum {i.min_quantity}</Text>}
                    </View>
                    {isStaff ? <View style={styles.actions}><IconButton icon={Pencil} label={`Edit ${i.name}`} variant="filled" size={38} onPress={() => setDraft({ id: i.id, technician_id: i.technician_id ?? WAREHOUSE, name: i.name, sku: i.sku ?? '', unit: i.unit ?? 'ea', quantity: String(i.quantity), min_quantity: String(i.min_quantity), unit_cost: i.unit_cost != null ? String(i.unit_cost) : '' })} /><IconButton icon={Trash2} label={`Delete ${i.name}`} tone="destructive" variant="filled" size={38} onPress={() => setDeleting(i)} /></View> : null}
                  </View>
                  {/* Quantity stepper: a filled pill with − / + on either side of the count. */}
                  <View style={[styles.stepper, { backgroundColor: colors.field, borderColor: colors.border }]}>
                    {isStaff ? <IconButton icon={Minus} label={`Remove one ${i.name}`} variant="filled" size={40} onPress={() => void adjust(i, -1)} disabled={i.quantity <= 0} /> : <View style={styles.spacer} />}
                    <View style={styles.count}><Text variant="title" color={lowItem ? 'warning' : 'foreground'} style={styles.mono}>{i.quantity}</Text><Text variant="caption" color="mutedForeground">{i.unit ?? ''} in stock</Text></View>
                    {isStaff ? <IconButton icon={Plus} label={`Add one ${i.name}`} variant="filled" tone="accent" size={40} onPress={() => void adjust(i, 1)} /> : <View style={styles.spacer} />}
                  </View>
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
  low: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: 12, padding: spacing[3] },
  row: { gap: spacing[3] },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  lowPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: spacing[2], paddingVertical: 2, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 999, padding: 4 },
  count: { alignItems: 'center' },
  spacer: { width: 40 },
  rowFields: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  strong: { fontFamily: 'Inter_600SemiBold' },
  actions: { gap: spacing[2] },
  mono: { fontVariant: ['tabular-nums'], textAlign: 'center' },
});
