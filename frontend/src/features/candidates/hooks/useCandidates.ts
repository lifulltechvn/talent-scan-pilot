import { useQuery } from '@tanstack/react-query';
import { candidateRepo } from '@/data/di';

export function useCandidates() {
  return useQuery({ queryKey: ['candidates'], queryFn: () => candidateRepo.getAll() });
}

export function useCandidate(id: string) {
  return useQuery({ queryKey: ['candidates', id], queryFn: () => candidateRepo.getById(id) });
}
