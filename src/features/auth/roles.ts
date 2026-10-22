import type { AppRole } from '@/types';

/**
 * Role gating in one place (brief "Roles"): the owner / admin and managers are *staff*
 * (dispatcher screens), technicians / contractors see the field screens. A user with both a
 * staff role and `contractor` is staff. `superadmin` counts as admin.
 */
export interface RoleFlags {
  isStaff: boolean;
  isContractor: boolean;
  isAdmin: boolean;
}

export const STAFF_ROLES: readonly AppRole[] = ['admin', 'manager', 'superadmin'];
export const ADMIN_ROLES: readonly AppRole[] = ['admin', 'superadmin'];

export function deriveRoleFlags(roles: readonly AppRole[]): RoleFlags {
  const has = (r: AppRole) => roles.includes(r);
  const isStaff = STAFF_ROLES.some(has);
  return { isStaff, isContractor: has('contractor') && !isStaff, isAdmin: ADMIN_ROLES.some(has) };
}

export type AppTab = 'today' | 'calendar' | 'dashboard' | 'chat' | 'messages' | 'more';

/** Bottom tabs by role — staff: Calendar · Dashboard · Chat · Messages · More; technician: Today · Calendar · Chat · Messages · More. */
export function tabsFor(flags: Pick<RoleFlags, 'isStaff' | 'isContractor'>): AppTab[] {
  const tabs: AppTab[] = [];
  if (flags.isContractor) tabs.push('today');
  tabs.push('calendar');
  if (flags.isStaff) tabs.push('dashboard');
  tabs.push('chat', 'messages', 'more');
  return tabs;
}

/** Where a signed-in user lands after the splash / login. */
export function homeTabFor(flags: Pick<RoleFlags, 'isStaff' | 'isContractor'>): AppTab {
  return flags.isContractor ? 'today' : 'calendar';
}
