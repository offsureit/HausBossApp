import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from '~/components/ui/Text';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily } from '~/theme/tokens';

/** Exact colours of `hausboss-logo.png` (the app icon and splash use the same). */
export const LOGO_NAVY = '#041a3d';
export const LOGO_BLUE = '#0459e6';

/** Geometry of the house in the logo (304 × 252 box): roof band, left wall, right wall (blue below the band), 2 × 2 window. */
const ROOF_AND_WALLS = 'M152 0 L304 106 L304 166 L252 129.7 L152 60 L48 129.8 L48 252 L0 252 L0 102 Z';
const RIGHT_WALL = 'M252 129.7 L304 166 L304 252 L252 252 Z';
const PANES = [[116, 138], [154, 138], [116, 176], [154, 176]] as const;

/**
 * The house mark from `hausboss-logo.png`, as a vector so it is crisp at any size. Defaults to the
 * logo's navy + blue; pass `primary` (and `accent`) to draw it white on a dark surface.
 */
export function HouseMark({ size = 48, primary = LOGO_NAVY, accent = LOGO_BLUE }: { size?: number; primary?: string; accent?: string }) {
  const height = (size * 252) / 304;
  return (
    <Svg width={size} height={height} viewBox="0 0 304 252" accessibilityLabel="HausBoss">
      <Path d={ROOF_AND_WALLS} fill={primary} />
      <Path d={RIGHT_WALL} fill={accent} />
      {PANES.map(([x, y]) => <Rect key={`${x}-${y}`} x={x} y={y} width={30} height={30} rx={4} fill={primary} />)}
    </Svg>
  );
}

/**
 * The logo lock-up: the house mark and "hausboss" in Inter (navy / brand blue), as on hausboss.app.
 * On dark surfaces the navy parts turn white.
 */
export function BrandLogo({ height = 56 }: { height?: number }) {
  const { scheme } = useTheme();
  const navy = scheme === 'dark' ? '#ffffff' : LOGO_NAVY;
  const fontSize = height * 0.62;
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="HausBoss">
      <HouseMark size={height * 1.05} primary={navy} accent={LOGO_BLUE} />
      <Text style={[styles.word, { fontSize, lineHeight: height, color: navy }]}>
        haus<Text style={[styles.word, { fontSize, lineHeight: height, color: LOGO_BLUE }]}>boss</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontFamily: fontFamily.bold, letterSpacing: -0.5 },
});
