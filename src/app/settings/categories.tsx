import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react-native';
import type { JobCategory } from '@/types';
import { Button, Card, Dialog, EmptyState, IconButton, Screen, Sheet, SkeletonCard, Text, TextField, Toggle } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { categoriesKey } from '~/features/jobs/useCategories';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { categoriesService } from '~/services/categories';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

const allKey = (companyId: string | null) => ['categories', companyId, 'all'] as const;

/** Job categories: add, rename, reorder, toggle, delete (web `JobCategoriesManager`). */
export default function CategoriesScreen() {
  const { colors } = useTheme();
  const { isStaff } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: allKey(companyId), enabled: !!companyId, queryFn: async () => { const { data, error } = await categoriesService.list({ includeInactive: true }); if (error) throw new Error(error.message); return data ?? []; } });
  const [editing, setEditing] = useState<{ id?: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<JobCategory | null>(null);
  const items = query.data ?? [];

  const write = (next: (prev: JobCategory[]) => JobCategory[]) => {
    queryClient.setQueryData<JobCategory[]>(allKey(companyId), (prev) => next(prev ?? []));
    void queryClient.invalidateQueries({ queryKey: categoriesKey(companyId) });
  };
  const save = async () => {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) { toast.error('Category name is required'); return; }
    setSaving(true);
    const result = editing.id ? await categoriesService.update(editing.id, { label }) : await categoriesService.create(label, items.length);
    setSaving(false);
    if (result.error || !result.data) { toast.error(result.error?.message ?? 'Could not save'); return; }
    const saved = result.data;
    write((prev) => (prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]));
    setEditing(null); toast.success(editing.id ? 'Category renamed' : 'Category added'); haptics.success();
  };
  const toggle = async (c: JobCategory) => {
    const { data, error } = await categoriesService.update(c.id, { is_active: !c.is_active });
    if (error || !data) { toast.error(error?.message ?? 'Could not update'); return; }
    write((prev) => prev.map((x) => (x.id === c.id ? data : x)));
  };
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice(); [next[index], next[j]] = [next[j], next[index]];
    const ordered = next.map((c, i) => ({ ...c, sort_order: i }));
    write(() => ordered);
    const { error } = await categoriesService.reorder(ordered.map((c) => c.id));
    if (error) { toast.error(error.message); void query.refetch(); } else haptics.light();
  };
  const remove = async () => {
    if (!deleting) return;
    const { error } = await categoriesService.remove(deleting.id);
    if (error) { toast.error(error.message); return; }
    write((prev) => prev.filter((c) => c.id !== deleting.id)); setDeleting(null); toast.success('Category deleted');
  };

  return (
    <Screen scroll edges={['left', 'right']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Job categories', headerBackTitle: 'Back', headerRight: isStaff ? () => <IconButton icon={Plus} label="Add category" variant="filled" tone="accent" onPress={() => setEditing({ label: '' })} /> : undefined }} />
      <Text variant="small" color="mutedForeground">Categories label jobs and prefill estimate titles. Inactive ones stay on old jobs but are hidden from pickers.</Text>
      {query.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : items.length === 0 ? <EmptyState icon={Tags} title="No categories yet" action={isStaff ? <Button label="Add category" onPress={() => setEditing({ label: '' })} /> : undefined} />
        : (
          <Card padded={false}>
            {items.map((c, i) => (
              <View key={c.id} style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text variant="bodyMedium" color={c.is_active ? 'foreground' : 'mutedForeground'} style={styles.grow}>{c.label}</Text>
                {isStaff ? (
                  <>
                    <IconButton icon={ArrowUp} label={`Move ${c.label} up`} size={36} onPress={() => void move(i, -1)} disabled={i === 0} />
                    <IconButton icon={ArrowDown} label={`Move ${c.label} down`} size={36} onPress={() => void move(i, 1)} disabled={i === items.length - 1} />
                    <Toggle value={c.is_active} onValueChange={() => void toggle(c)} accessibilityLabel={`${c.label} active`} />
                    <IconButton icon={Pencil} label={`Rename ${c.label}`} size={36} onPress={() => setEditing({ id: c.id, label: c.label })} />
                    <IconButton icon={Trash2} label={`Delete ${c.label}`} tone="destructive" size={36} onPress={() => setDeleting(c)} />
                  </>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Rename category' : 'New category'} footer={<Button label={editing?.id ? 'Save' : 'Add'} size="lg" fullWidth onPress={() => void save()} loading={saving} />}>
        {editing ? <TextField label="Name" value={editing.label} onChangeText={(v) => setEditing({ ...editing, label: v })} autoFocus /> : null}
      </Sheet>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.label ?? 'category'}?`} description="Jobs keep the label as text." confirmLabel="Delete" confirmVariant="destructive" onConfirm={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing[1], paddingLeft: spacing[4], paddingRight: spacing[1], minHeight: 52 },
  grow: { flex: 1, minWidth: 0 },
});
