export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type InterviewResult = 'pass' | 'fail' | 'next_round' | null;

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  scheduledAt: string;
  round: number;
  status: InterviewStatus;
  result: InterviewResult;
  notes: string | null;
  reminderSent: boolean;
}
