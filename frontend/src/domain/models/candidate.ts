export type CandidateStatus = 'new' | 'reviewed' | 'approved' | 'rejected' | 'talent_pool';
export type Classification = 'gold' | 'silver' | 'talent_pool';

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
}

export interface Candidate {
  id: string;
  jobId: string | null;
  structuredData: CandidateStructuredData;
  status: CandidateStatus;
  matchScore: number | null;
  score: Score | null;
  sourceAppVersion: string | null;
  scannedAt: string;
  createdAt: string;
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
