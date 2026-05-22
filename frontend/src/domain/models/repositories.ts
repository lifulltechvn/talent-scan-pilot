import type { Candidate } from './candidate';
import type { Job } from './job';

export interface ICandidateRepository {
  getAll(): Promise<Candidate[]>;
  getById(id: string): Promise<Candidate | undefined>;
  updateStatus(id: string, status: string): Promise<void>;
}

export interface IJobRepository {
  getAll(): Promise<Job[]>;
  getById(id: string): Promise<Job | undefined>;
  create(data: { title: string; description: string; requiredSkills: string[]; salaryRange?: string; location?: string; deadline?: string }): Promise<Job>;
  update(id: string, data: { title: string; description: string; requiredSkills: string[]; salaryRange?: string; location?: string; deadline?: string }): Promise<Job>;
}
