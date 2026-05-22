import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, Users, Plus, Briefcase, X } from 'lucide-react';
import { useJobs, useCreateJob } from '../hooks/useJobs';
import { useCandidates } from '@/features/candidates/hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { getJobIcon } from '@/shared/utils/job-icon';
import { DatePicker } from '@/shared/components/ui/DatePicker';

function CreateJobModal({ onClose }: { onClose: () => void }) {
  const createJob = useCreateJob();
  const [form, setForm] = useState({ title: '', description: '', skills: '', salaryRange: '', location: '', deadline: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createJob.mutate(
      { title: form.title, description: form.description, requiredSkills: form.skills.split(',').map(s => s.trim()).filter(Boolean), salaryRange: form.salaryRange || undefined, location: form.location || undefined, deadline: form.deadline || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-bg-panel rounded-xl p-6 w-full max-w-lg shadow-xl border border-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Create New Job</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Job title *" className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <textarea required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Job description *" rows={3} className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <input value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} placeholder="Required skills (comma separated)" className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location" className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={form.salaryRange} onChange={e => setForm(p => ({ ...p, salaryRange: e.target.value }))} placeholder="Salary range" className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <DatePicker value={form.deadline} onChange={v => setForm(p => ({ ...p, deadline: v }))} placeholder="Deadline" />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" disabled={createJob.isPending} className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50">
            {createJob.isPending ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function JobsPage() {
  const { data: jobs, isLoading } = useJobs();
  const { data: candidates } = useCandidates();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <LoadingSkeleton rows={3} />;

  const candidateCountByJob = (jobId: string) => candidates?.filter(c => c.jobId === jobId).length ?? 0;

  const filtered = (jobs ?? []).filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.requiredSkills.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const totalCandidates = candidates?.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{jobs?.length ?? 0} open positions · {totalCandidates} total candidates</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors">
          <Plus size={14} /> New Job
        </button>
      </div>

      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} />}

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
                {candidateCountByJob(j.id)}
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
