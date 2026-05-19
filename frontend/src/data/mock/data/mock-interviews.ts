import type { Interview } from '@/domain/models/interview';
import type { TalentPoolEntry } from '@/domain/models/talent-pool';

export const mockInterviews: Interview[] = [
  {
    id: 'iv1', candidateId: 'c1', candidateName: 'Pham Duc Anh', jobId: 'j1', jobTitle: 'React Frontend Developer',
    scheduledAt: '2026-05-20T10:00:00', round: 1, status: 'scheduled', result: null,
    notes: 'Strong React portfolio. Discuss team fit.', reminderSent: false,
  },
  {
    id: 'iv2', candidateId: 'c2', candidateName: 'Nguyen Van Minh', jobId: 'j2', jobTitle: 'Senior Python Backend Developer',
    scheduledAt: '2026-05-18T14:00:00', round: 1, status: 'completed', result: 'pass',
    notes: 'Excellent FastAPI knowledge. 5y experience confirmed. Recommend for final round.', reminderSent: true,
  },
  {
    id: 'iv3', candidateId: 'c2', candidateName: 'Nguyen Van Minh', jobId: 'j2', jobTitle: 'Senior Python Backend Developer',
    scheduledAt: '2026-05-22T10:00:00', round: 2, status: 'scheduled', result: null,
    notes: 'Final round with CTO. System design discussion.', reminderSent: false,
  },
  {
    id: 'iv4', candidateId: 'c3', candidateName: 'Vo Minh Thu', jobId: 'j1', jobTitle: 'React Frontend Developer',
    scheduledAt: '2026-05-15T09:00:00', round: 1, status: 'completed', result: 'fail',
    notes: 'Only Vue.js experience. No React/TypeScript. Moved to talent pool.', reminderSent: true,
  },
  {
    id: 'iv5', candidateId: 'c4', candidateName: 'Hoang Quoc Bao', jobId: 'j3', jobTitle: 'DevOps Engineer',
    scheduledAt: '2026-05-19T15:00:00', round: 1, status: 'completed', result: 'next_round',
    notes: 'AWS certified, K8s expert. Salary negotiation needed. Schedule final round.', reminderSent: true,
  },
  {
    id: 'iv6', candidateId: 'c5', candidateName: 'Nguyen Thi Mai', jobId: 'j1', jobTitle: 'React Frontend Developer',
    scheduledAt: '2026-05-21T11:00:00', round: 1, status: 'scheduled', result: null,
    notes: 'Design + code background. Interesting profile.', reminderSent: false,
  },
  {
    id: 'iv7', candidateId: 'c6', candidateName: 'Tran Van Duc', jobId: 'j3', jobTitle: 'DevOps Engineer',
    scheduledAt: '2026-05-16T14:00:00', round: 1, status: 'completed', result: 'pass',
    notes: 'Multi-cloud certified. Good Terraform skills. Proceed to technical challenge.', reminderSent: true,
  },
  {
    id: 'iv8', candidateId: 'c7', candidateName: 'Le Hoang Nam', jobId: 'j2', jobTitle: 'Senior Python Backend Developer',
    scheduledAt: '2026-05-14T10:00:00', round: 1, status: 'cancelled', result: null,
    notes: 'Candidate accepted offer elsewhere (Java role at Samsung).', reminderSent: true,
  },
  {
    id: 'iv9', candidateId: 'c8', candidateName: 'Bui Quang Huy', jobId: 'j2', jobTitle: 'Senior Python Backend Developer',
    scheduledAt: '2026-05-23T09:30:00', round: 1, status: 'scheduled', result: null,
    notes: 'Staff engineer from Shopee. Discuss scope and salary expectations.', reminderSent: false,
  },
  {
    id: 'iv10', candidateId: 'c9', candidateName: 'Do Hai Yen', jobId: 'j1', jobTitle: 'React Frontend Developer',
    scheduledAt: '2026-05-13T16:00:00', round: 1, status: 'completed', result: 'pass',
    notes: 'Solid React skills. TypeScript gap is trainable. Good culture fit.', reminderSent: true,
  },
  {
    id: 'iv11', candidateId: 'c10', candidateName: 'Dang Thanh Son', jobId: 'j3', jobTitle: 'DevOps Engineer',
    scheduledAt: '2026-05-12T11:00:00', round: 1, status: 'no_show', result: null,
    notes: 'Did not attend. Sent follow-up email.', reminderSent: true,
  },
];

export const mockTalentPool: TalentPoolEntry[] = [
  {
    id: 'tp1', candidateId: 'c3', candidateName: 'Vo Minh Thu', originalJobId: 'j1', originalJobTitle: 'React Frontend Developer',
    skills: ['Vue.js', 'JavaScript', 'CSS'], score: 35, reason: 'Only Vue.js experience. Learning React. Re-evaluate in 3 months.',
    status: 'active', addedAt: '2026-05-15T10:00:00', rematchedJobTitle: null,
  },
  {
    id: 'tp2', candidateId: 'c7', candidateName: 'Le Hoang Nam', originalJobId: 'j2', originalJobTitle: 'Senior Python Backend Developer',
    skills: ['Java', 'Spring Boot', 'MySQL', 'Kafka'], score: 28, reason: 'Wrong tech stack (Java vs Python). Strong OOP fundamentals. Monitor for Java roles.',
    status: 'active', addedAt: '2026-05-14T11:00:00', rematchedJobTitle: null,
  },
  {
    id: 'tp3', candidateId: 'c10', candidateName: 'Dang Thanh Son', originalJobId: 'j3', originalJobTitle: 'DevOps Engineer',
    skills: ['Docker', 'Linux', 'CI/CD', 'Python'], score: 32, reason: 'Too junior for Senior DevOps. Good foundation. Consider for Junior DevOps opening.',
    status: 'rematched', addedAt: '2026-05-12T14:00:00', rematchedJobTitle: 'Junior DevOps Engineer',
  },
  {
    id: 'tp4', candidateId: 'c11', candidateName: 'Ly Minh Tuan', originalJobId: 'j2', originalJobTitle: 'Senior Python Backend Developer',
    skills: ['Python', 'Flask', 'MySQL'], score: 22, reason: 'Fresh graduate. Only internship experience. Talent pool for Junior Python roles.',
    status: 'active', addedAt: '2026-05-16T09:00:00', rematchedJobTitle: null,
  },
  {
    id: 'tp5', candidateId: 'c12', candidateName: 'Tran Thi Lan', originalJobId: 'j2', originalJobTitle: 'Senior Python Backend Developer',
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker'], score: 45, reason: 'Good potential but no FastAPI. Recommend self-study then re-apply.',
    status: 'active', addedAt: '2026-05-17T10:00:00', rematchedJobTitle: null,
  },
];
