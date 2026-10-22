import { api } from '~/api/client';
import { subscribe as subscribeChannel } from '~/api/realtime';
import { fail, fromApi, fromApiMap, ok, type ServiceResult } from '@/services/types';
import { API_URL } from '~/lib/env';
import { DEFAULT_TAX_RATE, computeTotals } from '@/utils/estimateMath';
import type { Estimate, EstimateLineItem, EstimateSaveInput, EstimateStatus, RealtimeChange, Unsubscribe } from '@/types';

/**
 * Estimates (`/estimates*`, docs/API.md; §8.6). Totals and numbering come from the database;
 * workflow gates are enforced server-side and mirrored here for friendlier errors.
 * Save (header + full line-item replace), the status actions and the public link, like the web `estimatesService`.
 */

export const ESTIMATE_STATUSES: readonly EstimateStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'declined', 'void'];
export const READ_ONLY_STATUSES: readonly EstimateStatus[] = ['sent', 'accepted', 'declined', 'void'];

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', rejected: 'Rejected', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', void: 'Void',
};

export const isReadOnly = (status: EstimateStatus) => READ_ONLY_STATUSES.includes(status);
export const canSubmit = (status: EstimateStatus) => status === 'draft' || status === 'rejected';
export const canApprove = (status: EstimateStatus, isStaff: boolean) => isStaff && (status === 'draft' || status === 'pending_approval' || status === 'rejected');
export const canReject = (status: EstimateStatus, isStaff: boolean) => isStaff && ['draft', 'pending_approval', 'approved'].includes(status);
export const canSend = (estimate: Pick<Estimate, 'status' | 'client_email'>, isStaff: boolean) => isStaff && estimate.status === 'approved' && !!estimate.client_email?.trim();
export const canVoid = (status: EstimateStatus, isStaff: boolean) => isStaff && status !== 'accepted' && status !== 'void';

type EstimateWithItems = Estimate & { line_items?: EstimateLineItem[] };

/** `GET /public/estimates/:token` — the customer-facing estimate (sent / accepted / declined only). */
export type PublicEstimate = Estimate & { line_items: EstimateLineItem[]; company: { name: string | null; email: string | null; phone: string | null; address: string | null } | null };

export async function getPublic(token: string): Promise<ServiceResult<PublicEstimate>> {
  return fromApi(() => api.get<PublicEstimate>(`/public/estimates/${encodeURIComponent(token)}`, { auth: false }), 'This estimate link is invalid or no longer available');
}

export async function respondPublic(token: string, action: 'accept' | 'decline'): Promise<ServiceResult<{ status: 'accepted' | 'declined' }>> {
  return fromApi(() => api.post<{ success: true; status: 'accepted' | 'declined' }>(`/public/estimates/${encodeURIComponent(token)}/respond`, { action }, { auth: false }), `Could not ${action} the estimate`);
}

export async function listByJob(jobId: string): Promise<ServiceResult<Estimate[]>> {
  return fromApiMap(() => api.get<Estimate[]>(`/jobs/${encodeURIComponent(jobId)}/estimates`), (rows) => rows ?? [], 'Failed to load estimates');
}

export async function get(estimateId: string): Promise<ServiceResult<EstimateWithItems>> {
  return fromApi(() => api.get<EstimateWithItems>(`/estimates/${encodeURIComponent(estimateId)}`), 'Estimate not found');
}

