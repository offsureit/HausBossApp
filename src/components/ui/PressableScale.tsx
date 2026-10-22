import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Light haptic on press-in (default on). */
  haptic?: boolean;
  scaleTo?: number;
}

/** Press feedback for every tappable: scales to 0.97 with the `snappy` spring + a light haptic. */
export function PressableScale({ style, haptic = true, scaleTo = 0.97, onPressIn, onPressOut, disabled, ...rest }: PressableScaleProps) {
  const { reduced, spring } = useMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!reduced) scale.set(withSpring(scaleTo, spring.snappy));
    if (haptic) haptics.light();
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    scale.set(withSpring(1, spring.snappy));
    onPressOut?.(e);
  };

  return <AnimatedPressable {...rest} disabled={disabled} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[animated, style]} />;
}
