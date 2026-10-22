/**
 * Motion system (docs/MOBILE_APP_PROMPT.md "Motion and animation system").
 * Screens use only these tokens — no ad-hoc timing values.
 */
import { Easing, FadeIn, FadeInUp, FadeOut, useReducedMotion, type WithSpringConfig } from 'react-native-reanimated';

export const duration = { instant: 100, fast: 180, base: 260, slow: 400, hero: 600 } as const;

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
} as const;

export const spring: Record<'snappy' | 'gentle' | 'bouncy' | 'settle', WithSpringConfig> = {
  snappy: { damping: 20, stiffness: 300 },
  gentle: { damping: 18, stiffness: 160 },
  bouncy: { damping: 12, stiffness: 180 },
  /** Sheets and other long travels: near-critically damped and clamped, so they slide in and stop without bouncing. */
  settle: { damping: 30, stiffness: 240, overshootClamping: true },
};

/** 40 ms per list item, capped at the 8th item. */
export const STAGGER_MS = 40;
export const STAGGER_CAP = 8;
export function stagger(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_CAP) * STAGGER_MS;
}

/** Entrance for list items / form fields: fade up 12 px; a plain fade when Reduce Motion is on. */
export function enterUp(index = 0, reduced = false) {
  if (reduced) return FadeIn.duration(duration.fast);
  return FadeInUp.duration(duration.base).delay(stagger(index)).easing(easing.standard).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] });
}

export function enterFade(reduced = false, delay = 0) {
  return FadeIn.duration(reduced ? duration.fast : duration.base).delay(reduced ? 0 : delay);
}

export function exitFade() {
  return FadeOut.duration(duration.fast).easing(easing.exit);
}

/** Reduce Motion (OS accessibility setting), read on the UI thread by Reanimated. */
export function useMotion() {
  const reduced = useReducedMotion();
  return { reduced, duration, easing, spring, stagger, enterUp: (i = 0) => enterUp(i, reduced), enterFade: (delay = 0) => enterFade(reduced, delay), exitFade };
}
