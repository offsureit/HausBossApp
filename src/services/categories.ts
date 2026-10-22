import { api } from '~/api/client';
import { fail, fromApi, fromApiMap, ok, type ServiceResult } from '@/services/types';
import type { JobCategory } from '@/types';

/** Company-defined job categories (`/categories*`): list / add / rename / reorder / toggle / delete. */

export async function list(options: { includeInactive?: boolean } = {}): Promise<ServiceResult<JobCategory[]>> {
  return fromApiMap(
    () => api.get<JobCategory[]>('/categories', { query: { include_inactive: options.includeInactive ? 1 : undefined } }),
    (rows) => (rows ?? []).filter((c) => options.includeInactive || c.is_active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label)),
    'Failed to load categories',
  );
}

function duplicateMessage<T>(result: ServiceResult<T>, label: string): ServiceResult<T> {
  const status = (result.error?.cause as { status?: number } | undefined)?.status;
  if (result.error && (status === 409 || result.error.code === '23505')) return fail(`A category named "${label}" already exists`, 'duplicate', result.error.cause);
  return result;
}

export async function create(label: string, sortOrder = 0): Promise<ServiceResult<JobCategory>> {
  const clean = label.trim();
  if (!clean) return fail('Category name is required', 'validation');
  const result = await fromApi(() => api.post<JobCategory>('/categories', { label: clean, sort_order: sortOrder }), 'Failed to create category');
  return duplicateMessage(result, clean);
}

export async function update(id: string, patch: { label?: string; sort_order?: number; is_active?: boolean }): Promise<ServiceResult<JobCategory>> {
  const next = { ...patch, ...(patch.label !== undefined ? { label: patch.label.trim() } : {}) };
  if (next.label !== undefined && !next.label) return fail('Category name is required', 'validation');
  const result = await fromApi(() => api.patch<JobCategory>(`/categories/${encodeURIComponent(id)}`, next), 'Failed to update category');
  return duplicateMessage(result, next.label ?? '');
}

export async function reorder(ids: readonly string[]): Promise<ServiceResult<{ updated: number }>> {
  const result = await fromApi(() => api.post<unknown>('/categories/reorder', { ids: [...ids] }), 'Failed to reorder categories');
  return result.error ? { data: null, error: result.error } : ok({ updated: ids.length });
}

export async function remove(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/categories/${encodeURIComponent(id)}`), 'Failed to delete category');
  return result.error ? { data: null, error: result.error } : ok({ id });
}

export const categoriesService = { list, create, update, reorder, remove };
