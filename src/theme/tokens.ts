/**
 * Design tokens — the web app's `src/index.css` variables (enterprise navy, brand blue, Inter)
 * converted to hex so React Native can use them directly. Status colours match the web badges.
 */
import type { JobStatus } from '@/types';

export const brand = {
  navy: '#0b1f4a',
  blue: '#1a5cff',
} as const;

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  border: string;
  input: string;
  ring: string;
  /** Translucent overlay behind sheets and dialogs. */
  overlay: string;
  /** Skeleton base + highlight. */
  skeleton: string;
  skeletonHighlight: string;
}

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  foreground: '#0f1729',
  card: '#ffffff',
  cardForeground: '#0f1729',
  primary: '#0b1f4a',
  primaryForeground: '#f8fafc',
  secondary: '#eaf0f6',
  secondaryForeground: '#0f1729',
  muted: '#eaf0f6',
  mutedForeground: '#566376',
  accent: '#1a5cff',
  accentForeground: '#ffffff',
  // Semantic colours are one step darker than the web's so white text on them and the colour as
  // text on the page both pass WCAG AA (4.5:1) — checked by theme/__tests__/contrast.test.ts.
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  success: '#15803d',
  successForeground: '#ffffff',
  warning: '#b45309',
  warningForeground: '#ffffff',
  border: '#d7dfea',
  input: '#d7dfea',
  ring: '#1a5cff',
  overlay: 'rgba(15, 23, 41, 0.45)',
  skeleton: '#e6ecf3',
  skeletonHighlight: '#f4f7fb',
};

export const darkColors: ThemeColors = {
  background: '#090e1a',
  foreground: '#f8fafc',
  card: '#0f1524',
  cardForeground: '#f8fafc',
  primary: '#3370ff',
  primaryForeground: '#ffffff',
  secondary: '#1d283a',
  secondaryForeground: '#f8fafc',
  muted: '#1d283a',
  mutedForeground: '#94a3b8',
  // Dark surfaces need lighter semantic colours (readable as text on the page), which in turn
  // need dark text on top of them: the "on-colour" is navy, not white, in dark mode.
  accent: '#4d82ff',
  accentForeground: '#0f1729',
  destructive: '#ef5a5a',
  destructiveForeground: '#0f1729',
  success: '#29a356',
  successForeground: '#0f1729',
  warning: '#f6a823',
  warningForeground: '#0f1729',
  border: '#222f44',
  input: '#222f44',
  ring: '#3370ff',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1b2538',
  skeletonHighlight: '#26324a',
};

/** Pin / dot colour per status (same values as `JobsMapView.STATUS_PIN_COLORS`). */
export const statusColors: Record<JobStatus, string> = {
  pending: '#f59e0b',
  accepted: '#0ea5e9',
  'en-route': '#6366f1',
  arrived: '#8b5cf6',
  'in-progress': '#3b82f6',
  completed: '#10b981',
};

/** Badge colours per status, light / dark (tailwind -50/-800 and -950/-200 like the web). */
export const statusBadge: Record<JobStatus, { light: { bg: string; fg: string; border: string }; dark: { bg: string; fg: string; border: string } }> = {
  pending: { light: { bg: '#fffbeb', fg: '#92400e', border: '#fde68a' }, dark: { bg: '#3a2a08', fg: '#fde68a', border: '#78350f' } },
  accepted: { light: { bg: '#f0f9ff', fg: '#075985', border: '#bae6fd' }, dark: { bg: '#082f49', fg: '#bae6fd', border: '#0c4a6e' } },
  'en-route': { light: { bg: '#eef2ff', fg: '#3730a3', border: '#c7d2fe' }, dark: { bg: '#1e1b4b', fg: '#c7d2fe', border: '#312e81' } },
  arrived: { light: { bg: '#f5f3ff', fg: '#5b21b6', border: '#ddd6fe' }, dark: { bg: '#2e1065', fg: '#ddd6fe', border: '#4c1d95' } },
  'in-progress': { light: { bg: '#eff6ff', fg: '#1e40af', border: '#bfdbfe' }, dark: { bg: '#172554', fg: '#bfdbfe', border: '#1e3a8a' } },
  completed: { light: { bg: '#ecfdf5', fg: '#065f46', border: '#a7f3d0' }, dark: { bg: '#022c22', fg: '#a7f3d0', border: '#064e3b' } },
};

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export type SpacingKey = keyof typeof spacing;

/** `--radius: 0.5rem` on the web. */
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.bold },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fontFamily.semibold },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.semibold },
  body: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily.regular },
  bodyMedium: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily.medium },
  label: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.medium },
  small: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.regular },
  overline: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.semibold, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  mono: { fontSize: 12, lineHeight: 16, fontFamily: 'monospace' },
} as const;
export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (44pt). */
export const touchTarget = 44;

/** Hex colour + alpha (0–1) → rgba string. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
