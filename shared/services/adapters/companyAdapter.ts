import type { CompanySubscriptionRow, ProfileRow } from '@/api/dbTypes';
import type { BusinessUnit, CompanyProfile, Division, DivisionSettings, Subscription } from '@/types';
import { fullName } from '@/utils/names';

/**
 * Pure mappers for `GET /company` and `GET /billing/subscription` (no I/O), shared by the web
 * app (`companyService.ts`) and the mobile app. There is no `companies` table: the owner's
 * `profiles` row IS the company (`company_id` = owner id). The display name prefers
 * `company_name` and falls back to the owner's name.
 */

export interface CompanyResponse {
  profile: ProfileRow | null;
  secrets?: { google_maps_api_key?: string | null } | null;
  maps?: { api_key: string | null; source: 'company' | 'platform' | null } | null;
  sms?: { number: string | null; profile_id: string | null; configured: boolean } | null;
  divisions?: DivisionRow[] | null;
  business_units?: BusinessUnitRow[] | null;
  keys_notice?: { level: 'warning' | 'error'; message: string } | null;
  subscription?: CompanySubscriptionRow | null;
  entitled?: boolean;
}

export interface BusinessUnitRow { id: string; name: string; division: string | null; service_type?: string | null; category?: string | null; duration_minutes?: number | null; sort_order?: number | null }
export interface DivisionRow { division: string; legal_name: string | null; telnyx_number: string | null; telnyx_profile_id: string | null }

export const asDivision = (d: string | null | undefined): Division | null => (d === 'commercial' || d === 'residential' ? d : null);

export const toUnit = (r: BusinessUnitRow): BusinessUnit => ({ id: r.id, name: r.name, division: asDivision(r.division), serviceType: r.service_type?.trim() || null, category: r.category?.trim() || null, durationMinutes: r.duration_minutes ?? null, sortOrder: r.sort_order ?? 0 });

export const toDivision = (r: DivisionRow): DivisionSettings | null => {
  const division = asDivision(r.division);
  return division ? { division, legalName: r.legal_name, telnyxNumber: r.telnyx_number, telnyxProfileId: r.telnyx_profile_id } : null;
};

export function companyNameFromOwner(owner: Pick<ProfileRow, 'first_name' | 'last_name' | 'company_name'> | null | undefined): string {
  if (!owner) return '';
  const explicit = (owner.company_name ?? '').trim();
  if (explicit) return explicit;
  return fullName({ firstName: owner.first_name, lastName: owner.last_name });
}

/** `GET /company` → UI model; null when the owner has not named the company yet (onboarding). */
export function toCompanyProfile(res: CompanyResponse): CompanyProfile | null {
  const owner = res.profile;
  const name = companyNameFromOwner(owner);
  if (!owner || !name) return null;
  return {
    id: owner.company_id ?? owner.id,
    name,
    companyName: owner.company_name ?? '',
    email: owner.email ?? '',
    phone: owner.phone ?? '',
    address: owner.company_address ?? '',
    industry: owner.industry ?? '',
    teamSize: owner.team_size ?? '',
    ownerId: owner.id,
    googleMapsApiKey: res.maps?.api_key ?? res.secrets?.google_maps_api_key ?? null,
    ownGoogleMapsApiKey: res.secrets?.google_maps_api_key ?? null,
    sms: { number: res.sms?.number ?? null, profileId: res.sms?.profile_id ?? null, configured: res.sms?.configured ?? !!res.sms?.number },
    divisions: (res.divisions ?? []).map(toDivision).filter((d): d is DivisionSettings => !!d),
    businessUnits: (res.business_units ?? []).map(toUnit),
    keysNotice: res.keys_notice && (res.keys_notice.level === 'error' || res.keys_notice.level === 'warning') && res.keys_notice.message ? { level: res.keys_notice.level, message: res.keys_notice.message } : null,
  };
}

// ---------------------------------------------------------------------------
// Subscription / entitlement (§18 #8)
// ---------------------------------------------------------------------------

export function entitled(status: Subscription['status'], periodEnd: string | null): boolean {
  if (status === 'lifetime') return true;
  if (status !== 'active' && status !== 'trialing' && status !== 'past_due') return false;
  if (!periodEnd) return true;
  const grace = 3 * 24 * 60 * 60 * 1000;
  return new Date(periodEnd).getTime() + grace > Date.now();
}

/** The parts of `GET /billing/subscription` the mapper reads. */
export interface SubscriptionRemote {
  subscribed?: boolean;
  entitled?: boolean;
  status?: Subscription['status'] | null;
  tier?: Subscription['tier'] | null;
  current_period_end?: string | null;
  source?: Subscription['source'] | null;
  cancel_at_period_end?: boolean | null;
  subscription_tier?: Subscription['tier'] | null;
  subscription_end?: string | null;
}

export function noSubscription(companyId: string): Subscription {
  return { companyId, status: 'none', tier: null, source: 'stripe', currentPeriodEnd: null, cancelAtPeriodEnd: false, isEntitled: false };
}

export function toSubscription(companyId: string, remote: SubscriptionRemote | null | undefined): Subscription {
  if (!remote) return noSubscription(companyId);
  const status = remote.status ?? (remote.subscribed ? 'active' : 'none');
  const periodEnd = remote.current_period_end ?? remote.subscription_end ?? null;
  return {
    companyId,
    status,
    tier: remote.tier ?? remote.subscription_tier ?? null,
    source: remote.source ?? 'stripe',
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: remote.cancel_at_period_end ?? false,
    isEntitled: typeof remote.entitled === 'boolean' ? remote.entitled : entitled(status, periodEnd),
  };
}
