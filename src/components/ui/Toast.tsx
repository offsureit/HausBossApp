import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Text } from './Text';
import { useToastStore, type ToastItem } from '~/features/toast/store';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertCircle } as const;

/** Toasts slide down from the top with a spring, swipe up to dismiss, auto-hide with a progress bar. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing[2] }]}>
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </View>
  );
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const { colors } = useTheme();
  const { reduced, spring, duration } = useMotion();
  const dismiss = useToastStore((s) => s.dismiss);
  const translateY = useSharedValue(0);
  const progress = useSharedValue(1);
  const Icon = ICONS[toast.tone];
  const tone = { info: colors.accent, success: colors.success, warning: colors.warning, error: colors.destructive }[toast.tone];

  useEffect(() => {
    if (toast.duration <= 0) return;
    progress.set(withTiming(0, { duration: toast.duration }));
    const t = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, dismiss, progress]);

  const close = () => dismiss(toast.id);
  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      translateY.set(Math.min(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY < -30 || e.velocityY < -500) {
        translateY.set(withTiming(-120, { duration: duration.fast }, () => runOnJS(close)()));
      } else translateY.set(withSpring(0, spring.snappy));
    },
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const bar = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={reduced ? undefined : FadeInUp.springify().damping(18).stiffness(160)}
        exiting={FadeOutUp.duration(duration.fast)}
        layout={LinearTransition.duration(duration.base)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: withAlpha(tone, 0.4) }, style]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <View style={styles.row}>
          <Icon size={20} color={tone} />
          <View style={styles.text}>
            <Text variant="label">{toast.title}</Text>
            {toast.description ? <Text variant="caption" color="mutedForeground">{toast.description}</Text> : null}
          </View>
          {toast.action ? (
            <Pressable accessibilityRole="button" onPress={() => { toast.action?.onPress(); close(); }} hitSlop={8}><Text variant="label" color="accent">{toast.action.label}</Text></Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={close} hitSlop={10}><X size={16} color={colors.mutedForeground} /></Pressable>
        </View>
        {toast.duration > 0 ? <Animated.View style={[styles.progress, { backgroundColor: tone }, bar]} /> : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing[3], right: spacing[3], zIndex: 1000, gap: spacing[2] },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
  progress: { height: 3 },
});
