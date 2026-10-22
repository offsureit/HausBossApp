import { api } from '~/api/client';
import type { TablesInsert, TablesUpdate } from '@/api/dbTypes';
import { fail, fromApi, fromApiMap, ok, type ServiceResult } from '@/services/types';
import { HVAC_CATALOG } from '@/data/hvacCatalog';
import type { CatalogItem, EstimateLineItemInput, LineItemKind } from '@/types';

/** Company price book (`/catalog*`) plus the built-in HVAC list for the estimate picker. */

export async function list(options: { includeInactive?: boolean } = {}): Promise<ServiceResult<CatalogItem[]>> {
  return fromApiMap(
    () => api.get<CatalogItem[]>('/catalog', { query: { include_inactive: options.includeInactive ? 1 : undefined } }),
    (rows) => (rows ?? [])
      .filter((i) => options.includeInactive || i.is_active !== false)
      .sort((a, b) => a.kind.localeCompare(b.kind) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    'Failed to load catalog',
  );
}

export async function create(input: TablesInsert<'catalog_items'>): Promise<ServiceResult<CatalogItem>> {
  if (!input.name?.trim()) return fail('Item name is required', 'validation');
  if (input.unit_price !== undefined && (!Number.isFinite(input.unit_price) || input.unit_price < 0)) return fail('Unit price must be zero or more', 'validation');
  return fromApi(() => api.post<CatalogItem>('/catalog', { ...input, name: input.name.trim() }), 'Failed to create catalog item');
}

export async function update(id: string, patch: TablesUpdate<'catalog_items'>): Promise<ServiceResult<CatalogItem>> {
  return fromApi(() => api.patch<CatalogItem>(`/catalog/${encodeURIComponent(id)}`, patch), 'Failed to update catalog item');
}

export async function remove(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/catalog/${encodeURIComponent(id)}`), 'Failed to delete catalog item');
  return result.error ? { data: null, error: result.error } : ok({ id });
}

export interface CatalogEntry {
  id: string | null;
  kind: LineItemKind;
  name: string;
  description?: string | null;
  unit: string;
  unit_price: number;
  source: 'company' | 'builtin';
}

/** The company's active items followed by the built-in HVAC seed (web `CatalogPicker`). */
export function pickerEntries(companyItems: readonly CatalogItem[]): CatalogEntry[] {
  return [
    ...companyItems.filter((c) => c.is_active !== false).map((c): CatalogEntry => ({ id: c.id, kind: c.kind as LineItemKind, name: c.name, description: c.description, unit: c.unit ?? 'ea', unit_price: Number(c.unit_price), source: 'company' })),
    ...HVAC_CATALOG.map((h): CatalogEntry => {
      const raw = h as unknown as { kind: LineItemKind; name: string; unit?: string; unitPrice?: number; unit_price?: number };
      return { id: null, kind: raw.kind, name: raw.name, unit: raw.unit ?? 'ea', unit_price: Number(raw.unitPrice ?? raw.unit_price ?? 0), source: 'builtin' };
    }),
  ];
}

export function toLineItem(entry: CatalogEntry): EstimateLineItemInput {
  return { kind: entry.kind, name: entry.name, description: entry.description ?? null, quantity: 1, unit: entry.unit, unit_price: entry.unit_price, catalog_item_id: entry.id };
}

export const catalogService = { list, create, update, remove, pickerEntries, toLineItem };
