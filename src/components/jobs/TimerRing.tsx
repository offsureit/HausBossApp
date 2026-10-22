import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { withAlpha } from '~/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface TimerRingProps {
  /** 0–1: how much of the ring is filled. */
  progress: number;
  /** Running = animated fill + a soft breathing glow. */
  active: boolean;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}

/**
 * Circular progress ring for the clock-in timer (brief: "circular progress ring with a soft
 * breathing glow while running"). SVG stroke animated on the UI thread; the glow is skipped
 * under Reduce Motion.
 */
export function TimerRing({ progress, active, size = 120, stroke = 10, color, children }: TimerRingProps) {
  const { colors } = useTheme();
  const { reduced, duration, easing } = useMotion();
  const tint = color ?? (active ? colors.success : colors.mutedForeground);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = useSharedValue(progress);
  const glow = useSharedValue(0);

  useEffect(() => {
    fill.set(withTiming(Math.min(1, Math.max(0, progress)), { duration: reduced ? duration.fast : duration.slow, easing: easing.standard }));
  }, [progress, reduced, duration, easing, fill]);

  useEffect(() => {
    if (!active || reduced) { cancelAnimation(glow); glow.set(withTiming(0, { duration: duration.fast })); return; }
    glow.set(withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1, false));
    return () => cancelAnimation(glow);
  }, [active, reduced, duration.fast, glow]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - fill.get()) }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.15 + glow.get() * 0.35, transform: [{ scale: 1 + glow.get() * 0.06 }] }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      {active ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { borderRadius: size / 2, backgroundColor: withAlpha(tint, 0.5) }, glowStyle]} /> : null}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={withAlpha(tint, 0.18)} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={ringProps} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { margin: 6 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
