import { api } from '~/api/client';
import type { JobRow, TablesInsert, TablesUpdate } from '@/api/dbTypes';
import { normalizePhoneE164 } from '@/utils/phone';
import { transformJob } from '@/services/adapters/jobAdapter';
import { fail, fromApi, fromApiMap, ok, type ServiceResult } from '@/services/types';
import type { Customer, CustomerEquipment, Job, ServiceAgreement } from '@/types';

/** Customers CRM (`/customers*`, docs/API.md). No pagination — whole company list (§13). */

export async function list(options: { includeInactive?: boolean } = {}): Promise<ServiceResult<Customer[]>> {
  return fromApiMap(
    () => api.get<Customer[]>('/customers', { query: { include_inactive: options.includeInactive ? 1 : undefined } }),
    (rows) => (rows ?? []).filter((c) => options.includeInactive || c.is_active !== false).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    'Failed to load customers',
  );
}

export async function get(customerId: string): Promise<ServiceResult<Customer>> {
  return fromApi(() => api.get<Customer>(`/customers/${encodeURIComponent(customerId)}`), 'Customer not found');
}

export async function create(input: TablesInsert<'customers'>): Promise<ServiceResult<Customer>> {
  const name = (input.name ?? '').trim() || [input.first_name, input.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
  if (!name) return fail('Customer name is required', 'validation');
  return fromApi(() => api.post<Customer>('/customers', { ...input, name, preferred_contact: input.preferred_contact ?? 'phone' }), 'Failed to create customer');
}

export async function update(customerId: string, patch: TablesUpdate<'customers'>): Promise<ServiceResult<Customer>> {
  if (patch.name !== undefined && !patch.name?.trim()) return fail('Customer name is required', 'validation');
  return fromApi(() => api.patch<Customer>(`/customers/${encodeURIComponent(customerId)}`, patch), 'Failed to update customer');
}

export async function remove(customerId: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/customers/${encodeURIComponent(customerId)}`), 'Failed to delete customer');
  return result.error ? { data: null, error: result.error } : ok({ id: customerId });
}

/** Job history for the customer detail screen. */
export async function listCustomerJobs(customerId: string): Promise<ServiceResult<Job[]>> {
  return fromApiMap(() => api.get<JobRow[]>(`/customers/${encodeURIComponent(customerId)}/jobs`), (rows) => (rows ?? []).map(transformJob), 'Failed to load job history');
}

/** Case-insensitive match over the fields people search by. */
export function matchesCustomer(c: Customer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.name, c.company_name, c.phone, c.phone2, c.email, c.address].some((f) => (f ?? '').toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// Sub-records (equipment, service agreements) — admin/manager writes
// ---------------------------------------------------------------------------

export async function listEquipment(customerId: string): Promise<ServiceResult<CustomerEquipment[]>> {
  return fromApiMap(() => api.get<CustomerEquipment[]>(`/customers/${encodeURIComponent(customerId)}/equipment`), (rows) => rows ?? [], 'Failed to load equipment');
}

export async function addEquipment(input: TablesInsert<'customer_equipment'>): Promise<ServiceResult<CustomerEquipment>> {
  if (!input.equipment_type?.trim()) return fail('Equipment type is required', 'validation');
  if (!input.customer_id) return fail('Customer is required', 'validation');
  return fromApi(() => api.post<CustomerEquipment>(`/customers/${encodeURIComponent(input.customer_id)}/equipment`, input), 'Failed to add equipment');
}

export async function deleteEquipment(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/equipment/${encodeURIComponent(id)}`), 'Failed to delete equipment');
  return result.error ? { data: null, error: result.error } : ok({ id });
}

export async function listAgreements(customerId: string): Promise<ServiceResult<ServiceAgreement[]>> {
  return fromApiMap(() => api.get<ServiceAgreement[]>(`/customers/${encodeURIComponent(customerId)}/agreements`), (rows) => rows ?? [], 'Failed to load service agreements');
}

export async function addAgreement(input: TablesInsert<'service_agreements'>): Promise<ServiceResult<ServiceAgreement>> {
  if (!input.plan_name?.trim()) return fail('Plan name is required', 'validation');
  if (!Number.isInteger(input.visits_per_year) || input.visits_per_year < 0) return fail('Visits per year must be a whole number', 'validation');
  if (!Number.isFinite(input.price) || input.price < 0) return fail('Price must be zero or more', 'validation');
  if (input.end_date && input.end_date < input.start_date) return fail('End date cannot be before the start date', 'validation');
  if (!input.customer_id) return fail('Customer is required', 'validation');
  return fromApi(() => api.post<ServiceAgreement>(`/customers/${encodeURIComponent(input.customer_id)}/agreements`, input), 'Failed to add service agreement');
}

export async function updateAgreement(id: string, patch: TablesUpdate<'service_agreements'>): Promise<ServiceResult<ServiceAgreement>> {
  return fromApi(() => api.patch<ServiceAgreement>(`/agreements/${encodeURIComponent(id)}`, patch), 'Failed to update service agreement');
}

export async function deleteAgreement(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/agreements/${encodeURIComponent(id)}`), 'Failed to delete service agreement');
  return result.error ? { data: null, error: result.error } : ok({ id });
}

/** The number a text would go to (stored E.164, else derived from the phone field). */
export function textableNumber(c: Pick<Customer, 'phone' | 'phone_e164'>): string | null {
  return c.phone_e164 ?? normalizePhoneE164(c.phone);
}

export const customersService = { list, get, create, update, remove, listCustomerJobs, matchesCustomer, listEquipment, addEquipment, deleteEquipment, listAgreements, addAgreement, updateAgreement, deleteAgreement, textableNumber };
