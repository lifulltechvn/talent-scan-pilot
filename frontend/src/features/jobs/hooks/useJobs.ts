import { useQuery } from '@tanstack/react-query';
import { jobRepo } from '@/data/di';

export function useJobs() {
  return useQuery({ queryKey: ['jobs'], queryFn: () => jobRepo.getAll() });
}

export function useJob(id: string) {
  return useQuery({ queryKey: ['jobs', id], queryFn: () => jobRepo.getById(id) });
}
