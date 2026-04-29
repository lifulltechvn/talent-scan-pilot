import type { Candidate } from './candidate';
import type { Job } from './job';

export interface ICandidateRepository {
  getAll(): Promise<Candidate[]>;
  getById(id: string): Promise<Candidate | undefined>;
}

export interface IJobRepository {
  getAll(): Promise<Job[]>;
  getById(id: string): Promise<Job | undefined>;
}
