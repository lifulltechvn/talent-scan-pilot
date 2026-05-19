import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobRepo } from '@/data/di';

export function useJobs() {
  return useQuery({ queryKey: ['jobs'], queryFn: () => jobRepo.getAll() });
}

export function useJob(id: string) {
  return useQuery({ queryKey: ['jobs', id], queryFn: () => jobRepo.getById(id) });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description: string; requiredSkills: string[]; salaryRange?: string; location?: string; deadline?: string }) =>
      jobRepo.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
