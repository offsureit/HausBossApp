import { api, apiFetch } from '~/api/client';
import { clearSession, getSession, setSession, type Session, type SessionUser } from '~/api/session';
import { disconnect as disconnectRealtime } from '~/api/realtime';
import { fail, fromApi, ok, type ServiceResult } from '@/services/types';
import type { AppRole, Profile, UserProfileBundle } from '@/types';

/**
 * Authentication against the HausBoss API (`/auth/*`, docs/API.md) — the mobile
 * counterpart of the web `authService` with the same `{ data, error }` results.
 */

export type User = SessionUser;

export const ROLES: readonly AppRole[] = ['admin', 'manager', 'contractor', 'superadmin'];
export const DEFAULT_ROLES: AppRole[] = ['contractor'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInInput {
  email: string;
  password: string;
}

export async function signIn(input: SignInInput): Promise<ServiceResult<Session>> {
  if (!EMAIL_RE.test(input.email.trim())) return fail('Enter a valid email address', 'validation');
  if (!input.password) return fail('Password is required', 'validation');
  const result = await fromApi(() => api.post<Session>('/auth/signin', { email: input.email.trim(), password: input.password }, { auth: false }), 'Sign in failed');
  if (result.error || !result.data) return { data: null, error: result.error ?? { message: 'Sign in failed' } };
  setSession(result.data, 'SIGNED_IN');
  return ok(result.data);
}

/** Best effort: the local session is cleared regardless of the server answer. */
export async function signOut(): Promise<ServiceResult<true>> {
  const session = getSession();
  if (session) await fromApi(() => api.post<void>('/auth/signout', { refresh_token: session.refresh_token }, { timeoutMs: 8_000 }));
  disconnectRealtime();
  clearSession('SIGNED_OUT');
  return ok(true);
}

export async function resetPassword(email: string): Promise<ServiceResult<true>> {
  if (!EMAIL_RE.test(email.trim())) return fail('Enter a valid email address', 'validation');
  const result = await fromApi(() => api.post<{ sent: boolean }>('/auth/recover', { email: email.trim() }, { auth: false }), 'Could not send the reset email');
  return result.error ? { data: null, error: result.error } : ok(true);
}

/** Same answer for every address (no account discovery). */
export async function resendConfirmation(email: string): Promise<ServiceResult<true>> {
  if (!EMAIL_RE.test(email.trim())) return fail('Enter a valid email address', 'validation');
  const result = await fromApi(() => api.post<{ sent: boolean }>('/auth/resend-confirmation', { email: email.trim() }, { auth: false }), 'Could not send the email');
  return result.error ? { data: null, error: result.error } : ok(true);
}

/** One-time link token (invite / recovery email) → session (`POST /auth/exchange`). */
export async function exchangeToken(token: string, type: 'invite' | 'recovery' | 'signup'): Promise<ServiceResult<Session>> {
  if (!token.trim()) return fail('This link is missing its token', 'validation');
  const result = await fromApi(() => api.post<Session>('/auth/exchange', { token: token.trim(), type }, { auth: false }), 'This link is invalid or has expired');
  if (result.error || !result.data) return { data: null, error: result.error ?? { message: 'This link is invalid or has expired' } };
  setSession(result.data, type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN');
  return ok(result.data);
}

/** `POST /auth/password`; `currentPassword` is only needed outside an invite / recovery session. */
export async function updatePassword(password: string, confirm?: string, currentPassword?: string): Promise<ServiceResult<true>> {
  if (password.length < 8) return fail('Password must be at least 8 characters', 'validation');
  if (confirm !== undefined && confirm !== password) return fail('Passwords do not match', 'validation');
  const result = await fromApi(() => api.post<void>('/auth/password', { password, ...(currentPassword ? { current_password: currentPassword } : {}) }), 'Could not set the password');
  return result.error ? { data: null, error: result.error } : ok(true);
}

interface MeResponse {
  user: User;
  companyId: string | null;
  roles: AppRole[];
}

function unwrapProfile(payload: unknown): Profile | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { profile?: unknown; id?: unknown };
  if (typeof p.id === 'string') return payload as Profile;
  if (p.profile && typeof p.profile === 'object' && typeof (p.profile as { id?: unknown }).id === 'string') return p.profile as Profile;
  return null;
}

/** `GET /profile` + `GET /auth/me` → profile row + roles (roles are read server-side). */
export async function fetchUserProfile(): Promise<ServiceResult<UserProfileBundle>> {
  const [profileRes, meRes] = await Promise.all([
    fromApi(() => apiFetch<unknown>('/profile'), 'Could not load your profile'),
    fromApi(() => api.get<MeResponse>('/auth/me'), 'Could not load your account'),
  ]);
  if (profileRes.error) {
    const status = (profileRes.error.cause as { status?: number } | undefined)?.status;
    if (status === 404) return fail('Your profile could not be found. Please sign out and sign in again.', 'profile_missing');
    return { data: null, error: { ...profileRes.error, code: profileRes.error.code ?? 'profile' } };
  }
  const profile = unwrapProfile(profileRes.data);
  if (!profile) return fail('Your profile could not be found. Please sign out and sign in again.', 'profile_missing');
  const roles = (meRes.data?.roles ?? []).filter((r): r is AppRole => ROLES.includes(r));
  return ok({ profile, roles: roles.length > 0 ? roles : [...DEFAULT_ROLES] });
}

export function hasRole(roles: readonly AppRole[] | null | undefined, role: AppRole): boolean {
  return !!roles && roles.includes(role);
}

export function isStaff(roles: readonly AppRole[] | null | undefined): boolean {
  return hasRole(roles, 'admin') || hasRole(roles, 'manager') || hasRole(roles, 'superadmin');
}

export function isContractor(roles: readonly AppRole[] | null | undefined): boolean {
  return hasRole(roles, 'contractor') && !isStaff(roles);
}

export const authService = { signIn, signOut, resetPassword, resendConfirmation, exchangeToken, updatePassword, fetchUserProfile, hasRole, isStaff, isContractor };
