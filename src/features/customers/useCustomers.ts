import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { customersService } from '~/services/customers';
import type { Customer } from '@/types';

export const customersKey = (companyId: string | null, includeInactive = false) => ['customers', companyId, includeInactive ? 'all' : 'active'] as const;

/** Company customer list (staff). `upsertLocal` / `removeLocal` write both the active and the full list. */
export function useCustomersQuery(companyId: string | null, enabled = true, includeInactive = false) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: customersKey(companyId, includeInactive),
    enabled: !!companyId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await customersService.list({ includeInactive });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const upsertLocal = useCallback((customer: Customer) => {
    for (const all of [false, true]) {
      queryClient.setQueryData<Customer[]>(customersKey(companyId, all), (prev) => {
        if (!prev) return prev;
        const keep = all || customer.is_active !== false;
        const without = prev.filter((c) => c.id !== customer.id);
        const next = keep ? [...without, customer] : without;
        return next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      });
    }
  }, [queryClient, companyId]);
  const removeLocal = useCallback((id: string) => {
    for (const all of [false, true]) queryClient.setQueryData<Customer[]>(customersKey(companyId, all), (prev) => prev?.filter((c) => c.id !== id));
  }, [queryClient, companyId]);
  return { ...query, upsertLocal, removeLocal };
}
