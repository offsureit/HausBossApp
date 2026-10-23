import { StyleSheet, View } from 'react-native';
import { ArrowDown, ArrowUp, BookOpen, Package, Plus, Trash2, Wrench } from 'lucide-react-native';
import { formatMoney, lineTotal } from '@/utils/estimateMath';
import type { EstimateLineItemInput, LineItemKind } from '@/types';
import { Button, Card, IconButton, IconTile, Text, TextField } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

const TITLES: Record<LineItemKind, string> = { part: 'Parts', service: 'Services' };

export interface LineItemsSectionProps {
  kind: LineItemKind;
  items: EstimateLineItemInput[];
  onChange: (items: EstimateLineItemInput[]) => void;
  readOnly?: boolean;
  onPickFromCatalog?: () => void;
}

const num = (v: string) => { const n = Number(v.replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

/** Editable parts / services lines with add / remove / reorder (web `EstimateLineItemsTable`, stacked for phones). */
export function LineItemsSection({ kind, items, onChange, readOnly = false, onPickFromCatalog }: LineItemsSectionProps) {
  const { colors } = useTheme();
  const rows = items.filter((i) => i.kind === kind);
  const subtotal = rows.reduce((sum, i) => sum + lineTotal(i), 0);
  const Icon = kind === 'part' ? Package : Wrench;

  const replaceRows = (nextRows: EstimateLineItemInput[]) => onChange([...items.filter((i) => i.kind !== kind), ...nextRows.map((r, idx) => ({ ...r, sort_order: idx }))]);
  const update = (idx: number, patch: Partial<EstimateLineItemInput>) => replaceRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => replaceRows(rows.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => { const j = idx + dir; if (j < 0 || j >= rows.length) return; const next = rows.slice(); [next[idx], next[j]] = [next[j], next[idx]]; replaceRows(next); };
  const add = () => replaceRows([...rows, { kind, name: '', quantity: 1, unit: kind === 'service' ? 'hr' : 'ea', unit_price: 0 }]);

  return (
    <View style={styles.section} accessibilityLabel={`${TITLES[kind]} lines`}>
      <View style={styles.head}>
        <View style={styles.headLeft}><IconTile icon={Icon} color={kind === 'part' ? colors.accent : colors.success} size={34} /><Text variant="heading">{TITLES[kind]}</Text></View>
        <View style={[styles.subtotal, { backgroundColor: colors.muted }]}><Text variant="caption" color="mutedForeground">Subtotal </Text><Text variant="label" style={styles.mono}>{formatMoney(subtotal)}</Text></View>
      </View>
      {rows.length === 0 ? <View style={[styles.empty, { borderColor: colors.border }]}><Text variant="small" color="mutedForeground">No {TITLES[kind].toLowerCase()} yet.</Text></View> : null}
      {rows.map((r, idx) => (
        <Card key={r.id ?? `${kind}-${idx}`} style={styles.line}>
          {readOnly ? (
            <>
              <View style={styles.lineHead}><Text variant="bodyMedium" style={styles.grow}>{r.name}</Text><Text variant="bodyMedium" style={styles.mono}>{formatMoney(lineTotal(r))}</Text></View>
              {r.description ? <Text variant="caption" color="mutedForeground">{r.description}</Text> : null}
              <Text variant="caption" color="mutedForeground">{r.quantity} {r.unit ?? ''} × {formatMoney(r.unit_price)}</Text>
            </>
          ) : (
            <>
              <TextField label={`${kind === 'part' ? 'Part' : 'Service'} name`} value={r.name} onChangeText={(v) => update(idx, { name: v })} placeholder={kind === 'part' ? 'Part name' : 'Service'} />
              <TextField label="Description" value={r.description ?? ''} onChangeText={(v) => update(idx, { description: v })} placeholder="Optional" />
              <View style={styles.row}>
                <View style={styles.grow}><TextField label="Qty" value={String(r.quantity)} onChangeText={(v) => update(idx, { quantity: num(v) })} keyboardType="decimal-pad" /></View>
                <View style={styles.grow}><TextField label="Unit" value={r.unit ?? ''} onChangeText={(v) => update(idx, { unit: v })} autoCapitalize="none" /></View>
                <View style={styles.grow}><TextField label="Unit price" value={String(r.unit_price)} onChangeText={(v) => update(idx, { unit_price: num(v) })} keyboardType="decimal-pad" /></View>
              </View>
              <View style={styles.lineFoot}>
                <Text variant="small" color="mutedForeground" style={styles.mono}>Line total {formatMoney(lineTotal(r))}</Text>
                <View style={styles.actions}>
                  <IconButton icon={ArrowUp} label="Move up" size={36} onPress={() => move(idx, -1)} disabled={idx === 0} />
                  <IconButton icon={ArrowDown} label="Move down" size={36} onPress={() => move(idx, 1)} disabled={idx === rows.length - 1} />
                  <IconButton icon={Trash2} label="Remove line" tone="destructive" size={36} onPress={() => remove(idx)} />
                </View>
              </View>
            </>
          )}
        </Card>
      ))}
      {!readOnly ? (
        <View style={styles.row}>
          <Button label={`Add ${kind}`} variant="outline" style={styles.grow} icon={<Plus size={16} color={colors.foreground} />} onPress={add} />
          {onPickFromCatalog ? <Button label="From catalog" variant="secondary" style={styles.grow} icon={<BookOpen size={16} color={colors.accent} />} onPress={onPickFromCatalog} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  subtotal: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing[4], alignItems: 'center' },
  section: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  line: { gap: spacing[2] },
  lineHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  actions: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  mono: { fontVariant: ['tabular-nums'] },
});
