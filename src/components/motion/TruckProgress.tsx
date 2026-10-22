import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { MapPin, Truck } from 'lucide-react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing, withAlpha } from '~/theme/tokens';

const TRUCK = 28;

/**
 * The "On my way" confirmation (brief): a small truck drives along a dotted path to the pin,
 * then `onDone` fires. A plain fade under Reduce Motion.
 */
export function TruckProgress({ onDone, durationMs = 1100 }: { onDone?: () => void; durationMs?: number }) {
  const { colors } = useTheme();
  const { reduced, duration } = useMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (width === 0) return;
    const end = width - TRUCK;
    if (reduced) { x.set(end); const t = setTimeout(() => onDone?.(), duration.base); return () => clearTimeout(t); }
    bob.set(withRepeat(withSequence(withTiming(-1.5, { duration: 90 }), withTiming(1.5, { duration: 90 })), -1, true));
    x.set(withTiming(end, { duration: durationMs, easing: Easing.inOut(Easing.cubic) }, (finished) => { if (finished && onDone) runOnJS(onDone)(); }));
  }, [width, reduced, duration.base, durationMs, onDone, x, bob]);

  const truck = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: bob.get() }] }));
  const dots = Math.max(0, Math.floor((width - TRUCK) / 10));

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel="On my way confirmed" accessibilityRole="image">
      <View style={styles.path}>
        {Array.from({ length: dots }, (_, i) => <View key={i} style={[styles.dot, { backgroundColor: withAlpha(colors.accent, 0.35) }]} />)}
      </View>
      <View style={styles.pin}><MapPin size={22} color={colors.destructive} /></View>
      <Animated.View style={[styles.truck, truck]}><Truck size={TRUCK} color={colors.accent} /></Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 44, justifyContent: 'center', marginVertical: spacing[2] },
  path: { position: 'absolute', left: TRUCK / 2, right: TRUCK / 2, flexDirection: 'row', gap: 6, alignItems: 'center', overflow: 'hidden' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  pin: { position: 'absolute', right: 0, top: 0 },
  truck: { position: 'absolute', left: 0, top: 8 },
});
