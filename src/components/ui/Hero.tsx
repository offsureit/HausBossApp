import { useCallback, useId, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { HouseMark } from '~/components/BrandLogo';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { gradients, radius, spacing } from '~/theme/tokens';

const GLASS = 'rgba(255, 255, 255, 0.13)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.2)';
export const HERO_TEXT_MUTED = 'rgba(255, 255, 255, 0.78)';

/** The brand gradient with soft light circles and a faint house mark — the backdrop of every hero. */
export function GradientBackdrop({ rounded = radius.xxl, watermark = true }: { rounded?: number; watermark?: boolean }) {
  const { scheme } = useTheme();
  const id = useId().replace(/:/g, '');
  const [a, b, c] = gradients.hero[scheme];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: rounded, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="0.55" stopColor={b} />
            <Stop offset="1" stopColor={c} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#g${id})`} />
        <Circle cx="92%" cy="-6%" r="130" fill="#ffffff" opacity={0.08} />
        <Circle cx="4%" cy="108%" r="110" fill="#ffffff" opacity={0.06} />
      </Svg>
      {watermark ? <View style={styles.watermark}><HouseMark size={150} primary="rgba(255,255,255,0.07)" accent="rgba(255,255,255,0.11)" /></View> : null}
    </View>
  );
}

/** Light status-bar icons while a hero screen is focused. */
export function useLightStatusBar() {
  const { scheme } = useTheme();
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme]));
}

export interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  /** Small line above the title (date, company). */
  eyebrow?: string;
  right?: ReactNode;
  /** Stats, chips or actions under the title. */
  children?: ReactNode;
}

/**
 * Full-bleed gradient header for tab roots: runs under the status bar, rounded bottom corners, white
 * type. Place it first inside `<Screen hero>` (which drops the top safe-area edge for it).
 */
export function HeroHeader({ title, subtitle, eyebrow, right, children }: HeroHeaderProps) {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing[3] }]} accessibilityRole="header">
      <GradientBackdrop />
      <View style={styles.heroTop}>
        <View style={styles.heroText}>
          {eyebrow ? <Text variant="overline" color={HERO_TEXT_MUTED}>{eyebrow}</Text> : null}
          <Text variant="display" color="#ffffff" numberOfLines={2}>{title}</Text>
          {subtitle ? <Text variant="small" color={HERO_TEXT_MUTED}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.heroRight}>{right}</View> : null}
      </View>
      {children ? <View style={styles.heroBody}>{children}</View> : null}
    </View>
  );
}

/** A frosted stat tile inside a hero: icon, big number, label. */
export function HeroStat({ icon: Icon, value, label, style }: { icon?: ComponentType<{ size?: number; color?: string }>; value: ReactNode; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, style]} accessible accessibilityLabel={`${label}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}`}>
      {Icon ? <View style={styles.statIcon}><Icon size={16} color="#ffffff" /></View> : null}
      <Text variant="title" color="#ffffff" numberOfLines={1}>{value}</Text>
      <Text variant="caption" color={HERO_TEXT_MUTED} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Round frosted icon button for hero headers. */
export function HeroIconButton({ icon: Icon, label, onPress, disabled = false }: { icon: ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.iconBtn, disabled && { opacity: 0.45 }]}>
      <Icon size={20} color="#ffffff" />
    </PressableScale>
  );
}

/** A frosted pill (status line, location sharing…). */
export function HeroPill({ icon: Icon, label, tone = '#ffffff', onPress }: { icon?: ComponentType<{ size?: number; color?: string }>; label: string; tone?: string; onPress?: () => void }) {
  const body = (
    <>
      {Icon ? <Icon size={14} color={tone} /> : null}
      <Text variant="caption" color={tone} style={styles.pillText}>{label}</Text>
    </>
  );
  return onPress
    ? <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.pill}>{body}</PressableScale>
    : <View style={styles.pill} accessibilityLabel={label}>{body}</View>;
}

/** Section title with a count pill and an optional action on the right. */
export function SectionHeader({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section} accessibilityRole="header" accessibilityLabel={count === undefined ? title : `${title}, ${count}`}>
      <View style={styles.sectionTitle}>
        <Text variant="heading">{title}</Text>
        {count !== undefined ? <View style={[styles.count, { backgroundColor: colors.muted }]}><Text variant="caption" color="mutedForeground" style={styles.countText}>{count}</Text></View> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: -spacing[4], marginTop: -spacing[4], paddingHorizontal: spacing[5], paddingBottom: spacing[6], borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl, gap: spacing[4], overflow: 'hidden' },
  watermark: { position: 'absolute', right: -24, bottom: -18 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  heroText: { flex: 1, minWidth: 0, gap: 2 },
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroBody: { gap: spacing[3] },
  stat: { flex: 1, minWidth: 0, backgroundColor: GLASS, borderColor: GLASS_BORDER, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing[3], gap: 2 },
  statIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: GLASS, borderColor: GLASS_BORDER, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: GLASS, borderColor: GLASS_BORDER, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  pillText: { fontFamily: 'Inter_600SemiBold' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginTop: spacing[1] },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  count: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: 'Inter_600SemiBold' },
});
