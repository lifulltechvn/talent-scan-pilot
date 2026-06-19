import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, Users, Plus, Briefcase, X, Upload, Sparkles } from 'lucide-react';
import { useJobs, useCreateJob } from '../hooks/useJobs';
import { useCandidates } from '@/features/candidates/hooks/useCandidates';
import { useI18n } from '@/shared/i18n';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { getJobIcon } from '@/shared/utils/job-icon';
import { DatePicker } from '@/shared/components/ui/DatePicker';
import { TagInput } from '@/shared/components/ui/TagInput';
import { apiClient } from '@/data/api/client';
import { useMasterData } from '../hooks/useMasterData';

function CreateJobModal({ onClose, initialData }: { onClose: () => void; initialData?: any }) {
  const createJob = useCreateJob();
  const { data: masterData } = useMasterData();
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    skills: (initialData?.required_skills || []) as string[],
    salaryRange: initialData?.salary_range || '',
    location: initialData?.location || '',
    category: initialData?.category || '',
    deadline: initialData?.deadline || '',
  });

  const handleAIGenerate = async () => {
    if (!form.title) return;
    setGenerating(true);
    try {
      const { data } = await apiClient.post('/jobs/generate-jd', { title: form.title, keywords: form.skills.join(', '), category: form.category });
      setForm(p => ({
        ...p,
        description: data.description || p.description,
        skills: data.required_skills || p.skills,
        salaryRange: data.salary_range || p.salaryRange,
        location: data.location || p.location,
      }));
    } catch {
      alert('AI generation failed — please try again or fill manually.');
    }
    setGenerating(false);
  };

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Tên job không được để trống';
    if (!form.description.trim()) errors.description = 'Mô tả không được để trống';
    if (form.skills.length === 0) errors.skills = 'Cần ít nhất 1 kỹ năng';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    createJob.mutate(
      { title: form.title, description: form.description, requiredSkills: form.skills, salaryRange: form.salaryRange || undefined, location: form.location || undefined, category: form.category || undefined, deadline: form.deadline || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-bg-panel rounded-xl p-6 w-full max-w-lg shadow-xl border border-border-subtle max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Create New Job</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={form.title} onChange={e => { setForm(p => ({ ...p, title: e.target.value })); setFormErrors(p => ({ ...p, title: '' })); }} placeholder="Job title *" className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 ${formErrors.title ? 'border-red-400' : 'border-border-subtle'}`} />
            <button type="button" onClick={handleAIGenerate} disabled={!form.title || generating} className="px-3 py-2 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 disabled:opacity-50 shrink-0 flex items-center gap-1">
              {generating ? <><div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" /> AI...</> : <><Sparkles size={12} /> AI Generate</>}
            </button>
          </div>
          {formErrors.title && <p className="text-[11px] text-red-500 -mt-2">{formErrors.title}</p>}
          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Position Category *</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 bg-white">
              <option value="">Select category...</option>
              <option value="application_engineer">Application Engineer</option>
              <option value="bridge_se">Bridge System Engineer</option>
              <option value="qa_engineer">QA Engineer</option>
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
            </select>
          </div>
          <textarea value={form.description} onChange={e => { setForm(p => ({ ...p, description: e.target.value })); setFormErrors(p => ({ ...p, description: '' })); }} placeholder="Job description *" rows={3} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 ${formErrors.description ? 'border-red-400' : 'border-border-subtle'}`} />
          {formErrors.description && <p className="text-[11px] text-red-500 -mt-2">{formErrors.description}</p>}
          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Skills</label>
            <TagInput value={form.skills} onChange={v => { setForm(p => ({ ...p, skills: v })); setFormErrors(p => ({ ...p, skills: '' })); }} suggestions={masterData?.skills || []} placeholder="Type skill name..." />
            {formErrors.skills && <p className="text-[11px] text-red-500 mt-1">{formErrors.skills}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Location</label>
              <select value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 bg-white">
                <option value="">Select location</option>
                {(masterData?.locations || []).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Salary Range</label>
              <select value={form.salaryRange} onChange={e => setForm(p => ({ ...p, salaryRange: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 bg-white">
                <option value="">Select range</option>
                {(masterData?.salary_ranges || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
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
  const [importedData, setImportedData] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const { t } = useI18n();

  const handleImportJD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await apiClient.post('/jobs/import', form);
      setImportedData(data);
      setShowCreate(true);
    } catch { }
    setImportLoading(false);
    e.target.value = '';
  };

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
          <h1 className="text-xl font-semibold text-text-primary">{t("jobsTitle")}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{jobs?.length ?? 0} open positions · {totalCandidates} total candidates</p>
        </div>
        <div className="flex gap-2">
          <label className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg border transition-colors cursor-pointer ${importLoading ? 'bg-bg-surface text-text-muted border-border-subtle cursor-wait' : 'bg-bg-surface text-text-secondary border-border-subtle hover:bg-accent/10 hover:text-accent'}`}>
            {importLoading ? (
              <><div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Parsing...</>
            ) : (
              <><Upload size={14} /> Import JD</>
            )}
            <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleImportJD} disabled={importLoading} className="hidden" />
          </label>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors">
            <Plus size={14} /> New Job
          </button>
        </div>
      </div>

      {showCreate && <CreateJobModal onClose={() => { setShowCreate(false); setImportedData(null); }} initialData={importedData} />}

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("search")}
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
        <EmptyState icon={Briefcase} title={t("noData")} description="Try adjusting your search or create a new job" />
      )}
    </div>
  );
}
