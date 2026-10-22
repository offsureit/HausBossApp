import type { ProfileRow } from '@/api/dbTypes';
import type { AppRole, Employee } from '@/types';
import { getContractorColor } from '@/utils/contractorColors';
import { fullName } from '@/utils/names';

/**
 * Pure mapper from a `profiles` row (+ roles) to the UI's `Employee`, shared by the web app
 * (`teamService.ts`) and the mobile app. `contractor` is displayed as "technician" (§7).
 */

const ROLE_PRIORITY: Record<AppRole, number> = { superadmin: 0, admin: 1, manager: 2, contractor: 3 };

export function primaryRole(roles: readonly AppRole[]): AppRole {
  if (roles.length === 0) return 'contractor';
  return [...roles].sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b])[0];
}

export function displayRole(role: AppRole): Employee['displayRole'] {
  return role === 'contractor' ? 'technician' : role;
}

export function toEmployee(profile: ProfileRow, roles: readonly AppRole[]): Employee {
  const role = primaryRole(roles.length > 0 ? roles : [(profile.role as AppRole) || 'contractor']);
  const name = fullName({ firstName: profile.first_name, lastName: profile.last_name }) || profile.email;
  return {
    id: profile.id,
    name,
    firstName: profile.first_name ?? '',
    lastName: profile.last_name ?? '',
    email: profile.email,
    phone: profile.phone ?? '',
    role,
    displayRole: displayRole(role),
    color: getContractorColor(name, profile.color),
    isActive: profile.is_active,
    photoUrl: profile.photo_url ?? '',
    skills: profile.skills ?? [],
    tools: profile.tools ?? [],
    jobRole: profile.job_role ?? '',
    companyPosition: profile.company_position ?? '',
    companyId: profile.company_id,
  };
}
