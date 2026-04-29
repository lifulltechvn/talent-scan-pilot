import type { ICandidateRepository, IJobRepository } from '@/domain/models/repositories';
import { mockCandidates, mockJobs } from './data/mock-data';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const candidateRepo: ICandidateRepository = {
  async getAll() { await delay(300); return mockCandidates; },
  async getById(id) { await delay(200); return mockCandidates.find(c => c.id === id); },
};

export const jobRepo: IJobRepository = {
  async getAll() { await delay(300); return mockJobs; },
  async getById(id) { await delay(200); return mockJobs.find(j => j.id === id); },
};
