import { api } from '~/api/client';
import type { TablesInsert, TablesUpdate } from '@/api/dbTypes';
import { fail, fromApi, fromApiMap, ok, type ServiceResult } from '@/services/types';
import type { InventoryItem } from '@/types';

/** Truck-stock inventory (`/inventory*`): parts carried per technician, `technician_id` null = warehouse. */

export async function list(): Promise<ServiceResult<InventoryItem[]>> {
  return fromApiMap(() => api.get<InventoryItem[]>('/inventory'), (rows) => (rows ?? []).sort((a, b) => a.name.localeCompare(b.name)), 'Failed to load inventory');
}

export async function create(input: TablesInsert<'inventory_items'>): Promise<ServiceResult<InventoryItem>> {
  if (!input.name?.trim()) return fail('Item name is required', 'validation');
  if (input.quantity !== undefined && input.quantity < 0) return fail('Quantity cannot be negative', 'validation');
  return fromApi(() => api.post<InventoryItem>('/inventory', { ...input, name: input.name.trim() }), 'Failed to create inventory item');
}

export async function update(id: string, patch: TablesUpdate<'inventory_items'>): Promise<ServiceResult<InventoryItem>> {
  if (patch.quantity !== undefined && patch.quantity !== null && patch.quantity < 0) return fail('Quantity cannot be negative', 'validation');
  return fromApi(() => api.patch<InventoryItem>(`/inventory/${encodeURIComponent(id)}`, patch), 'Failed to update inventory item');
}

export async function remove(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/inventory/${encodeURIComponent(id)}`), 'Failed to delete inventory item');
  return result.error ? { data: null, error: result.error } : ok({ id });
}

export function isBelowMinimum(item: Pick<InventoryItem, 'quantity' | 'min_quantity'>): boolean {
  return item.quantity < item.min_quantity;
}

export const inventoryService = { list, create, update, remove, isBelowMinimum };
