import type { Customer, Job } from '@/types';

/** Global search over already-loaded jobs + customers (shared by the web header and the mobile Search screen). */

export const SEARCH_RESULT_LIMIT = 8;

export interface SearchResults { jobs: Job[]; customers: Customer[] }

/** In-memory search over already-loaded jobs + customers, capped at `limit` per group (§2, §13). */
export function searchInMemory(query: string, jobs: readonly Job[], customers: readonly Customer[], limit = SEARCH_RESULT_LIMIT): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { jobs: [], customers: [] };
  const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => (f ?? '').toLowerCase().includes(q));
  return {
    jobs: jobs.filter((j) => hit(j.clientName, j.clientAddress, j.clientPhone, j.clientEmail, j.jobDetails, j.assignedTo, j.id.slice(0, 8), j.category)).slice(0, limit),
    customers: customers.filter((c) => hit(c.name, c.company_name, c.phone, c.phone2, c.email, c.email2, c.address)).slice(0, limit),
  };
}
