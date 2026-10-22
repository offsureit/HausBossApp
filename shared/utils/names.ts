/**
 * Technician display-name helpers.
 *
 * `jobs.assigned_to` is a display-name string (PROJECT_HANDOFF §18 #10). Until
 * every writer uses `assigned_user_id`, the database and the UI match a
 * technician by three variants: "First Last", "First L." and "First"
 * (`resolve_assigned_technician()` in the schema uses the same rules).
 */

export interface NameParts {
  firstName?: string | null;
  lastName?: string | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/** "First Last" (falls back to whichever part exists). */
export function fullName(parts: NameParts): string {
  return [clean(parts.firstName), clean(parts.lastName)].filter(Boolean).join(' ');
}

/** "First L." — the compact form used on calendar chips. */
export function shortName(parts: NameParts): string {
  const first = clean(parts.firstName);
  const last = clean(parts.lastName);
  if (!last) return first;
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

/** Every variant the legacy string matcher accepts, lower-cased and de-duplicated. */
export function nameVariants(parts: NameParts): string[] {
  const variants = [fullName(parts), shortName(parts), clean(parts.firstName)]
    .map((v) => v.toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(variants));
}

/** Does an `assigned_to` string refer to this person? */
export function matchesAssignedName(assignedTo: string | null | undefined, parts: NameParts): boolean {
  const target = clean(assignedTo).toLowerCase();
  if (!target) return false;
  return nameVariants(parts).includes(target);
}

/** Split a free-text "First Last" into parts (everything after the first token is the last name). */
export function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const tokens = clean(name).split(' ').filter(Boolean);
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  return { firstName: tokens[0], lastName: tokens.slice(1).join(' ') };
}

/** Initials for avatars ("JD"). */
export function initials(parts: NameParts): string {
  const f = clean(parts.firstName).charAt(0);
  const l = clean(parts.lastName).charAt(0);
  return `${f}${l}`.toUpperCase();
}
