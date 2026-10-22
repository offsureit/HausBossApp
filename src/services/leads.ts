import { api } from '~/api/client';
import type { JobRow } from '@/api/dbTypes';
import { toJobInsert, transformJob } from '@/services/adapters/jobAdapter';
import { fail, fromApi, fromApiMap, isUuid, type ServiceResult } from '@/services/types';
import type { CustomerRequest, Job, LeadStatus, ScheduleLeadInput } from '@/types';

/** Lead requests from the public form (`/requests*`, §8.8): list, schedule into a job, reject. */

export const LEAD_STATUSES: readonly LeadStatus[] = ['pending', 'scheduled', 'rejected'];

export async function listPending(): Promise<ServiceResult<CustomerRequest[]>> {
  return fromApiMap(() => api.get<CustomerRequest[]>('/requests', { query: { status: 'pending' } }), (rows) => rows ?? [], 'Failed to load requests');
}

export async function listAll(): Promise<ServiceResult<CustomerRequest[]>> {
  return fromApiMap(() => api.get<CustomerRequest[]>('/requests'), (rows) => rows ?? [], 'Failed to load requests');
}

export async function reject(leadId: string): Promise<ServiceResult<CustomerRequest>> {
  return fromApi(() => api.patch<CustomerRequest>(`/requests/${encodeURIComponent(leadId)}`, { status: 'rejected' }), 'Failed to reject request');
}

/** `POST /requests/:id/schedule` with the same job row the web builds (`jobsService.scheduleLead`). */
export async function schedule(lead: CustomerRequest, scheduling: ScheduleLeadInput, ctx: { companyId: string; userId: string }): Promise<ServiceResult<Job>> {
  if (!scheduling.scheduledDate || Number.isNaN(new Date(scheduling.scheduledDate).getTime())) return fail('Pick a valid date and time', 'validation');
  if (lead.status !== 'pending') return fail('This request has already been handled', 'workflow');
  if (!isUuid(ctx.userId)) return fail('Your session is invalid. Please sign in again.', 'auth');
  const row = toJobInsert(
    {
      clientName: lead.client_name,
      clientPhone: lead.client_phone,
      clientEmail: lead.client_email ?? '',
      clientAddress: lead.client_address,
      jobDetails: lead.job_details,
      scheduledDate: scheduling.scheduledDate,
      assignedTo: scheduling.assignedTo,
      assignedUserId: scheduling.assignedUserId ?? null,
      category: scheduling.category,
      serviceType: scheduling.serviceType,
      priority: scheduling.priority,
      notes: scheduling.notes,
      status: 'pending',
    },
    { companyId: ctx.companyId, userId: ctx.userId },
  );
  // The server answers `{ job, request }` (docs/API.md); tolerate a bare row too.
  return fromApiMap(() => api.post<{ job: JobRow; request?: CustomerRequest } | JobRow>(`/requests/${encodeURIComponent(lead.id)}/schedule`, row), (res) => transformJob('job' in res ? res.job : res), 'Could not schedule this request');
}

export const leadsService = { listPending, listAll, reject, schedule, LEAD_STATUSES };
