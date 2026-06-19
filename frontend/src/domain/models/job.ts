export interface Job {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  salaryRange: string | null;
  location: string | null;
  category: string | null;
  deadline: string | null;
  candidateCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
