import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { Text } from './Text';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Fraction of the screen the sheet may grow to (default 0.9). */
  maxHeight?: number;
  /** Scroll the body (default true). Set false when the body manages its own list. */
  scroll?: boolean;
  /** Footer pinned under the body (buttons). */
  footer?: ReactNode;
}

/**
 * Bottom sheet: springs open over a dimmed backdrop, drag the handle down (or tap the backdrop /
 * press back) to dismiss. Built on a Modal so it floats over native stacks and tabs.
 */
export function Sheet({ open, onClose, title, description, children, maxHeight = 0.9, scroll = true, footer }: SheetProps) {
  const { colors } = useTheme();
  const { reduced, spring, duration } = useMotion();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const translateY = useSharedValue(screenH);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      backdrop.set(withTiming(1, { duration: duration.base }));
      translateY.set(reduced ? withTiming(0, { duration: duration.fast }) : withSpring(0, spring.settle));
    } else if (mounted) {
      backdrop.set(withTiming(0, { duration: duration.fast }));
      translateY.set(withTiming(screenH, { duration: duration.base }, (finished) => { if (finished) runOnJS(setMounted)(false); }));
    }
  }, [open, mounted, reduced, spring.settle, duration.base, duration.fast, screenH, translateY, backdrop]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [open, onClose]);

  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      translateY.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 800) runOnJS(onClose)();
      else translateY.set(withSpring(0, spring.settle));
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: screenH * maxHeight, paddingBottom: Math.max(insets.bottom, spacing[4]) }, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.handleArea}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
                {title ? <Text variant="title" style={styles.title}>{title}</Text> : null}
                {description ? <Text variant="small" color="mutedForeground" style={styles.title}>{description}</Text> : null}
              </View>
            </GestureDetector>
            <Body style={styles.body} contentContainerStyle={scroll ? styles.bodyContent : undefined} keyboardShouldPersistTaps="handled">
              {children}
            </Body>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: spacing[4], shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  handleArea: { alignItems: 'stretch', paddingTop: spacing[2], paddingBottom: spacing[2] },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing[2] },
  title: { marginTop: spacing[1] },
  body: { flexShrink: 1 },
  bodyContent: { paddingVertical: spacing[2], gap: spacing[3] },
  footer: { paddingTop: spacing[3], gap: spacing[2] },
});
