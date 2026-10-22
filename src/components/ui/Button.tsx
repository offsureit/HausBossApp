import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale, type PressableScaleProps } from './PressableScale';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, touchTarget, withAlpha } from '~/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableScaleProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Leading icon (a lucide element). */
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: touchTarget, lg: 52 };

export function Button({ label, variant = 'primary', size = 'md', loading = false, icon, fullWidth = false, disabled, style, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: colors.accentForeground, border: colors.accent },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: colors.secondary },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground, border: colors.destructive },
  }[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      haptic={variant !== 'ghost'}
      {...rest}
      style={[
        styles.base,
        { height: HEIGHT[size], backgroundColor: palette.bg, borderColor: palette.border, paddingHorizontal: size === 'sm' ? spacing[3] : spacing[5] },
        fullWidth && styles.full,
        inactive && { opacity: 0.6 },
        variant === 'ghost' && { backgroundColor: withAlpha(colors.accent, 0) },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={palette.fg} /> : icon}
        <Text variant={size === 'lg' ? 'bodyMedium' : 'label'} color={palette.fg} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
