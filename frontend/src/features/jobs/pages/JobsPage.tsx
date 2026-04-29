import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, Users, Plus, Briefcase } from 'lucide-react';
import { useJobs } from '../hooks/useJobs';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { getJobIcon } from '@/shared/utils/job-icon';

export function JobsPage() {
  const { data: jobs, isLoading } = useJobs();
  const [search, setSearch] = useState('');

  if (isLoading) return <LoadingSkeleton rows={3} />;

  const filtered = (jobs ?? []).filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.requiredSkills.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const totalCandidates = jobs?.reduce((sum, j) => sum + j.candidateCount, 0) ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{jobs?.length ?? 0} open positions · {totalCandidates} total candidates</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors">
          <Plus size={14} /> New Job
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs or skills..."
          className="w-full sm:w-80 pl-9 pr-3 py-2 bg-bg-panel border border-border-subtle rounded-lg text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40"
        />
      </div>

      {/* Job Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(j => (
          <Link key={j.id} to={`/jobs/${j.id}`} className="bg-bg-panel border border-border-subtle rounded-xl p-5 hover:border-accent/30 hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                {(() => { const Icon = getJobIcon(j.title); return <Icon size={18} />; })()}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <Users size={12} />
                {j.candidateCount}
              </div>
            </div>

            <h3 className="text-[14px] font-semibold text-accent mb-1">{j.title}</h3>

            <div className="flex items-center gap-3 text-[12px] text-text-tertiary mb-3">
              <span className="flex items-center gap-1"><MapPin size={11} /> {j.location}</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {j.deadline?.slice(0, 10)}</span>
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {j.requiredSkills.map(s => (
                <span key={s} className="text-[10px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded font-medium">{s}</span>
              ))}
            </div>

            <div className="pt-3 border-t border-border-subtle">
              <span className="text-[12px] text-text-tertiary">{j.salaryRange}</span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={Briefcase} title="No jobs found" description="Try adjusting your search or create a new job" />
      )}
    </div>
  );
}