export async function listLineItems(estimateId: string): Promise<ServiceResult<EstimateLineItem[]>> {
  return fromApiMap(
    () => api.get<EstimateWithItems>(`/estimates/${encodeURIComponent(estimateId)}`),
    (est) => [...(est?.line_items ?? [])].sort((a, b) => a.kind.localeCompare(b.kind) || (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    'Failed to load line items',
  );
}

async function transition(estimateId: string, action: 'submit' | 'approve' | 'reject' | 'void' | 'reopen', body: Record<string, unknown> = {}): Promise<ServiceResult<Estimate>> {
  return fromApi(() => api.post<Estimate>(`/estimates/${encodeURIComponent(estimateId)}/${action}`, body), `Could not ${action} the estimate`);
}

export async function submitForApproval(estimate: Pick<Estimate, 'id' | 'status'>): Promise<ServiceResult<Estimate>> {
  if (!canSubmit(estimate.status)) return fail('Only draft or rejected estimates can be submitted for approval', 'workflow');
  return transition(estimate.id, 'submit');
}

export async function approve(estimate: Pick<Estimate, 'id' | 'status'>): Promise<ServiceResult<Estimate>> {
  if (!canApprove(estimate.status, true)) return fail(`Estimate cannot be approved from status ${estimate.status}`, 'workflow');
  return transition(estimate.id, 'approve');
}

export async function reject(estimate: Pick<Estimate, 'id' | 'status'>, reason?: string): Promise<ServiceResult<Estimate>> {
  if (!canReject(estimate.status, true)) return fail(`Estimate cannot be rejected from status ${estimate.status}`, 'workflow');
  return transition(estimate.id, 'reject', { reason: reason?.trim() || null });
}

export async function voidEstimate(estimate: Pick<Estimate, 'id' | 'status'>): Promise<ServiceResult<Estimate>> {
  if (estimate.status === 'accepted') return fail('An accepted estimate cannot be voided', 'workflow');
  if (estimate.status === 'void') return ok(estimate as Estimate);
  return transition(estimate.id, 'void');
}

export async function reopen(estimate: Pick<Estimate, 'id' | 'status'>): Promise<ServiceResult<Estimate>> {
  return transition(estimate.id, 'reopen');
}

/** Admin/manager: email the approved estimate; the server flips status to `sent`. */
export async function sendToClient(estimate: Pick<Estimate, 'id' | 'status' | 'client_email'>): Promise<ServiceResult<{ success: boolean }>> {
  if (estimate.status !== 'approved') return fail('Only approved estimates can be sent', 'workflow');
  if (!estimate.client_email?.trim()) return fail('Add a client email before sending', 'validation');
  const result = await fromApi(() => api.post<{ success?: boolean }>(`/estimates/${encodeURIComponent(estimate.id)}/send`), 'Could not send the estimate');
  return result.error ? { data: null, error: result.error } : ok({ success: result.data?.success ?? true });
}

export function validateEstimate(input: EstimateSaveInput): string | null {
  if (!input.title?.trim()) return 'Estimate title is required';
  if (!input.job_id) return 'Estimate must belong to a job';
  if (input.items.length === 0) return 'Add at least one part or service';
  for (const item of input.items) {
    if (!item.name?.trim()) return 'Every line item needs a name';
    if (item.kind !== 'part' && item.kind !== 'service') return 'Line item kind must be part or service';
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) return `Quantity for "${item.name}" must be greater than zero`;
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) return `Unit price for "${item.name}" cannot be negative`;
  }
  if (input.discount_amount !== undefined && (!Number.isFinite(input.discount_amount) || input.discount_amount < 0)) return 'Discount cannot be negative';
  if (input.tax_rate !== undefined && (!Number.isFinite(input.tax_rate) || input.tax_rate < 0 || input.tax_rate > 100)) return 'Tax rate must be between 0 and 100';
  return null;
}

/** Insert or update the header with the full line-item list (the server replaces items atomically). */
export async function saveEstimate(input: EstimateSaveInput): Promise<ServiceResult<EstimateWithItems>> {
  const problem = validateEstimate(input);
  if (problem) return fail(problem, 'validation');
  const preview = computeTotals({ items: input.items, taxRate: input.tax_rate ?? DEFAULT_TAX_RATE, discountAmount: input.discount_amount ?? 0 });
  const line_items = input.items.map((item, index) => ({
    kind: item.kind,
    name: item.name.trim(),
    description: item.description ?? null,
    quantity: item.quantity,
    unit: item.unit ?? null,
    unit_price: item.unit_price,
    sort_order: item.sort_order ?? index,
    catalog_item_id: item.catalog_item_id ?? null,
  }));
  const header = {
    title: input.title.trim(),
    description: input.description ?? null,
    client_name: input.client_name ?? null,
    client_email: input.client_email ?? null,
    client_phone: input.client_phone ?? null,
    client_address: input.client_address ?? null,
    discount_amount: preview.discountAmount,
    tax_rate: preview.taxRate,
    notes: input.notes ?? null,
    valid_until: input.valid_until ?? null,
  };
  return input.id
    ? fromApi(() => api.patch<EstimateWithItems>(`/estimates/${encodeURIComponent(input.id as string)}`, { ...header, line_items }), 'Could not save the estimate')
    : fromApi(() => api.post<EstimateWithItems>('/estimates', { ...header, job_id: input.job_id, company_id: input.company_id, status: input.status ?? 'draft', line_items }), 'Could not save the estimate');
}

/** Admin only. */
export async function remove(estimateId: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.delete<unknown>(`/estimates/${encodeURIComponent(estimateId)}`), 'Failed to delete estimate');
  return result.error ? { data: null, error: result.error } : ok({ id: estimateId });
}

/** The client-facing page served by the web app (same origin as the API in production). */
export function publicLink(estimate: Pick<Estimate, 'public_token'>): string | null {
  return estimate.public_token ? `${API_URL}/estimate/${estimate.public_token}` : null;
}

/** Channel `estimates-<jobId>`. */
export function subscribeToJobEstimates(jobId: string, onChange: (change: RealtimeChange<Estimate>) => void): Unsubscribe {
  return subscribeChannel<Estimate>(`estimates-${jobId}`, onChange);
}

export const estimatesService = { listByJob, get, getPublic, respondPublic, listLineItems, validateEstimate, saveEstimate, remove, publicLink, submitForApproval, approve, reject, voidEstimate, reopen, sendToClient, subscribeToJobEstimates, isReadOnly, canSubmit, canApprove, canReject, canSend, canVoid, ESTIMATE_STATUSES, ESTIMATE_STATUS_LABELS };
