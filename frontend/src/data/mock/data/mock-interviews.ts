import type { Interview } from '@/domain/models/interview';
import type { TalentPoolEntry } from '@/domain/models/talent-pool';

export const mockInterviews: Interview[] = [
  {
    id: 'iv1', candidateId: 'c1', candidateName: '[NAME-1]', jobId: 'j1', jobTitle: 'Frontend Developer',
    scheduledAt: '2026-05-02T10:00:00', round: 1, status: 'scheduled', result: null,
    notes: null, reminderSent: false,
  },
  {
    id: 'iv2', candidateId: 'c4', candidateName: '[NAME-4]', jobId: 'j2', jobTitle: 'Backend Engineer',
    scheduledAt: '2026-05-01T14:00:00', round: 1, status: 'completed', result: 'pass',
    notes: 'Strong FastAPI knowledge. Recommend for round 2.', reminderSent: true,
  },
  {
    id: 'iv3', candidateId: 'c4', candidateName: '[NAME-4]', jobId: 'j2', jobTitle: 'Backend Engineer',
    scheduledAt: '2026-05-05T10:00:00', round: 2, status: 'scheduled', result: null,
    notes: null, reminderSent: false,
  },
  {
    id: 'iv4', candidateId: 'c2', candidateName: '[NAME-2]', jobId: 'j1', jobTitle: 'Frontend Developer',
    scheduledAt: '2026-04-28T09:00:00', round: 1, status: 'completed', result: 'fail',
    notes: 'Lacks TypeScript experience. Moved to talent pool.', reminderSent: true,
  },
  {
    id: 'iv5', candidateId: 'c5', candidateName: '[NAME-5]', jobId: 'j2', jobTitle: 'Backend Engineer',
    scheduledAt: '2026-04-30T15:00:00', round: 1, status: 'cancelled', result: null,
    notes: 'Candidate withdrew application.', reminderSent: true,
  },
];

export const mockTalentPool: TalentPoolEntry[] = [
  {
    id: 'tp1', candidateId: 'c3', candidateName: '[NAME-3]', originalJobId: 'j1', originalJobTitle: 'Frontend Developer',
    skills: ['HTML', 'CSS', 'jQuery'], score: 27, reason: 'No modern framework experience. Eager to learn.',
    status: 'active', addedAt: '2026-04-21T09:00:00', rematchedJobTitle: null,
  },
  {
    id: 'tp2', candidateId: 'c2', candidateName: '[NAME-2]', originalJobId: 'j1', originalJobTitle: 'Frontend Developer',
    skills: ['React', 'JavaScript', 'CSS'], score: 42, reason: 'Junior level. Needs mentoring on TypeScript.',
    status: 'rematched', addedAt: '2026-04-28T10:00:00', rematchedJobTitle: 'QA Engineer',
  },
  {
    id: 'tp3', candidateId: 'c6', candidateName: '[NAME-6]', originalJobId: 'j2', originalJobTitle: 'Backend Engineer',
    skills: ['Java', 'Spring Boot', 'MySQL'], score: 35, reason: 'Wrong tech stack (Java vs Python). Good fundamentals.',
    status: 'active', addedAt: '2026-04-22T11:00:00', rematchedJobTitle: null,
  },
  {
    id: 'tp4', candidateId: 'c7', candidateName: '[NAME-7]', originalJobId: 'j3', originalJobTitle: 'QA Engineer',
    skills: ['Manual Testing', 'Selenium'], score: 38, reason: 'No automation experience with Playwright.',
    status: 'active', addedAt: '2026-04-23T14:00:00', rematchedJobTitle: null,
  },
];
