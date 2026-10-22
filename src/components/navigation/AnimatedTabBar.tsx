import { useEffect, type ComponentProps, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { Tabs } from 'expo-router';
import { Text } from '~/components/ui';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, radius, spacing, withAlpha } from '~/theme/tokens';

export type TabIcon = ComponentType<{ size?: number; color?: string }>;

const ICON_WRAP = 36;

/** The props expo-router hands to a custom `tabBar` (React Navigation's BottomTabBarProps). */
export type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export interface AnimatedTabBarProps extends BottomTabBarProps {
  icons: Record<string, TabIcon>;
  badges?: Record<string, number | undefined>;
}

/**
 * The bottom tab bar (brief: "animated tab bar"): the active icon pops with the `bouncy` spring
 * inside a soft pill that slides between tabs; badges count unread chat / texts. Plain fades
 * under Reduce Motion. Tabs with `href: null` are hidden by the router before they reach here.
 */
export function AnimatedTabBar({ state, descriptors, emitter, navigateToTab, insets, icons, badges }: AnimatedTabBarProps) {
  const { colors } = useTheme();
  const { reduced, spring, duration } = useMotion();
  const routes = state.routes.filter((r) => {
    const o = descriptors[r.key]?.options as { href?: unknown; tabBarButton?: unknown } | undefined;
    return o?.href !== null;
  });
  const activeIndex = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index]?.key));
  const pill = useSharedValue(activeIndex);
  useEffect(() => {
    pill.set(reduced ? withTiming(activeIndex, { duration: duration.fast }) : withSpring(activeIndex, spring.settle));
  }, [activeIndex, reduced, spring.settle, duration.fast, pill]);
  const count = routes.length || 1;
  const pillStyle = useAnimatedStyle(() => ({ left: `${(pill.get() / count) * 100}%`, width: `${100 / count}%` }));

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing[2]) }]} accessibilityRole="tablist">
      {/* The track is inset by the bar's horizontal padding so the pill's percentage offsets line up with the tabs. */}
      <View pointerEvents="none" style={styles.pillTrack}>
        <Animated.View style={[styles.pillSlot, pillStyle]}>
          <View style={[styles.pill, { backgroundColor: withAlpha(colors.accent, 0.12) }]} />
        </Animated.View>
      </View>
      {routes.map((route) => {
        const options = descriptors[route.key]?.options ?? {};
        const focused = state.routes[state.index]?.key === route.key;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const Icon = icons[route.name];
        const badge = badges?.[route.name] ?? 0;
        return (
          <TabItem
            key={route.key}
            label={label}
            Icon={Icon}
            focused={focused}
            badge={badge}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) { haptics.selection(); navigateToTab(route.key); }
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}

function TabItem({ label, Icon, focused, badge, onPress, onLongPress }: { label: string; Icon?: TabIcon; focused: boolean; badge: number; onPress: () => void; onLongPress: () => void }) {
  const { colors } = useTheme();
  const { reduced, spring, duration } = useMotion();
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) { scale.set(1); lift.set(0); return; }
    if (focused) {
      scale.set(withSequence(withTiming(1.18, { duration: duration.instant }), withSpring(1.08, spring.bouncy)));
      lift.set(withSpring(-2, spring.snappy));
    } else {
      scale.set(withSpring(1, spring.snappy));
      lift.set(withSpring(0, spring.snappy));
    }
  }, [focused, reduced, spring, duration.instant, scale, lift]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }, { translateY: lift.get() }] }));
  const color = focused ? colors.accent : colors.mutedForeground;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={badge ? `${label}, ${badge} unread` : label} onPress={onPress} onLongPress={onLongPress} style={styles.item}>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        {Icon ? <Icon size={24} color={color} /> : null}
        {badge > 0 ? <View style={[styles.badge, { backgroundColor: colors.destructive, borderColor: colors.card }]}><Text variant="caption" color="destructiveForeground" style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </Animated.View>
      <Text variant="caption" color={color} style={[styles.label, focused && { fontFamily: fontFamily.semibold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], paddingHorizontal: spacing[2] },
  pillTrack: { position: 'absolute', left: spacing[2], right: spacing[2], top: spacing[2], height: ICON_WRAP },
  pillSlot: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 56, height: 32, borderRadius: radius.full },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  iconWrap: { width: ICON_WRAP, height: ICON_WRAP, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, right: -4, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: fontFamily.semibold },
  label: { fontSize: 11, lineHeight: 14 },
});
