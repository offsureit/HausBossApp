import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Loading placeholder that breathes between the base and highlight colours (static under Reduce Motion). */
export function Skeleton({ width = '100%', height = 16, round = false, style }: SkeletonProps) {
  const { colors } = useTheme();
  const { reduced, duration } = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) { progress.set(0); return; }
    progress.set(withRepeat(withTiming(1, { duration: duration.hero * 1.5 }), -1, true));
    return () => cancelAnimation(progress);
  }, [reduced, duration.hero, progress]);

  const animated = useAnimatedStyle(() => ({ opacity: 1 - progress.get() * 0.45 }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, backgroundColor: colors.skeleton, borderRadius: round ? height / 2 : radius.sm }, animated, style]}
    />
  );
}

/** A job-card shaped placeholder. */
export function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Skeleton width="55%" height={18} />
        <Skeleton width={72} height={20} round />
      </View>
      <Skeleton width="85%" height={14} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[4], gap: spacing[3] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
