import { api } from '~/api/client';
import { toCompanyProfile, toSubscription, type CompanyResponse, type SubscriptionRemote } from '@/services/adapters/companyAdapter';
import { fromApi, ok, type ServiceResult } from '@/services/types';
import type { CompanyProfile, Subscription } from '@/types';

/** Company / tenant (`GET /company`, `GET /billing/subscription`); the mapping is shared with the web app. */

export async function getCompany(): Promise<ServiceResult<CompanyProfile | null>> {
  const result = await fromApi(() => api.get<CompanyResponse>('/company'), 'Could not load your company');
  if (result.error) {
    const status = (result.error.cause as { status?: number } | undefined)?.status;
    if (status === 404) return ok(null); // no company yet → onboarding (done on the web)
    return { data: null, error: result.error };
  }
  return ok(result.data ? toCompanyProfile(result.data) : null);
}

export async function getSubscription(companyId: string): Promise<ServiceResult<Subscription>> {
  const remote = await fromApi(() => api.get<SubscriptionRemote>('/billing/subscription'), 'Could not check subscription');
  return ok(toSubscription(companyId, remote.error ? null : remote.data));
}

export const companyService = { getCompany, getSubscription };
