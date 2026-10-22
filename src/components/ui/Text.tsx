import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '~/theme/ThemeProvider';
import { typography, type ThemeColors, type TypographyVariant } from '~/theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  /** A theme colour name or any colour string. */
  color?: keyof ThemeColors | (string & {});
  align?: 'left' | 'center' | 'right';
}

function isThemeColor(colors: ThemeColors, value: string): value is keyof ThemeColors {
  return Object.prototype.hasOwnProperty.call(colors, value);
}

/** Themed text with the Inter type scale; honours font scaling up to 1.6× without clipping layouts. */
export function Text({ variant = 'body', color = 'foreground', align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const resolved = isThemeColor(colors, color) ? colors[color] : color;
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[typography[variant], { color: resolved }, align ? { textAlign: align } : null, style]} />;
}
