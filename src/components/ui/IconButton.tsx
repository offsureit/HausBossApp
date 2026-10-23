import type { ComponentType } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale, type PressableScaleProps } from './PressableScale';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, touchTarget, withAlpha } from '~/theme/tokens';

export interface IconButtonProps extends Omit<PressableScaleProps, 'children' | 'style'> {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  /** `solid`: a filled round button in the tone colour with a white icon (send, primary actions). */
  variant?: 'ghost' | 'outline' | 'filled' | 'solid';
  tone?: 'default' | 'accent' | 'destructive';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** 44 pt icon button with press feedback. `label` is the accessibility name. */
export function IconButton({ icon: Icon, label, variant = 'ghost', tone = 'default', size = touchTarget, disabled, style, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  const color = tone === 'accent' ? colors.accent : tone === 'destructive' ? colors.destructive : colors.foreground;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.md },
        variant === 'outline' && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
        variant === 'filled' && { backgroundColor: withAlpha(color, 0.12) },
        variant === 'solid' && { backgroundColor: color, borderRadius: size / 2 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.45)} color={variant === 'solid' ? (tone === 'destructive' ? colors.destructiveForeground : colors.accentForeground) : color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center' } });
