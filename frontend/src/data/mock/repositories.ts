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
  async create(data) { await delay(300); return { id: '1', ...data, candidateCount: 0, createdBy: '1', createdAt: '', updatedAt: '' } as any; },
  async update(id, data) { await delay(300); return { id, ...data, candidateCount: 0, createdBy: '1', createdAt: '', updatedAt: '' } as any; },
};
