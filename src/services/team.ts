import { api } from '~/api/client';
import type { ProfileRow, TablesUpdate } from '@/api/dbTypes';
import { toEmployee } from '@/services/adapters/employeeAdapter';
import { fail, fromApi, fromApiMap, ok, type ServiceError, type ServiceResult } from '@/services/types';
import type { AppRole, Employee } from '@/types';

const ROLES: readonly AppRole[] = ['admin', 'manager', 'contractor', 'superadmin'];
type TeamRow = ProfileRow & { roles?: string[] };

/** `GET /team` → roster (`Employee[]`), mapped by the shared `toEmployee`. */
export async function listTeam(options: { includeInactive?: boolean } = {}): Promise<ServiceResult<Employee[]>> {
  return fromApiMap(
    () => api.get<TeamRow[]>('/team', { query: { include_inactive: options.includeInactive ? 1 : undefined } }),
    (rows) => (rows ?? [])
      .filter((p) => options.includeInactive || p.is_active !== false)
      .map((p) => toEmployee(p, (p.roles ?? []).filter((r): r is AppRole => ROLES.includes(r as AppRole))))
      .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    'Failed to load the team',
  );
}

export interface InviteInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: AppRole;
  /** The admin accepted the extra-user charge (after a seat_charge_required answer). */
  confirmCharge?: boolean;
}

/** What to ask the admin when adding a user goes past the plan's users (see `/billing/seats`). */
export type SeatPrompt = { kind: 'confirm'; message: string } | { kind: 'checkout'; message: string; url: string } | { kind: 'plan'; message: string };

export function seatPrompt(error: ServiceError | null | undefined): SeatPrompt | null {
  if (!error) return null;
  const body = (error.cause as { body?: { url?: unknown } } | undefined)?.body;
  if (error.code === 'seat_charge_required') return { kind: 'confirm', message: error.message };
  if (error.code === 'seat_checkout_required' && typeof body?.url === 'string') return { kind: 'checkout', message: error.message, url: body.url };
  if (error.code === 'plan_required') return { kind: 'plan', message: error.message };
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `POST /team/invite` (admin/manager). The invite email links to the web app's accept-invite page. */
export async function invite(input: InviteInput): Promise<ServiceResult<{ success: boolean; userId?: string }>> {
  if (!EMAIL_RE.test(input.email.trim())) return fail('Enter a valid email address', 'validation');
  if (!input.firstName.trim()) return fail('First name is required', 'validation');
  if (!['admin', 'manager', 'contractor'].includes(input.role)) return fail('Choose admin, manager or technician', 'validation');
  const result = await fromApi(
    () => api.post<{ success?: boolean; userId?: string }>('/team/invite', {
      email: input.email.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
      ...(input.confirmCharge ? { confirmCharge: true } : {}),
    }),
    'Could not send the invitation',
  );
  return result.error ? { data: null, error: result.error } : ok({ success: result.data?.success ?? true, userId: result.data?.userId });
}

/** Replace the user's role set with a single role (admin). */
export async function setRole(userId: string, role: AppRole): Promise<ServiceResult<{ userId: string; role: AppRole }>> {
  if (role === 'superadmin') return fail('Superadmin cannot be granted from the app', 'forbidden');
  const result = await fromApi(() => api.post<unknown>(`/team/${encodeURIComponent(userId)}/role`, { role }), 'Could not change the role');
  return result.error ? { data: null, error: result.error } : ok({ userId, role });
}

export async function updateProfile(userId: string, patch: TablesUpdate<'profiles'>): Promise<ServiceResult<ProfileRow>> {
  const safe: TablesUpdate<'profiles'> = { ...patch };
  delete safe.id;
  delete safe.company_id;
  delete safe.role;
  return fromApi(() => api.patch<ProfileRow>(`/team/${encodeURIComponent(userId)}`, safe), 'Failed to update profile');
}

export async function setActive(userId: string, active: boolean, confirmCharge = false): Promise<ServiceResult<ProfileRow>> {
  return fromApi(
    () => api.post<ProfileRow>(`/team/${encodeURIComponent(userId)}/${active ? 'reactivate' : 'deactivate'}`, active && confirmCharge ? { confirmCharge: true } : undefined),
    active ? 'Could not reactivate the user' : 'Could not deactivate the user',
  );
}

export const teamService = { listTeam, invite, setRole, updateProfile, setActive, seatPrompt };
