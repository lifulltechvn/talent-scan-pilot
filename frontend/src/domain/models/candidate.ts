export type CandidateStatus = 'new' | 'processing' | 'reviewed' | 'assigned' | 'pending' | 'approved' | 'rejected';
export type Classification = 'gold' | 'silver' | 'bronze';

export interface AiInsight {
  strengths: string;
  weaknesses: string;
  recommendation: string;
}

export interface Experience {
  company: string;
  role: string;
  years: number;
  description: string;
}

export interface Education {
  school: string;
  major: string;
  degree: string;
  year: number;
}

export interface Language {
  language: string;
  level: string;
}

export interface CandidateStructuredData {
  name: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  languages: Language[];
  totalYearsExperience: number;
  expectedSalary: string | null;
  insight: AiInsight;
  skill_level?: { level: string; category: string; reason: string } | null;
}

export interface Candidate {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  structuredData: CandidateStructuredData;
  status: CandidateStatus;
  matchScore: number | null;
  cvFilePath: string | null;
  score: Score | null;
  sourceAppVersion: string | null;
  scannedAt: string;
  createdAt: string;
  updatedAt: string | null;
  interviewEndTime: string | null;
}

export interface Score {
  id: string;
  candidateId: string;
  ruleScore: number | null;
  llmScore: number | null;
  finalScore: number | null;
  classification: Classification | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
