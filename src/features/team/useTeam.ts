import { useQuery } from '@tanstack/react-query';
import { teamService } from '~/services/team';

export const teamKey = (companyId: string | null) => ['team', companyId] as const;

/** Company roster (`GET /team`). */
export function useTeamQuery(companyId: string | null) {
  return useQuery({
    queryKey: teamKey(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await teamService.listTeam();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
