export interface TalentPoolEntry {
  id: string;
  candidateId: string;
  candidateName: string;
  originalJobId: string;
  originalJobTitle: string;
  skills: string[];
  score: number;
  reason: string;
  status: 'active' | 'rematched' | 'hired' | 'expired';
  addedAt: string;
  rematchedJobTitle: string | null;
}
