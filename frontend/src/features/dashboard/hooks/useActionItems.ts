import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/data/api/client';

export interface ActionItems {
  unreviewed_candidates: { id: string; name: string; created_at: string; job_id: string | null }[];
  unreviewed_count: number;
  stale_count: number;
  upcoming_interviews: { id: string; candidate_name: string; job_title: string; slot_start: string; slot_end: string }[];
  pending_bookings_count: number;
  expiring_jobs: { id: string; title: string; deadline: string }[];
}

export function useActionItems() {
  return useQuery<ActionItems>({
    queryKey: ['dashboard', 'action-items'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/action-items');
      return data;
    },
    refetchInterval: 60_000, // refresh every minute
  });
}
