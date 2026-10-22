import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { JOB_STATUSES, JOB_STATUS_LABELS, isValidTransition } from '@/utils/jobStatus';
import type { JobStatus } from '@/types';
import { Text } from '~/components/ui';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

export interface JobStatusStepperProps {
  status: JobStatus;
  onChange: (status: JobStatus) => void;
  /** Staff may jump to any status; technicians only step forward. */
  isStaff: boolean;
  disabled?: boolean;
}

const NODE = 28;

/**
 * The six-step status control (§13). Advancing fills the connector with a sweep and the new node
 * pops with the `bouncy` spring; success haptic on every change.
 */
export function JobStatusStepper({ status, onChange, isStaff, disabled = false }: JobStatusStepperProps) {
  const { colors } = useTheme();
  const { reduced, spring, duration, easing } = useMotion();
  const [width, setWidth] = useState(0);
  const currentIndex = JOB_STATUSES.indexOf(status);
  const steps = JOB_STATUSES.length;
  const fill = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    const target = width > 0 ? (currentIndex / (steps - 1)) * (width - NODE) : 0;
    fill.set(withTiming(target, { duration: reduced ? duration.fast : duration.slow, easing: easing.standard }));
    if (!reduced) pop.set(withSequence(withTiming(1.25, { duration: duration.instant }), withSpring(1, spring.bouncy)));
  }, [currentIndex, width, steps, reduced, duration, easing, spring, fill, pop]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.get() }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Job status: ${JOB_STATUS_LABELS[status]}`} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: colors.border, left: NODE / 2, right: NODE / 2 }]} />
      <Animated.View style={[styles.trackFill, { backgroundColor: colors.success, left: NODE / 2 }, fillStyle]} />
      <View style={styles.nodes}>
        {JOB_STATUSES.map((s, i) => {
          const reached = i <= currentIndex;
          const current = s === status;
          const allowed = !disabled && !current && isValidTransition(status, s, { isStaff });
          const bg = current ? colors.accent : reached ? colors.success : colors.card;
          const border = current ? colors.accent : reached ? colors.success : colors.border;
          const node = (
            <View style={[styles.node, { backgroundColor: bg, borderColor: border }]}>
              {reached && !current ? <Check size={14} color={colors.successForeground} /> : <Text variant="caption" color={current ? colors.accentForeground : reached ? colors.successForeground : colors.mutedForeground}>{i + 1}</Text>}
            </View>
          );
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`${JOB_STATUS_LABELS[s]}${current ? ' (current)' : allowed ? '' : ' (unavailable)'}`}
              accessibilityState={{ disabled: !allowed, selected: current }}
              disabled={!allowed}
              onPress={() => { haptics.success(); onChange(s); }}
              style={[styles.step, !allowed && !current && { opacity: 0.6 }]}
            >
              {current ? <Animated.View style={popStyle}>{node}</Animated.View> : node}
              <Text variant="caption" color={reached ? 'foreground' : 'mutedForeground'} align="center" style={styles.label}>{JOB_STATUS_LABELS[s]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing[2] },
  track: { position: 'absolute', top: spacing[2] + NODE / 2 - 1, height: 2 },
  trackFill: { position: 'absolute', top: spacing[2] + NODE / 2 - 1, height: 2, borderRadius: 1 },
  nodes: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { width: `${100 / 6}%`, alignItems: 'center', gap: spacing[1] },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, lineHeight: 12 },
});
