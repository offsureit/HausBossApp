import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { AlertTriangle, CloudOff, RefreshCw, Trash2, UploadCloud } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '~/components/ui';
import { useOfflineQueueState } from '~/features/offline/useOfflineQueue';
import { useMotion } from '~/motion';
import { offlineQueue } from '~/services/offlineQueue';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

/**
 * Animated offline banner (brief): slides down under the status bar while offline or while
 * queued changes wait; shows the count, "Send now", and retry / discard for changes the server
 * refused ("needs attention"). Fades instead of sliding under Reduce Motion.
 */
export function OfflineBanner() {
  const { colors, scheme } = useTheme();
  const { reduced, duration } = useMotion();
  const insets = useSafeAreaInsets();
  const { queued, stuck, replaying } = useOfflineQueueState();
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);

  if (online && queued === 0) return null;
  const pending = queued - stuck;
  const text = !online
    ? `You are offline${queued ? ` — ${queued} change${queued === 1 ? '' : 's'} queued` : ''}`
    : stuck > 0 && pending === 0
      ? `${stuck} change${stuck === 1 ? '' : 's'} need${stuck === 1 ? 's' : ''} attention`
      : replaying ? `Sending ${pending} queued change${pending === 1 ? '' : 's'}…` : `${pending} queued change${pending === 1 ? '' : 's'} waiting to send`;
  const bg = !online ? (scheme === 'dark' ? '#1e293b' : '#0f172a') : stuck > 0 && pending === 0 ? colors.destructive : colors.warning;
  const fg = !online ? '#ffffff' : stuck > 0 && pending === 0 ? colors.destructiveForeground : colors.warningForeground;
  const Icon = !online ? CloudOff : stuck > 0 && pending === 0 ? AlertTriangle : UploadCloud;

  return (
    <Animated.View
      pointerEvents="box-none"
      entering={reduced ? FadeIn.duration(duration.fast) : SlideInUp.duration(duration.base)}
      exiting={reduced ? FadeOut.duration(duration.fast) : SlideOutUp.duration(duration.base)}
      style={[styles.wrap, { top: insets.top + spacing[1] }]}
    >
      <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Icon size={16} color={fg} />
        <Text variant="small" color={fg} style={styles.text} numberOfLines={2}>{text}</Text>
        {online && pending > 0 && !replaying ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Send queued changes now" onPress={() => void offlineQueue.replay()} style={[styles.action, { borderColor: fg }]}>
            <RefreshCw size={14} color={fg} />
            <Text variant="caption" color={fg}>Send now</Text>
          </Pressable>
        ) : null}
        {online && stuck > 0 && !replaying ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry changes that need attention" onPress={() => { offlineQueue.retryStuck(); void offlineQueue.replay(); }} style={[styles.action, { borderColor: fg }]}>
              <RefreshCw size={14} color={fg} />
              <Text variant="caption" color={fg}>Retry</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Discard changes that need attention" onPress={() => { for (const op of offlineQueue.readQueue()) if (op.stuck) offlineQueue.discard(op.id); }} style={[styles.action, { borderColor: fg }]}>
              <Trash2 size={14} color={fg} />
              <Text variant="caption" color={fg}>Discard</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing[3], right: spacing[3], zIndex: 50 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.lg, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  text: { flex: 1, minWidth: 0 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: spacing[2], borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth * 2, minHeight: 28 },
});
