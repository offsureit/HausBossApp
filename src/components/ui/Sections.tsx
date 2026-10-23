import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Card } from './Card';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

type Icon = ComponentType<{ size?: number; color?: string }>;

/** A rounded icon tile (accent by default) — the leading visual of rows and section titles. */
export function IconTile({ icon: Icon, color, size = 36 }: { icon: Icon; color?: string; size?: number }) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: withAlpha(tint, 0.12) }]}>
      <Icon size={Math.round(size * 0.5)} color={tint} />
    </View>
  );
}

/**
 * A titled card section: icon tile + title (+ optional subtitle / right action) over its content.
 * `flush` drops the content padding for full-bleed rows (InfoRow lists).
 */
export function SectionCard({ title, subtitle, icon, color, action, flush = false, children, style }: { title: string; subtitle?: string; icon?: Icon; color?: string; action?: ReactNode; flush?: boolean; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Card padded={false} style={style}>
      <View style={styles.head} accessibilityRole="header">
        {icon ? <IconTile icon={icon} color={color} size={34} /> : null}
        <View style={styles.headText}>
          <Text variant="bodyMedium" style={styles.title}>{title}</Text>
          {subtitle ? <Text variant="caption" color="mutedForeground">{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children ? <View style={flush ? styles.flush : styles.body}>{children}</View> : null}
    </Card>
  );
}

/**
 * One labelled value: icon tile, small label over the value, chevron when tappable. Rows after the
 * first get a hairline divider. `trailing` replaces the chevron (a badge, switch, button…).
 */
export function InfoRow({ icon, label, value, onPress, first = false, color, trailing, accessibilityLabel }: { icon?: Icon; label?: string; value: ReactNode; onPress?: () => void; first?: boolean; color?: string; trailing?: ReactNode; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const body = (
    <>
      {icon ? <IconTile icon={icon} color={color ?? (onPress ? colors.accent : colors.mutedForeground)} size={34} /> : null}
      <View style={styles.rowText}>
        {label ? <Text variant="caption" color="mutedForeground">{label}</Text> : null}
        {typeof value === 'string' || typeof value === 'number' ? <Text variant="body" color={onPress ? 'accent' : 'foreground'}>{value}</Text> : value}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={18} color={colors.mutedForeground} /> : null)}
    </>
  );
  const style = [styles.row, !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }];
  return onPress
    ? <PressableScale accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (typeof value === 'string' ? `${label ? `${label}: ` : ''}${value}` : label)} onPress={onPress} scaleTo={0.985} style={style}>{body}</PressableScale>
    : <View style={style} accessible accessibilityLabel={accessibilityLabel ?? (typeof value === 'string' ? `${label ? `${label}: ` : ''}${value}` : undefined)}>{body}</View>;
}

/** A small stat on the page (not in a hero): icon tile, big value, label. */
export function StatTile({ icon, value, label, color, style }: { icon: Icon; value: ReactNode; label: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[styles.stat, style]} level={1}>
      <IconTile icon={icon} color={color} size={32} />
      <Text variant="title" numberOfLines={1}>{value}</Text>
      <Text variant="caption" color="mutedForeground" numberOfLines={1}>{label}</Text>
    </Card>
  );
}

/** A vertical timeline: a dot per item on a thin rail, newest first by convention of the caller. */
export function Timeline({ items }: { items: { key: string; title: ReactNode; meta?: ReactNode; color?: string; icon?: Icon }[] }) {
  const { colors } = useTheme();
  return (
    <View>
      {items.map((item, i) => {
        const tint = item.color ?? colors.accent;
        const last = i === items.length - 1;
        return (
          <View key={item.key} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDot, { backgroundColor: withAlpha(tint, 0.15), borderColor: tint }]}>
                {item.icon ? <item.icon size={12} color={tint} /> : null}
              </View>
              {!last ? <View style={[styles.tlLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={[styles.tlBody, !last && { paddingBottom: spacing[4] }]}>
              {typeof item.title === 'string' ? <Text variant="small" style={styles.title}>{item.title}</Text> : item.title}
              {typeof item.meta === 'string' ? <Text variant="caption" color="mutedForeground">{item.meta}</Text> : item.meta}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3] },
  headText: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Inter_600SemiBold' },
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  flush: { paddingBottom: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], minHeight: 56 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  stat: { flex: 1, minWidth: 0, padding: spacing[3], gap: 2, borderRadius: radius.lg },
  tlRow: { flexDirection: 'row', gap: spacing[3] },
  tlRail: { alignItems: 'center', width: 24 },
  tlDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tlLine: { width: 2, flex: 1, marginTop: 2, borderRadius: 1 },
  tlBody: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
});
