import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale, Text } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

export interface SettingsRowProps {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  description?: string;
  badge?: number;
  right?: ReactNode;
  onPress: () => void;
  first?: boolean;
}

/** A More-screen row: icon tile, label, optional badge / value, chevron. */
export function SettingsRow({ icon: Icon, label, description, badge, right, onPress, first = false }: SettingsRowProps) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} unread` : label} onPress={onPress} scaleTo={0.985} style={[styles.row, !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.1) }]}><Icon size={18} color={colors.accent} /></View>
      <View style={styles.text}>
        <Text variant="bodyMedium">{label}</Text>
        {description ? <Text variant="caption" color="mutedForeground">{description}</Text> : null}
      </View>
      {badge ? <View style={[styles.badge, { backgroundColor: colors.destructive }]}><Text variant="caption" color="destructiveForeground">{badge > 99 ? '99+' : badge}</Text></View> : null}
      {right}
      <ChevronRight size={18} color={colors.mutedForeground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4], minHeight: 56 },
  tile: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
