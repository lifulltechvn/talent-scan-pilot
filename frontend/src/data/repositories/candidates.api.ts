import { apiClient } from '@/data/api/client';
import type { Candidate, Score } from '@/domain/models/candidate';
import type { ICandidateRepository } from '@/domain/models/repositories';

function mapCandidate(raw: any, score?: Score | null): Candidate {
  return {
    id: raw.id,
    jobId: raw.job_id,
    structuredData: {
      name: raw.structured_data?.name ?? 'Unknown',
      skills: raw.structured_data?.skills ?? [],
      experience: raw.structured_data?.experience ?? [],
      education: raw.structured_data?.education ?? [],
      languages: raw.structured_data?.languages ?? [],
      totalYearsExperience: raw.structured_data?.experience_years ?? raw.structured_data?.totalYearsExperience ?? 0,
      expectedSalary: raw.structured_data?.expected_salary ?? null,
      insight: raw.structured_data?.insight ?? { strengths: '', weaknesses: '', recommendation: '' },
      certifications: raw.structured_data?.certifications ?? [],
      hometown: raw.structured_data?.hometown ?? null,
      activities: raw.structured_data?.activities ?? [],
      avatar: raw.structured_data?.avatar ?? null,
      email: raw.structured_data?.email ?? null,
      phone: raw.structured_data?.phone ?? null,
      profile_urls: raw.structured_data?.profile_urls ?? [],
      address: raw.structured_data?.address ?? null,
      date_of_birth: raw.structured_data?.date_of_birth ?? null,
      _parse_confidence: raw.structured_data?._parse_confidence ?? null,
      _ai_authenticity: raw.structured_data?._ai_authenticity ?? null,
      skill_level: raw.structured_data?.skill_level ?? null,
    },
    status: raw.status,
    matchScore: raw.match_score,
    cvFilePath: raw.cv_file_path ?? null,
    score: score ?? null,
    sourceAppVersion: raw.source_app_version,
    scannedAt: raw.scanned_at ?? raw.created_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at ?? null,
    jobTitle: raw.job_title ?? null,
    interviewEndTime: raw.interview_end_time ?? null,
  };
}

function mapScore(raw: any): Score {
  return {
    id: raw.id,
    candidateId: raw.candidate_id,
    ruleScore: raw.rule_score,
    llmScore: raw.llm_score,
    finalScore: raw.final_score,
    classification: raw.classification,
    details: raw.details,
    createdAt: raw.created_at,
  };
}

async function fetchScore(candidateId: string): Promise<Score | null> {
  try {
    const { data } = await apiClient.get(`/scoring/candidates/${candidateId}/score`);
    return mapScore(data);
  } catch {
    return null;
  }
}

export const candidateApiRepo: ICandidateRepository = {
  async getAll() {
    const { data } = await apiClient.get('/candidates');
    const candidates: Candidate[] = await Promise.all(
      data.map(async (raw: any) => {
        const score = await fetchScore(raw.id);
        return mapCandidate(raw, score);
      })
    );
    return candidates;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/candidates/${id}`);
    const score = await fetchScore(id);
    return mapCandidate(data, score);
  },

  async updateStatus(id: string, status: string) {
    await apiClient.patch(`/candidates/${id}/status?new_status=${status}`);
  },
};
