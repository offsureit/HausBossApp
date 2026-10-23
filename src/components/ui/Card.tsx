import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '~/theme/ThemeProvider';
import { elevation, radius, spacing, withAlpha } from '~/theme/tokens';

export interface CardProps extends ViewProps {
  padded?: boolean;
  /** Accent border (e.g. the live job). */
  highlighted?: boolean;
  /** Shadow depth in light mode (dark mode uses a border). */
  level?: 1 | 2 | 3;
}

/** A floating surface: soft layered shadow in light mode, a hairline border in dark mode. */
export function Card({ padded = true, highlighted = false, level = 2, style, ...rest }: CardProps) {
  const { colors, scheme } = useTheme();
  const border = highlighted ? colors.accent : scheme === 'dark' ? colors.border : withAlpha(colors.border, 0.6);
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: border, borderWidth: highlighted ? 1.5 : StyleSheet.hairlineWidth },
        elevation(level, scheme),
        padded && { padding: spacing[4] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
});
