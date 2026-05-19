import { apiClient } from '@/data/api/client';
import type { Job } from '@/domain/models/job';
import type { IJobRepository } from '@/domain/models/repositories';

function mapJob(raw: any): Job {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    requiredSkills: raw.required_skills ?? [],
    salaryRange: raw.salary_range,
    location: raw.location,
    deadline: raw.deadline,
    candidateCount: 0,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const jobApiRepo: IJobRepository = {
  async getAll() {
    const { data } = await apiClient.get('/jobs');
    return data.map(mapJob);
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/jobs/${id}`);
    return mapJob(data);
  },

  async create(payload: { title: string; description: string; requiredSkills: string[]; salaryRange?: string; location?: string; deadline?: string }) {
    const { data } = await apiClient.post('/jobs', {
      title: payload.title,
      description: payload.description,
      required_skills: payload.requiredSkills,
      salary_range: payload.salaryRange,
      location: payload.location,
      deadline: payload.deadline,
    });
    return mapJob(data);
  },
};
