import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

export interface CardProps extends ViewProps {
  padded?: boolean;
  /** Accent border (e.g. the live job). */
  highlighted?: boolean;
}

export function Card({ padded = true, highlighted = false, style, ...rest }: CardProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: highlighted ? colors.accent : colors.border, shadowOpacity: scheme === 'dark' ? 0 : 0.06 },
        padded && { padding: spacing[4] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0b1f4a',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
});
