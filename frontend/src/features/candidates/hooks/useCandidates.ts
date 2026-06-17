import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidateRepo } from '@/data/di';

export function useCandidates() {
  return useQuery({ queryKey: ['candidates'], queryFn: () => candidateRepo.getAll() });
}

export function useCandidate(id: string) {
  return useQuery({ queryKey: ['candidates', id], queryFn: () => candidateRepo.getById(id) });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => candidateRepo.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.refetchQueries({ queryKey: ['candidates'] });
      qc.refetchQueries({ queryKey: ['candidates', id] });
    },
  });
}
