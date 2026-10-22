import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

export interface Segment<T extends string> { value: T; label: string }

/** iOS-style segmented control with a sliding pill (spring). */
export function SegmentedControl<T extends string>({ value, segments, onChange, accessibilityLabel }: { value: T; segments: Segment<T>[]; onChange: (v: T) => void; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const { reduced, spring, duration } = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.value === value));
  const x = useSharedValue(0);
  const segW = width > 0 ? (width - spacing[1] * 2) / segments.length : 0;
  const target = index * segW;
  useEffect(() => { x.set(reduced ? withTiming(target, { duration: duration.fast }) : withSpring(target, spring.snappy)); }, [target, reduced, duration.fast, spring.snappy, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: segW }));

  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={[styles.track, { backgroundColor: colors.muted }]}>
      {segW > 0 ? <Animated.View style={[styles.pill, { backgroundColor: colors.card }, pill]} /> : null}
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable key={s.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { if (!active) { haptics.selection(); onChange(s.value); } }} style={styles.segment}>
            <Text variant="label" color={active ? 'foreground' : 'mutedForeground'} numberOfLines={1}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: spacing[1], borderRadius: radius.md, position: 'relative' },
  pill: { position: 'absolute', top: spacing[1], bottom: spacing[1], left: spacing[1], borderRadius: radius.sm, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
});
