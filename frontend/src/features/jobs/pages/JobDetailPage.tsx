import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, DollarSign, Users, Trophy, Edit } from 'lucide-react';
import { useJob } from '../hooks/useJobs';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { getJobIcon } from '@/shared/utils/job-icon';
import { useCandidates } from '@/features/candidates/hooks/useCandidates';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading: loadingJ } = useJob(id!);
  const { data: allCandidates, isLoading: loadingC } = useCandidates();

  if (loadingJ || loadingC) return <LoadingSkeleton rows={3} />;
  if (!job) return <div className="text-text-tertiary text-sm">Job not found</div>;

  const candidates = allCandidates?.filter(c => c.jobId === job.id) ?? [];
  const gold = candidates.filter(c => c.score?.classification === 'gold').length;
  const silver = candidates.filter(c => c.score?.classification === 'silver').length;

  return (
    <div>
      <Link to="/jobs" className="text-[13px] text-text-tertiary hover:text-accent flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to Jobs
      </Link>

      {/* Header */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              {(() => { const Icon = getJobIcon(job.title); return <Icon size={22} />; })()}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{job.title}</h1>
              <div className="flex items-center gap-3 text-[12px] text-text-tertiary mt-0.5">
                <span className="flex items-center gap-1"><MapPin size={11} /> {job.location}</span>
                <span className="flex items-center gap-1"><DollarSign size={11} /> {job.salaryRange}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {job.deadline?.slice(0, 10)}</span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-accent/10 hover:text-accent border border-border-subtle transition-colors">
            <Edit size={14} /> Edit Job
          </button>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {job.requiredSkills.map(s => (
            <span key={s} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">{s}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-500" />
            <span className="text-[11px] text-text-tertiary">Total</span>
          </div>
          <span className="text-2xl font-bold text-text-primary">{candidates.length}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-amber-500" />
            <span className="text-[11px] text-text-tertiary">Gold</span>
          </div>
          <span className="text-2xl font-bold text-amber-600">{gold}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-slate-400" />
            <span className="text-[11px] text-text-tertiary">Silver</span>
          </div>
          <span className="text-2xl font-bold text-slate-600">{silver}</span>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-primary">Candidates ({candidates.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-surface/50">
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">Candidate</th>
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">Score</th>
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">Class</th>
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface/30 transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/candidates/${c.id}`} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[10px] font-bold shrink-0">
                      {c.structuredData.name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
                    </div>
                    <span className="text-[13px] font-medium text-accent hover:underline">{c.structuredData.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3"><ScoreBar score={c.score?.finalScore ?? 0} /></td>
                <td className="px-4 py-3"><Badge variant={c.score?.classification ?? 'neutral'}>{c.score?.classification ?? '—'}</Badge></td>
                <td className="px-4 py-3"><span className="text-[12px] text-text-tertiary capitalize">{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <EmptyState icon={Users} title="No candidates yet" description="Candidates will appear here after CV scanning" />}
      </div>
    </div>
  );
}
