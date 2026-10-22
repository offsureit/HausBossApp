import { useEffect, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

export interface TabItem<T extends string> { value: T; label: string; icon?: ComponentType<{ size?: number; color?: string }>; badge?: number }

/** Scrollable tab strip with an animated underline (job details sections). */
export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: TabItem<T>[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  const { reduced, spring, duration } = useMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const current = layouts[value];
  useEffect(() => {
    if (!current) return;
    x.set(reduced ? withTiming(current.x, { duration: duration.fast }) : withSpring(current.x, spring.snappy));
    w.set(reduced ? withTiming(current.width, { duration: duration.fast }) : withSpring(current.width, spring.snappy));
  }, [current, reduced, duration.fast, spring.snappy, x, w]);
  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: w.get() }));

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
        {items.map((item) => {
          const active = item.value === value;
          const Icon = item.icon;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onLayout={(e: LayoutChangeEvent) => { const { x: lx, width } = e.nativeEvent.layout; setLayouts((prev) => (prev[item.value]?.x === lx && prev[item.value]?.width === width ? prev : { ...prev, [item.value]: { x: lx, width } })); }}
              onPress={() => { if (!active) { haptics.selection(); onChange(item.value); } }}
              style={styles.tab}
            >
              {Icon ? <Icon size={16} color={active ? colors.accent : colors.mutedForeground} /> : null}
              <Text variant="label" color={active ? 'accent' : 'mutedForeground'}>{item.label}</Text>
              {item.badge ? <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text variant="caption" color="accentForeground">{item.badge > 99 ? '99+' : item.badge}</Text></View> : null}
            </Pressable>
          );
        })}
        <Animated.View style={[styles.underline, { backgroundColor: colors.accent }, underline]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', position: 'relative', paddingHorizontal: spacing[2] },
  tab: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[3], minHeight: 44, justifyContent: 'center' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  underline: { position: 'absolute', bottom: 0, left: 0, height: 2, borderRadius: 1 },
});
