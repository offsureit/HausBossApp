import { useEffect, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

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
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
        {/* The active tab sits on a solid accent pill that slides between tabs. */}
        <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: colors.accent }, underline]} />
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
              {Icon ? <Icon size={16} color={active ? colors.accentForeground : colors.mutedForeground} /> : null}
              <Text variant="label" color={active ? 'accentForeground' : 'mutedForeground'} style={active ? styles.activeText : undefined}>{item.label}</Text>
              {item.badge ? <View style={[styles.badge, { backgroundColor: colors.destructive }]}><Text variant="caption" color="destructiveForeground">{item.badge > 99 ? '99+' : item.badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing[2] },
  row: { flexDirection: 'row', position: 'relative', paddingHorizontal: spacing[3], gap: spacing[1] },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], minHeight: 40, justifyContent: 'center', borderRadius: radius.full },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.full },
  activeText: { fontFamily: 'Inter_600SemiBold' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
});
