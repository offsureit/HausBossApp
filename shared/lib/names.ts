/** "Mr. John Smith" from the parts that are filled in. */
export function personName(...parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
}

/**
 * Display name for a customer or billing contact that can be a company, a person, or both:
 * "Acme Corp (John Smith)", "Acme Corp" or "John Smith".
 */
export function contactName(company: string | null | undefined, person: string | null | undefined): string {
  const c = (company ?? '').trim();
  const p = (person ?? '').trim();
  return c && p ? `${c} (${p})` : c || p;
}
