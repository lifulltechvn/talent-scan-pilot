import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Briefcase, GraduationCap, Languages, DollarSign, Sparkles } from 'lucide-react';
import { useCandidate } from '../hooks/useCandidates';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: candidate, isLoading } = useCandidate(id!);

  if (isLoading) return <div className="text-text-tertiary text-sm">Loading…</div>;
  if (!candidate) return <div className="text-text-tertiary text-sm">Candidate not found</div>;

  const { structuredData: d, score } = candidate;

  return (
    <div>
      <Link to="/candidates" className="text-[13px] text-text-tertiary hover:text-accent flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to Candidates
      </Link>

      {/* Header Card */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg font-bold">
              {d.name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-text-primary">{d.name}</h1>
                <Badge variant={score?.classification ?? 'neutral'}>{score?.classification ?? '—'}</Badge>
              </div>
              <p className="text-[13px] text-text-tertiary">{d.totalYearsExperience}y experience · {d.languages.map(l => `${l.language} (${l.level})`).join(', ')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-600 transition-colors">
              <CheckCircle size={14} /> Approve
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-red-50 hover:text-red-600 border border-border-subtle transition-colors">
              <XCircle size={14} /> Reject
            </button>
          </div>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Final Score', value: score?.finalScore ?? 0, sub: 'Combined' },
          { label: 'Rule Score', value: score?.ruleScore ?? 0, sub: '70% weight' },
          { label: 'LLM Score', value: score?.llmScore ?? 0, sub: '30% weight' },
        ].map(s => (
          <div key={s.label} className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-text-tertiary">{s.label}</span>
              <span className="text-[10px] text-text-muted">{s.sub}</span>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">{s.value}</div>
            <ScoreBar score={s.value} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Insight */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-text-primary">AI Insight</h2>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Strengths</span>
              <p className="text-[13px] text-emerald-800 mt-1">{d.insight.strengths}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Weaknesses</span>
              <p className="text-[13px] text-amber-800 mt-1">{d.insight.weaknesses}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">Recommendation</span>
              <p className="text-[13px] text-blue-800 mt-1">{d.insight.recommendation}</p>
            </div>
          </div>
        </div>

        {/* Profile */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h2 className="text-sm font-medium text-text-primary mb-4">Profile</h2>
          <div className="space-y-4">
            {/* Skills */}
            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Skills</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {d.skills.map(s => <span key={s} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">{s}</span>)}
              </div>
            </div>

            {/* Experience */}
            {d.experience.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Briefcase size={13} className="text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Experience</span>
                </div>
                {d.experience.map((exp, i) => (
                  <div key={i} className="ml-5 py-1.5 border-l-2 border-border-subtle pl-3 mb-1">
                    <div className="text-[13px] font-medium text-text-primary">{exp.role}</div>
                    <div className="text-[12px] text-text-tertiary">{exp.company} · {exp.years}y</div>
                  </div>
                ))}
              </div>
            )}

            {/* Education */}
            {d.education.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <GraduationCap size={13} className="text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Education</span>
                </div>
                {d.education.map((edu, i) => (
                  <div key={i} className="ml-5 py-1">
                    <div className="text-[13px] text-text-primary">{edu.degree} in {edu.major}</div>
                    <div className="text-[12px] text-text-tertiary">{edu.school} · {edu.year}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Languages */}
            <div className="flex items-center gap-1.5">
              <Languages size={13} className="text-text-muted" />
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider mr-2">Languages</span>
              {d.languages.map(l => (
                <span key={l.language} className="text-[11px] bg-bg-surface text-text-secondary px-2 py-0.5 rounded">{l.language} ({l.level})</span>
              ))}
            </div>

            {/* Salary */}
            {d.expectedSalary && (
              <div className="flex items-center gap-1.5">
                <DollarSign size={13} className="text-text-muted" />
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider mr-2">Expected</span>
                <span className="text-[13px] text-text-primary">{d.expectedSalary}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
