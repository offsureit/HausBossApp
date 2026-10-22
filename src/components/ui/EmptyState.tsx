import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

export interface EmptyStateProps {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  message?: string;
  action?: ReactNode;
  tone?: 'muted' | 'accent';
}

export function EmptyState({ icon: Icon, title, message, action, tone = 'muted' }: EmptyStateProps) {
  const { colors } = useTheme();
  const color = tone === 'accent' ? colors.accent : colors.mutedForeground;
  return (
    <View style={[styles.wrap, { borderColor: colors.border }]} accessible accessibilityLabel={`${title}. ${message ?? ''}`}>
      <View style={[styles.iconWrap, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon size={28} color={color} />
      </View>
      <Text variant="heading" align="center">{title}</Text>
      {message ? <Text variant="small" color="mutedForeground" align="center">{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing[2], padding: spacing[6], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  action: { marginTop: spacing[2] },
});
