import type { LineItemKind } from '@/types';

/**
 * Estimate money math — a faithful mirror of the database triggers
 * `recalc_estimate_totals()` / `recalc_estimate_on_change()` (PROJECT_HANDOFF §14):
 *
 *   line_total = round(quantity * unit_price, 2)
 *   tax_amount = round((parts + services - discount) * tax_rate / 100, 2)
 *   total      = round(parts + services - discount + tax_amount, 2)
 *
 * Tax is applied AFTER the discount. The database is authoritative; this is
 * used for the editor preview only.
 */

export const DEFAULT_TAX_RATE = 8.25;

export interface EstimateMathItem {
  kind: LineItemKind;
  quantity: number;
  unit_price: number;
}

export interface EstimateTotals {
  subtotalParts: number;
  subtotalServices: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

/** Postgres `round(numeric, 2)` rounds half away from zero. */
export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  // Nudge with epsilon so 1.005 -> 1.01 like numeric arithmetic would.
  return (sign * Math.round((abs + Number.EPSILON) * 100)) / 100;
}

export function lineTotal(item: Pick<EstimateMathItem, 'quantity' | 'unit_price'>): number {
  const q = Number.isFinite(item.quantity) ? item.quantity : 0;
  const p = Number.isFinite(item.unit_price) ? item.unit_price : 0;
  return roundMoney(q * p);
}

export function computeTotals(input: {
  items: readonly EstimateMathItem[];
  taxRate?: number | null;
  discountAmount?: number | null;
  /** When false the persisted tax_rate becomes 0 (toggle off). */
  taxEnabled?: boolean;
}): EstimateTotals {
  const taxEnabled = input.taxEnabled ?? true;
  const taxRate = taxEnabled ? Number(input.taxRate ?? DEFAULT_TAX_RATE) || 0 : 0;
  const discountAmount = roundMoney(Number(input.discountAmount ?? 0) || 0);

  let subtotalParts = 0;
  let subtotalServices = 0;
  for (const item of input.items) {
    const lt = lineTotal(item);
    if (item.kind === 'part') subtotalParts += lt;
    else subtotalServices += lt;
  }
  subtotalParts = roundMoney(subtotalParts);
  subtotalServices = roundMoney(subtotalServices);

  const net = subtotalParts + subtotalServices - discountAmount;
  const taxAmount = roundMoney((net * taxRate) / 100);
  const total = roundMoney(net + taxAmount);

  return { subtotalParts, subtotalServices, discountAmount, taxRate, taxAmount, total };
}

export function formatMoney(value: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}
