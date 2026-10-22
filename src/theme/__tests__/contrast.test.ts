import { darkColors, lightColors, statusBadge, type ThemeColors } from '../tokens';

/** WCAG 2.x relative luminance / contrast ratio. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE = 3; // ≥ 18 pt regular / 14 pt bold, and non-text UI components

/** Text / background pairs used across the app, both themes (brief "Accessibility: contrast AA in both themes"). */
const textPairs: [keyof ThemeColors, keyof ThemeColors][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['cardForeground', 'card'],
  ['mutedForeground', 'background'],
  ['mutedForeground', 'card'],
  ['mutedForeground', 'muted'],
  ['accentForeground', 'accent'],
  ['destructiveForeground', 'destructive'],
  ['successForeground', 'success'],
  ['warningForeground', 'warning'],
  ['accent', 'background'],
  ['accent', 'card'],
  ['destructive', 'background'],
];

describe.each([['light', lightColors], ['dark', darkColors]] as const)('%s theme contrast', (_name, colors) => {
  it.each(textPairs)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('borders and focus rings are visible (≥ 3:1 is not required for borders, but they must not vanish)', () => {
    expect(contrast(colors.border, colors.background)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(colors.border, colors.card)).toBeGreaterThanOrEqual(1.15);
  });

  it('status badges: label on badge ≥ 4.5:1', () => {
    for (const [status, variants] of Object.entries(statusBadge)) {
      const v = _name === 'light' ? variants.light : variants.dark;
      expect({ status, ratio: Math.round(contrast(v.fg, v.bg) * 100) / 100 }).toMatchObject({ status, ratio: expect.any(Number) });
      expect(contrast(v.fg, v.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('semantic colours stand out from the surfaces (≥ 3:1 for icons / fills)', () => {
    for (const key of ['accent', 'destructive', 'success', 'warning'] as const) {
      expect(contrast(colors[key], colors.background)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrast(colors[key], colors.card)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});
