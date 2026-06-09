import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/data/api/client';

interface MasterData {
  skills: string[];
  locations: string[];
  salary_ranges: string[];
}

export function useMasterData() {
  return useQuery<MasterData>({
    queryKey: ['master-data'],
    queryFn: async () => (await apiClient.get('/master-data')).data,
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
}
