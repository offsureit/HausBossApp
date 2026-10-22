import { deriveRoleFlags, homeTabFor, tabsFor } from '../roles';
import type { AppRole } from '@/types';

/** Role matrix (brief "Roles"): who is staff, who is a technician, which tabs each one gets. */
describe('role matrix', () => {
  const cases: { roles: AppRole[]; isStaff: boolean; isContractor: boolean; isAdmin: boolean; tabs: string[]; home: string }[] = [
    { roles: ['admin'], isStaff: true, isContractor: false, isAdmin: true, tabs: ['calendar', 'dashboard', 'chat', 'messages', 'more'], home: 'calendar' },
    { roles: ['superadmin'], isStaff: true, isContractor: false, isAdmin: true, tabs: ['calendar', 'dashboard', 'chat', 'messages', 'more'], home: 'calendar' },
    { roles: ['manager'], isStaff: true, isContractor: false, isAdmin: false, tabs: ['calendar', 'dashboard', 'chat', 'messages', 'more'], home: 'calendar' },
    { roles: ['contractor'], isStaff: false, isContractor: true, isAdmin: false, tabs: ['today', 'calendar', 'chat', 'messages', 'more'], home: 'today' },
    // Mixed: a manager who is also on the roster as a contractor is staff.
    { roles: ['contractor', 'manager'], isStaff: true, isContractor: false, isAdmin: false, tabs: ['calendar', 'dashboard', 'chat', 'messages', 'more'], home: 'calendar' },
    { roles: ['admin', 'contractor'], isStaff: true, isContractor: false, isAdmin: true, tabs: ['calendar', 'dashboard', 'chat', 'messages', 'more'], home: 'calendar' },
    // No role yet (profile not loaded / not provisioned): nothing role-specific, Calendar home.
    { roles: [], isStaff: false, isContractor: false, isAdmin: false, tabs: ['calendar', 'chat', 'messages', 'more'], home: 'calendar' },
  ];

  it.each(cases)('$roles → staff=$isStaff contractor=$isContractor admin=$isAdmin', ({ roles, isStaff, isContractor, isAdmin, tabs, home }) => {
    const flags = deriveRoleFlags(roles);
    expect(flags).toEqual({ isStaff, isContractor, isAdmin });
    expect(tabsFor(flags)).toEqual(tabs);
    expect(homeTabFor(flags)).toBe(home);
  });

  it('never shows Today and Dashboard together', () => {
    const all: AppRole[][] = [['admin'], ['manager'], ['contractor'], ['superadmin'], ['contractor', 'admin'], []];
    for (const roles of all) {
      const tabs = tabsFor(deriveRoleFlags(roles));
      expect(tabs.includes('today') && tabs.includes('dashboard')).toBe(false);
    }
  });
});
