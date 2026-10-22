import { useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Phone, UserCog } from 'lucide-react-native';
import { JOB_STATUS_LABELS, nextStatus } from '@/utils/jobStatus';
import type { Job, JobStatus } from '@/types';
import { primaryActionFor } from '~/components/jobs/primaryAction';
import { Text } from '~/components/ui';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

const THRESHOLD = 96;
const PANE = 112;

export interface SwipeableJobRowProps {
  job: Job;
  children: ReactNode;
  /** Swipe right → advance to this status (omit to disable the right swipe). */
  onAdvance?: (job: Job, status: JobStatus) => void;
  /** Swipe left → reassign (staff). */
  onReassign?: (job: Job) => void;
}

/**
 * Swipe actions on job rows (brief): swipe right = advance status (green reveal, icon scales in at
 * the threshold + haptic), swipe left = reassign / call. Rubber-bands past the threshold.
 */
export function SwipeableJobRow({ job, children, onAdvance, onReassign }: SwipeableJobRowProps) {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const ref = useRef<SwipeableMethods>(null);
  const target = nextStatus(job.status);
  const action = primaryActionFor(job.status);
  const canAdvance = !!onAdvance && !!target && !!action.kind;
  const canCall = !!job.clientPhone;
  const canLeft = !!onReassign || canCall;

  const renderLeft = (progress: SharedValue<number>, translation: SharedValue<number>) => (
    <ActionPane side="left" color={colors.success} progress={progress} translation={translation}>
      {action.icon ? <action.icon size={22} color={colors.successForeground} /> : null}
      <Text variant="caption" color="successForeground">{target ? JOB_STATUS_LABELS[target] : ''}</Text>
    </ActionPane>
  );
  const renderRight = (progress: SharedValue<number>, translation: SharedValue<number>) => (
    <ActionPane side="right" color={onReassign ? colors.accent : colors.primary} progress={progress} translation={translation}>
      {onReassign ? <UserCog size={22} color={colors.accentForeground} /> : <Phone size={22} color={colors.primaryForeground} />}
      <Text variant="caption" color={onReassign ? 'accentForeground' : 'primaryForeground'}>{onReassign ? 'Reassign' : 'Call'}</Text>
    </ActionPane>
  );

  if (reduced || (!canAdvance && !canLeft)) return <>{children}</>;
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      overshootFriction={6}
      leftThreshold={THRESHOLD}
      rightThreshold={THRESHOLD}
      enableTrackpadTwoFingerGesture
      renderLeftActions={canAdvance ? renderLeft : undefined}
      renderRightActions={canLeft ? renderRight : undefined}
      onSwipeableWillOpen={() => haptics.medium()}
      onSwipeableOpen={(direction) => {
        // `direction` is where the row moved: 'right' = the left (advance) pane is showing.
        ref.current?.close();
        if (direction === 'right' && canAdvance && target) onAdvance?.(job, target);
        else if (direction === 'left') { if (onReassign) onReassign(job); else if (canCall) void links.call(job.clientPhone); }
      }}
      containerStyle={styles.container}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function ActionPane({ side, color, progress, translation, children }: { side: 'left' | 'right'; color: string; progress: SharedValue<number>; translation: SharedValue<number>; children: ReactNode }) {
  // The two pane containers overlap (both absolute-fill), so each pane is only as wide as the
  // revealed area: its measured width (PANE) sets the snap point, the drag stretches the fill.
  const pane = useAnimatedStyle(() => {
    const t = translation.get();
    const revealed = side === 'left' ? Math.max(0, t) : Math.max(0, -t);
    return { width: Math.max(PANE, revealed) };
  });
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.get(), [0, 0.6, 1], [0.4, 0.8, 1.15], 'clamp') }], opacity: interpolate(progress.get(), [0, 0.3, 1], [0, 0.6, 1], 'clamp') }));
  return (
    <Animated.View style={[styles.pane, { backgroundColor: color, alignItems: side === 'left' ? 'flex-start' : 'flex-end' }, pane]}>
      <Animated.View style={[styles.action, icon]}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.lg, overflow: 'hidden' },
  pane: { width: PANE, justifyContent: 'center', borderRadius: radius.lg, paddingHorizontal: spacing[5] },
  action: { alignItems: 'center', justifyContent: 'center', gap: 4, width: 72 },
});
