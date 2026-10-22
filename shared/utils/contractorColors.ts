/**
 * Technician identity colour (PROJECT_HANDOFF §14 "Technician identity colour"):
 * a deterministic 12-colour palette keyed by the technician's name; unassigned
 * renders gray. A `profiles.color` value, when present, overrides the palette.
 */

export const CONTRACTOR_PALETTE: readonly string[] = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#0d9488', // teal
  '#4f46e5', // indigo
  '#b45309', // brown
];

export const UNASSIGNED_COLOR = '#9ca3af';

/** Stable 32-bit FNV-1a hash so the same name always maps to the same colour. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function getContractorColor(name: string | null | undefined, overrideColor?: string | null): string {
  if (overrideColor && overrideColor.trim()) return overrideColor.trim();
  const key = (name ?? '').trim().toLowerCase();
  if (!key) return UNASSIGNED_COLOR;
  return CONTRACTOR_PALETTE[hashString(key) % CONTRACTOR_PALETTE.length];
}

/** Black or white text that stays readable on the given hex colour. */
export function getContrastText(hex: string): '#000000' | '#ffffff' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}
