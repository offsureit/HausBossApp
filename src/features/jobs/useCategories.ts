import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '~/features/toast/store';
import { categoriesService } from '~/services/categories';
import type { JobCategory } from '@/types';

export const categoriesKey = (companyId: string | null) => ['categories', companyId] as const;

/** Company job categories + "add a new one" (job form). */
export function useCategories(companyId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: categoriesKey(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await categoriesService.list();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const categories = useMemo(() => query.data ?? [], [query.data]);
  const addCategory = useCallback(async (label: string): Promise<JobCategory | null> => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const existing = categories.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await categoriesService.create(trimmed, categories.length);
    if (error || !data) { toast.error('Could not add category', { description: error?.message }); return null; }
    queryClient.setQueryData<JobCategory[]>(categoriesKey(companyId), (prev) => [...(prev ?? []), data]);
    return data;
  }, [categories, queryClient, companyId]);
  return { categories, loading: query.isPending, addCategory };
}
