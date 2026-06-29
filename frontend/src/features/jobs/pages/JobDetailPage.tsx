import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, DollarSign, Users, Trophy, Edit, Trash2, Briefcase, Mail, X, Send, CheckCircle, XCircle, ClipboardCheck, Sparkles, Loader2, UserPlus, Download, CalendarCheck, Brain } from 'lucide-react';
import { useJob, useUpdateJob, useDeleteJob } from '../hooks/useJobs';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { getJobIcon } from '@/shared/utils/job-icon';
import { useCandidates, useUpdateCandidateStatus } from '@/features/candidates/hooks/useCandidates';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/shared/components/ui/Toast';
import { useI18n } from '@/shared/i18n';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import { DatePicker } from '@/shared/components/ui/DatePicker';
import { TagInput } from '@/shared/components/ui/TagInput';
import { useMasterData } from '../hooks/useMasterData';
import { apiClient } from '@/data/api/client';

function AiSummaryDisplay({ summary }: { summary: string }) {
  const { t, locale } = useI18n();
  const target = locale === 'vi' ? 'vi' : 'en';
  try {
    const parsed = JSON.parse(summary);
    // New format: {en: {summary, strengths, ...}, vi: {summary, strengths, ...}}
    const data = parsed[target] || parsed['en'] || parsed['vi'] || parsed;
    const displaySummary = data.summary || (typeof parsed === 'object' && parsed.summary);
    if (displaySummary || data.strengths || data.concerns) {
      return (
        <div className="mt-2 space-y-2">
          {(data.summary || parsed.summary) && <p className="text-[12px] text-blue-800">{data.summary || parsed.summary}</p>}
          {(data.strengths || parsed.strengths)?.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-emerald-700">{t('strengthsLabel')}</span>
              <ul className="mt-0.5 space-y-0.5">
                {(data.strengths || parsed.strengths).map((s: string, i: number) => (
                  <li key={i} className="text-[11px] text-emerald-800 pl-3">• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {(data.concerns || parsed.concerns)?.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-amber-700">{t('concernsLabel')}</span>
              <ul className="mt-0.5 space-y-0.5">
                {(data.concerns || parsed.concerns).map((c: string, i: number) => (
                  <li key={i} className="text-[11px] text-amber-800 pl-3">• {c}</li>
                ))}
              </ul>
            </div>
          )}
          {(data.suggestion || parsed.suggestion) && (
            <div>
              <span className="text-[10px] font-medium text-purple-700">{t('interviewSuggestion')}</span>
              <p className="text-[11px] text-purple-800 pl-3 mt-0.5">{data.suggestion || parsed.suggestion}</p>
            </div>
          )}
        </div>
      );
    }
  } catch {}
  // Fallback: plain text with line breaks
  return <p className="text-[12px] text-blue-800 mt-1 whitespace-pre-line">{summary}</p>;
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: job, isLoading: loadingJ } = useJob(id!);
  const { data: allCandidates, isLoading: loadingC } = useCandidates();
  const { t, locale } = useI18n();

  // Helper to get localized text from i18n object or plain string
  const loc = (val: any) => {
    if (!val) return '';
    if (typeof val === 'object' && !Array.isArray(val)) {
      const target = locale === 'vi' ? 'vi' : 'en';
      return val[target] || val['en'] || val['vi'] || '';
    }
    return val;
  };
  const locArr = (val: any) => {
    if (!val) return [];
    if (typeof val === 'object' && !Array.isArray(val)) {
      const target = locale === 'vi' ? 'vi' : 'en';
      return val[target] || val['en'] || val['vi'] || [];
    }
    return val;
  };
  const [outreachModal, setOutreachModal] = useState(false);
  const [editModal, setEditModal] = useState(false);

  const updateStatus = useUpdateCandidateStatus();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [actionModal, setActionModal] = useState<{ candidateId: string; action: 'approved' | 'rejected'; sendEmail?: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [scoreDetail, setScoreDetail] = useState<any | null>(null);
  const [scoreDetailLoading, setScoreDetailLoading] = useState(false);
  const [bookInterview, setBookInterview] = useState<{ candidateId: string; candidateName: string } | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<{ id: string; name: string } | null>(null);
  const [compareData, setCompareData] = useState<any | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [aiRecommend, setAiRecommend] = useState<any>(null);
  const [showAiRecommend, setShowAiRecommend] = useState(false);
  const [aiRecommendLoading, setAiRecommendLoading] = useState(false);

  const handleSuggest = async () => {
    setSuggestLoading(true);
    try {
      const { data } = await apiClient.get(`/jobs/${id}/suggest`);
      setSuggestions(data);
    } catch { /* ignore */ }
    setSuggestLoading(false);
  };

  const handleAssign = async (candidateId: string) => {
    setAssigning(candidateId);
    try {
      await apiClient.post(`/jobs/${id}/assign/${candidateId}`);
      setSuggestions(prev => prev?.filter(s => s.id !== candidateId) ?? null);
      await queryClient.refetchQueries({ queryKey: ['candidates'] });
      toast('success', 'Candidate assigned & scoring started');
    } catch {
      toast('error', 'Failed to assign candidate');
    }
    setAssigning(null);
  };

  const handleViewScore = async (candidateId: string) => {
    setScoreDetailLoading(true);
    try {
      const { data } = await apiClient.get(`/jobs/${id}/candidates/${candidateId}/score-detail`);
      setScoreDetail(data);
    } catch { setScoreDetail(null); }
    setScoreDetailLoading(false);
  };

  const handleCompare = async () => {
    setCompareLoading(true);
    try {
      const { data } = await apiClient.get(`/jobs/${id}/compare?limit=5`);
      setCompareData(data);
    } catch {}
    setCompareLoading(false);
  };

  const [aiRecommendKey, setAiRecommendKey] = useState('');

  const handleAiRecommend = async () => {
    setShowAiRecommend(true);
    setAiRecommendLoading(true);
    try {
      const { data } = await apiClient.get(`/jobs/${id}/ai-recommend`);
      setAiRecommend(data);
    } catch {}
    setAiRecommendLoading(false);
  };

  if (loadingJ || loadingC) return <LoadingSkeleton rows={3} />;
  if (!job) return <EmptyState icon={Briefcase} title={t('jobNotFound')} description={t('jobNotFoundDesc')} action={{ label: t('backToJobs'), onClick: () => window.history.back() }} />;

  const candidates = allCandidates?.filter(c => c.jobId === job.id) ?? [];
  const gold = candidates.filter(c => c.score?.classification === 'gold').length;
  const silver = candidates.filter(c => c.score?.classification === 'silver').length;

  return (
    <div>
      <button onClick={() => window.history.back()} className="text-[13px] text-text-tertiary hover:text-accent flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> {t('back')}
      </button>

      {/* Header */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              {(() => { const Icon = getJobIcon(job.title); return <Icon size={22} />; })()}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{job.title}</h1>
              {(job.location || job.salaryRange || job.deadline) && (
              <div className="flex items-center gap-3 text-[12px] text-text-secondary mt-0.5">
                {job.location && <span className="flex items-center gap-1"><MapPin size={11} className="text-accent/70" /> {job.location}</span>}
                {job.salaryRange && <span className="flex items-center gap-1"><DollarSign size={11} className="text-accent/70" /> {job.salaryRange}</span>}
                {job.deadline && <span className="flex items-center gap-1"><Clock size={11} className="text-accent/70" /> {job.deadline.slice(0, 10)}</span>}
              </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleCompare} disabled={compareLoading || candidates.length < 2} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-[13px] font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
              {compareLoading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} {t('compare')}
            </button>
            <button onClick={handleAiRecommend} disabled={aiRecommendLoading || candidates.length < 2} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 text-[13px] font-medium rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50">
              {aiRecommendLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />} {t('aiRecommendation')}
            </button>
            <button onClick={handleSuggest} disabled={suggestLoading} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t('suggest')}
            </button>
            <button onClick={() => setEditModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-accent/10 hover:text-accent border border-border-subtle transition-colors">
              <Edit size={14} /> {t('editJob')}
            </button>
            <button onClick={() => exportJobPdf(job)} className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-accent/10 hover:text-accent border border-border-subtle transition-colors">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => { if (confirm(t('confirmDeleteJob'))) deleteJob.mutate(id!, { onSuccess: () => navigate('/jobs') }); }} disabled={deleteJob.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-red-500 text-[13px] font-medium rounded-lg hover:bg-red-50 border border-border-subtle transition-colors disabled:opacity-40">
              <Trash2 size={14} /> {deleteJob.isPending ? t('deletingJob') : t('deleteJob')}
            </button>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {job.requiredSkills.map(s => (
            <span key={s} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">{s}</span>
          ))}
        </div>

        {/* Description */}
        {job.description && (
          <p className="text-[13px] text-text-secondary mt-3 leading-relaxed">{loc((() => { try { const d = JSON.parse(job.description); return (d.en || d.vi) ? d : job.description; } catch { return job.description; } })())}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-500" />
            <span className="text-[11px] text-text-tertiary">{t('totalLabel')}</span>
          </div>
          <span className="text-2xl font-bold text-text-primary">{candidates.length}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-amber-500" />
            <span className="text-[11px] text-text-tertiary">{t('goldLabel')}</span>
          </div>
          <span className="text-2xl font-bold text-amber-600">{gold}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-slate-400" />
            <span className="text-[11px] text-text-tertiary">{t('silverLabel')}</span>
          </div>
          <span className="text-2xl font-bold text-slate-600">{silver}</span>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions && suggestions.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-5 text-center">
          <Users size={28} className="mx-auto mb-2 text-amber-400" />
          <p className="text-[14px] font-medium text-amber-800 mb-1">{t('noCandidatesYet')}</p>
          <p className="text-[12px] text-amber-600">{t('noCandidatesHint')}</p>
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="bg-bg-panel border border-emerald-200 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50 flex items-center justify-between">
            <h2 className="text-sm font-medium text-emerald-800 flex items-center gap-2">
              <Sparkles size={14} /> Suggested Candidates ({suggestions.length})
            </h2>
            <button onClick={() => setSuggestions(null)} className="text-text-muted hover:text-text-primary text-xs">Dismiss</button>
          </div>
          <div className="divide-y divide-border-subtle">
            {suggestions.map((s, i) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-xs text-text-muted w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{s.name}</div>
                  {s.rejected_from && (
                    <div className="text-[11px] text-red-500 mt-0.5">{t('rejectedAt', { jobs: s.rejected_from.join(', ') })}</div>
                  )}
                  <div className="text-[11px] text-text-tertiary mt-0.5">
                    {s.experience_years}y exp · Score: {Math.round(s.combined_score * 100)}%
                    {s.matched_skills.length > 0 && <span className="text-emerald-600"> · Match: {s.matched_skills.join(', ')}</span>}
                  </div>
                  {s.combined_score < 0.3 && (
                    <div className="text-[10px] text-amber-600 mt-0.5">{t('lowScoreHint')}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {s.skills.slice(0, 4).map((sk: string) => (
                    <span key={sk} className={`text-[10px] px-1.5 py-0.5 rounded ${s.matched_skills.includes(sk.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{sk}</span>
                  ))}
                </div>
                {s.status === 'suggested' && (
                  <button
                    onClick={() => handleAssign(s.id)}
                    disabled={assigning === s.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 shrink-0"
                  >
                    {assigning === s.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Assign
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendation Modal */}
      {showAiRecommend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAiRecommend(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-white" />
                <h2 className="text-[15px] font-semibold text-white">{t('aiRecommendation')}</h2>
              </div>
              <button onClick={() => setShowAiRecommend(false)} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
            </div>
            <div className="p-5 space-y-4">
              {aiRecommendLoading && <div className="text-center py-4 text-[13px] text-text-muted">{t('aiAnalyzing')}</div>}
              {aiRecommend && (
                <>
                  {aiRecommend.summary && <p className="text-[13px] text-text-secondary italic">{loc(aiRecommend.summary)}</p>}
              {aiRecommend.rankings?.map((r: any) => (
                <div key={r.rank} className="border border-border-subtle rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-white bg-accent w-6 h-6 rounded-full flex items-center justify-center">#{r.rank}</span>
                      <span className="text-[14px] font-semibold text-text-primary">{r.name}</span>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${r.action === 'invite_now' ? 'bg-emerald-100 text-emerald-700' : r.action === 'consider' ? 'bg-amber-100 text-amber-700' : r.action === 'need_more_info' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.action === 'invite_now' ? t('inviteNow') : r.action === 'consider' ? t('consider') : r.action === 'need_more_info' ? t('needMoreInfo') : t('skipCandidate')}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary mb-2">{loc(r.reason)}</p>
                  {locArr(r.strengths)?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {locArr(r.strengths).map((s: string, i: number) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">✓ {s}</span>)}
                    </div>
                  )}
                  {locArr(r.concerns)?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {locArr(r.concerns).map((c: string, i: number) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">⚠ {c}</span>)}
                    </div>
                  )}
                </div>
              ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {compareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCompareData(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-white" />
                <h2 className="text-[15px] font-semibold text-white">{t('compareTopCandidates', { count: compareData.candidates.length })}</h2>
              </div>
              <button onClick={() => setCompareData(null)} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="py-2 text-left text-text-muted font-medium">{t('candidateCol')}</th>
                    <th className="py-2 text-center text-text-muted font-medium">{t('scoreCol')}</th>
                    <th className="py-2 text-center text-text-muted font-medium">{t('experience')}</th>
                    <th className="py-2 text-center text-text-muted font-medium">{t('salaryRange')}</th>
                    <th className="py-2 text-left text-text-muted font-medium">{t('skillMatchCol')}</th>
                    <th className="py-2 text-left text-text-muted font-medium">{t('missing')}</th>
                  </tr>
                </thead>
                <tbody>
                  {compareData.candidates.map((c: any) => (
                    <tr key={c.id} className="border-b border-border-subtle/50">
                      <td className="py-2 font-medium text-text-primary">
                        <Link to={`/candidates/${c.id}`} className="hover:text-accent">{c.name}</Link>
                      </td>
                      <td className="py-2 text-center">
                        <span className={`font-bold ${c.final_score >= 80 ? 'text-emerald-600' : c.final_score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{c.final_score}</span>
                      </td>
                      <td className="py-2 text-center text-text-secondary">{c.experience_years}y</td>
                      <td className="py-2 text-center text-text-secondary">{c.expected_salary || '—'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-0.5">{c.matched_skills.map((s: string) => <span key={s} className="px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px]">{s}</span>)}</div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-0.5">{c.missing_skills.map((s: string) => <span key={s} className="px-1 py-0.5 bg-red-50 text-red-600 rounded text-[10px] line-through">{s}</span>)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Candidates Table */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-primary">{t('candidatesCount', { count: candidates.length })}</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-surface/50">
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">{t('candidateCol')}</th>
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">{t('scoreCol')}</th>
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">{t('classificationCol')}</th>
              <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">{t('status')}</th>
              <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">{t('actionsCol')}</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => {
              const aiRank = aiRecommend?.rankings?.find((r: any) => r.name === c.structuredData.name);
              return (
              <tr key={c.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface/30 transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/candidates/${c.id}`} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[10px] font-bold shrink-0">
                      {c.structuredData.name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
                    </div>
                    <span className="text-[13px] font-medium text-accent hover:underline">{c.structuredData.name}</span>
                    {c.structuredData.skill_level && <span className="ml-1.5 px-1.5 py-0 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">{c.structuredData.skill_level.level}</span>}
                    {aiRank && <span className={`ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded ${aiRank.action === 'invite_now' ? 'bg-emerald-100 text-emerald-700' : aiRank.action === 'consider' ? 'bg-amber-100 text-amber-700' : aiRank.action === 'need_more_info' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>AI #{aiRank.rank}</span>}
                  </Link>
                </td>
                <td className="px-4 py-3"><ScoreBar score={c.score?.finalScore ?? 0} /></td>
                <td className="px-4 py-3">
                  <Badge variant={c.score?.classification ?? 'neutral'}>{c.score?.classification ?? '—'}</Badge>
                  {c.score?.details?.auto_scored && <span className="ml-1 text-[10px] text-amber-500" title="Auto-scored">⚡</span>}
                </td>
                <td className="px-4 py-3"><span className="text-[12px] text-text-tertiary capitalize">{c.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleViewScore(c.id)} className="p-1.5 text-accent hover:bg-accent/10 rounded-md transition-colors" title={t('scoreCol')}>
                      <Sparkles size={15} />
                    </button>
                    {c.status !== 'pending' && (
                      <button onClick={() => setBookInterview({ candidateId: c.id, candidateName: c.structuredData.name })} className="p-1.5 text-accent hover:bg-accent/10 rounded-md transition-colors" title={t('scheduleInterview')}>
                        <CalendarCheck size={15} />
                      </button>
                    )}
                    <button onClick={() => setRemoveCandidate({ id: c.id, name: c.structuredData.name })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition-colors" title={t('removeFromJob')}>
                      <XCircle size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
        {candidates.length === 0 && <EmptyState icon={Users} title={t('noCandidatesYetJob')} description={t('candidatesWillAppear')} />}
      </div>

      {/* Outreach Modal */}
      {outreachModal && (
        <OutreachModal jobTitle={job.title} onClose={() => setOutreachModal(false)} />
      )}

      {/* Edit Job Modal */}
      {editModal && (
        <EditJobModal job={job} onClose={() => setEditModal(false)} onSave={(data) => {
          updateJob.mutate({ id: id!, data });
          setEditModal(false);
        }} />
      )}

      {/* Approve/Reject Action Modal */}
      {actionModal && !actionModal.sendEmail && (
        <ActionModal
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onConfirm={(sendEmail) => {
            if (sendEmail) {
              setActionModal({ ...actionModal, sendEmail: true });
            } else {
              updateStatus.mutate({ id: actionModal.candidateId, status: actionModal.action });
              setActionModal(null);
            }
          }}
        />
      )}

      {/* Email compose after approve/reject */}
      {actionModal?.sendEmail && (
        <EmailComposeModal
          candidateId={actionModal.candidateId}
          templateType={actionModal.action === 'approved' ? 'reminder' : 'rejection'}
          jobTitle={job.title}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onSent={() => {
            updateStatus.mutate({ id: actionModal.candidateId, status: actionModal.action });
            setActionModal(null);
          }}
        />
      )}

      {/* Score Detail Modal */}
      {(scoreDetail || scoreDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setScoreDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-white" />
                <h2 className="text-[15px] font-semibold text-white">{t('scoreCol')} — {scoreDetail?.job_title ?? '...'}</h2>
              </div>
              <button onClick={() => setScoreDetail(null)} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
            </div>
            {scoreDetailLoading ? (
              <div className="p-8 text-center text-[13px] text-text-muted">Loading...</div>
            ) : scoreDetail ? (
              <div className="p-5 space-y-4">
                {/* Main score */}
                <div className="text-center p-4 bg-accent/5 rounded-xl border border-accent/20">
                  <div className="text-[11px] text-text-muted uppercase tracking-wider">
                    {scoreDetail.final_score != null ? t('overallScore') : t('preliminaryScore')}
                  </div>
                  <div className="text-3xl font-bold text-accent mt-1">
                    {scoreDetail.final_score != null ? `${scoreDetail.final_score}/100` : `${Math.round(scoreDetail.combined_score * 100)}%`}
                  </div>
                  {scoreDetail.classification && <Badge variant={scoreDetail.classification}>{scoreDetail.classification}</Badge>}
                  {!scoreDetail.final_score && <span className="text-[11px] text-text-muted block mt-1">{t('assignToScore')}</span>}
                </div>

                {/* Breakdown - only when scored */}
                {scoreDetail.final_score != null && scoreDetail.details && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{t('skillMatch')}</div>
                        <div className="text-[10px] text-text-muted">{t('skillMatchDesc')}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.rule_scoring?.skills?.score ?? '—'}/100</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{t('experience')}</div>
                        <div className="text-[10px] text-text-muted">{scoreDetail.details.rule_scoring?.experience?.note || t('experienceCompare')}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.rule_scoring?.experience?.score ?? '—'}/100</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{t('education')}</div>
                        <div className="text-[10px] text-text-muted">{scoreDetail.details.rule_scoring?.education?.note || t('educationCompare')}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.rule_scoring?.education?.score ?? '—'}/100</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{t('aiEvaluation')}</div>
                        <div className="text-[10px] text-text-muted">{t('aiEvalDesc')}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.llm_score ?? '—'}/100</div>
                    </div>
                  </div>
                )}

                {/* Pre-scoring breakdown */}
                {scoreDetail.final_score == null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{t('skillMatchRate')}</div>
                        <div className="text-[10px] text-text-muted">{t('skillMatchRateDesc')}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{Math.round(scoreDetail.skill_score * 100)}%</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">{t('profileSimilarity')}</div>
                        <div className="text-[10px] text-text-muted">{t('profileSimilarityDesc')}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{Math.round(scoreDetail.similarity_score * 100)}%</div>
                    </div>
                  </div>
                )}

                {/* Matched skills */}
                <div>
                  <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">{t('matchedSkills', { matched: scoreDetail.matched_skills.length, total: scoreDetail.required_skills.length })}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {scoreDetail.matched_skills.map((s: string) => (
                      <span key={s} className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-medium">{s}</span>
                    ))}
                  </div>
                </div>

                {/* Missing skills */}
                {scoreDetail.missing_skills.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-red-600 uppercase tracking-wider">{t('missingSkills', { count: scoreDetail.missing_skills.length })}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {scoreDetail.missing_skills.map((s: string) => (
                        <span key={s} className="text-[11px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Assessment */}
                {scoreDetail.details?.llm_summary && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[10px] font-medium text-blue-700 uppercase">{t('aiComment')}</span>
                    <AiSummaryDisplay summary={scoreDetail.details.llm_summary} />
                  </div>
                )}

                {/* Candidate info */}
                {scoreDetail.candidate_experience_years && (
                  <div className="text-[11px] text-text-tertiary border-t border-border-subtle pt-3">
                    {t('candidateExperience', { years: scoreDetail.candidate_experience_years })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Book Interview Modal */}
      {bookInterview && (
        <BookInterviewModal
          candidateId={bookInterview.candidateId}
          candidateName={bookInterview.candidateName}
          jobId={id!}
          jobTitle={job.title}
          onClose={() => { setBookInterview(null); queryClient.refetchQueries({ queryKey: ['candidates'] }); }}
        />
      )}

      {/* Remove Candidate Modal */}
      {removeCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRemoveCandidate(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm m-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <XCircle size={24} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-semibold text-text-primary text-center mb-1">{t('removeCandidateTitle')}</h3>
            <p className="text-[13px] text-text-tertiary text-center mb-6">
              <span dangerouslySetInnerHTML={{ __html: t('removeCandidateConfirm', { name: removeCandidate.name }) }} />
            </p>
            <div className="space-y-2">
              <button onClick={async (e) => { const btn = e.currentTarget; btn.disabled = true; btn.textContent = t('removing'); await apiClient.delete(`/jobs/${id}/candidates/${removeCandidate.id}`); setRemoveCandidate(null); await queryClient.refetchQueries({ queryKey: ['candidates'] }); }} className="w-full py-2.5 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40">
                {t('removeFromJobBtn')}
              </button>
              <button onClick={() => setRemoveCandidate(null)} className="w-full py-2.5 text-[13px] font-medium text-text-secondary bg-bg-surface rounded-lg hover:bg-bg-surface/80 transition-colors">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const slots = Array.from({ length: 26 }, (_, i) => {
    const h = Math.floor(i / 2) + 7;
    const m = i % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
  });

  return (
    <div className="relative flex-1">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] text-left bg-white hover:border-accent/40 transition-colors flex items-center justify-between">
        <span className="font-medium">{value}</span>
        <Clock size={12} className="text-text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 bg-white border border-border-subtle rounded-xl shadow-lg p-2 w-[200px] max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-3 gap-1">
              {slots.map(t => (
                <button key={t} type="button" onClick={() => { onChange(t); setOpen(false); }} className={`px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors ${value === t ? 'bg-accent text-white' : 'text-text-secondary hover:bg-accent/10 hover:text-accent'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BookInterviewModal({ candidateId, candidateName, jobId, jobTitle, onClose }: {
  candidateId: string; candidateName: string; jobId: string; jobTitle: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [round, setRound] = useState(1);
  const [proposedSalary, setProposedSalary] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewType, setInterviewType] = useState('online');
  const [selectedInterviewers, setSelectedInterviewers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [availableInterviewers, setAvailableInterviewers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [emailPreview, setEmailPreview] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/users/interviewers').then(({ data }) => setAvailableInterviewers(data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (start < new Date()) { setError(t('cannotSchedulePast')); return; }
    if (end <= start) { setError(t('endAfterStart')); return; }
    setError('');
    setSaving(true);
    try {
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      await apiClient.post('/interviews', {
        candidate_id: candidateId,
        job_id: jobId,
        title: `Round ${round}: ${jobTitle}`,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
        round,
        proposed_salary: proposedSalary || null,
        meeting_link: meetingLink || null,
        interview_type: interviewType,
        interviewer_ids: selectedInterviewers.map(i => i.id),
        interviewer_emails: [],
      });
      // Get email preview
      const { data } = await apiClient.post('/interviews/email-preview', {
        candidate_id: candidateId, round, start_time: startIso, end_time: endIso, title: `Round ${round}: ${jobTitle}`, meeting_link: meetingLink || null,
      });
      setEmailPreview({ ...data, bcc: selectedInterviewers.map(i => i.email) });
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (detail) { setError(detail); } else { setDone(true); }
    }
    setSaving(false);
  };

  const [sendingEmail, setSendingEmail] = useState(false);
  const handleSendEmail = async () => {
    if (!emailPreview?.to_email) { setDone(true); return; }
    if (sendingEmail) return;
    setSendingEmail(true);
    try {
      await apiClient.post('/interviews/send-invitation', { ...emailPreview, candidate_id: candidateId });
    } catch { }
    setSendingEmail(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{t('scheduleInterviewTitle')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <CheckCircle size={36} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-[14px] font-medium text-text-primary">{t('scheduledSuccess')}</p>
            <p className="text-[12px] text-text-muted mt-1">{candidateName} — Round {round} — {date} {startTime}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-[13px] text-accent hover:bg-accent/10 rounded-lg">{t('close')}</button>
          </div>
        ) : emailPreview ? (
          <div className="p-5 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[13px] text-emerald-700">{t('interviewCreated')}</div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('candidateEmail')}</label>
              <input value={emailPreview.to_email} onChange={e => setEmailPreview({...emailPreview, to_email: e.target.value})} placeholder="candidate@email.com" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Subject</label>
              <input value={emailPreview.subject} onChange={e => setEmailPreview({...emailPreview, subject: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('emailContent')}</label>
              <textarea value={emailPreview.body} onChange={e => setEmailPreview({...emailPreview, body: e.target.value})} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" />
            </div>
            <div className="bg-bg-surface rounded-lg p-3 text-[12px] text-text-secondary">
              <p>📅 {emailPreview.date}</p>
              <p>🕐 {emailPreview.time}</p>
              {emailPreview.meeting_link && <p>🔗 {emailPreview.meeting_link}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSendEmail} disabled={!emailPreview.to_email || sendingEmail} className="flex-1 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 flex items-center justify-center gap-2">{sendingEmail ? <><Loader2 size={14} className="animate-spin" /> {t('sending')}</> : t('sendEmail')}</button>
              <button onClick={() => setDone(true)} className="flex-1 py-2.5 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-bg-surface/80">{t('skipEmail')}</button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="text-[13px] text-text-primary font-medium">{candidateName}</div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-text-muted uppercase">{t('interviewRound')}</label>
                <select value={round} onChange={e => setRound(Number(e.target.value))} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px] bg-white">
                  <option value={1}>Round 1</option>
                  <option value={2}>Round 2</option>
                  <option value={3}>Round 3</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-muted uppercase">{t('interviewFormat')}</label>
                <select value={interviewType} onChange={e => setInterviewType(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px] bg-white">
                  <option value="online">Online</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-medium text-text-muted uppercase">{t('dateLabel')}</label>
                <input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-text-muted uppercase">{t('timeLabel')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <TimeSelect value={startTime} onChange={v => { setStartTime(v); const [h] = v.split(':'); setEndTime(`${String(Math.min(+h+1,23)).padStart(2,'0')}:00`); }} />
                  <span className="text-text-muted text-[12px]">→</span>
                  <TimeSelect value={endTime} onChange={setEndTime} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Meeting Link</label>
              <input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('proposedSalary')}</label>
              <input value={proposedSalary} onChange={e => setProposedSalary(e.target.value)} placeholder="1500-2000 USD" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Interviewers *</label>
              <div className="mt-1 flex flex-wrap gap-1.5 p-2 border border-border-default rounded-lg bg-white min-h-[36px]">
                {selectedInterviewers.map(i => (
                  <span key={i.id} className="flex items-center gap-1 text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-medium">
                    {i.full_name}
                    <button type="button" onClick={() => setSelectedInterviewers(prev => prev.filter(x => x.id !== i.id))} className="hover:text-red-500">×</button>
                  </span>
                ))}
                {availableInterviewers.length > 0 ? (
                  <select value="" onChange={e => { const f = availableInterviewers.find(x => x.id === e.target.value); if (f && !selectedInterviewers.some(x => x.id === f.id)) setSelectedInterviewers(prev => [...prev, f]); }} className="flex-1 min-w-[120px] text-[12px] outline-none bg-transparent border-0">
                    <option value="">{t('selectInterviewer')}</option>
                    {availableInterviewers.filter(a => !selectedInterviewers.some(s => s.id === a.id)).map(a => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-amber-600">{t('noInterviewerHint')}</span>
                )}
              </div>
              {selectedInterviewers.length === 0 && <p className="text-[10px] text-red-500 mt-1">{t('selectInterviewerRequired')}</p>}
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('notesLabel')}</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>

            {error && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button onClick={handleSave} disabled={saving || selectedInterviewers.length === 0} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
              {saving ? t('creating') : t('scheduleRound', { round })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditJobModal({ job, onClose, onSave }: { job: any; onClose: () => void; onSave: (data: any) => void }) {
  const { data: masterData } = useMasterData();
  const { t, locale } = useI18n();
  const [title, setTitle] = useState(job.title);
  // Show description in current locale for editing
  const parsedDesc = (() => { try { const d = JSON.parse(job.description || '{}'); return typeof d === 'object' && (d.en || d.vi) ? d : null; } catch { return null; } })();
  const [description, setDescription] = useState(parsedDesc ? (parsedDesc[locale] || parsedDesc['en'] || parsedDesc['vi'] || '') : (job.description || ''));
  const [skillsList, setSkillsList] = useState<string[]>(job.requiredSkills || []);
  const [location, setLocation] = useState(job.location || '');
  const [salary, setSalary] = useState(job.salaryRange || '');
  const [deadline, setDeadline] = useState(job.deadline?.slice(0, 10) || '');
  const [category, setCategory] = useState(job.category || '');

  const [saving, setSaving] = useState(false);
  const [validationModal, setValidationModal] = useState<string[] | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = t('jobTitleRequired');
    if (!description.trim()) errors.description = t('jobDescRequired');
    if (skillsList.length === 0) errors.skills = t('skillsRequired');
    if (!category) errors.category = t('categoryRequired');
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    // Validate JD content
    try {
      await apiClient.post('/jobs/validate-content', { title, description, required_skills: skillsList });
    } catch (err: any) {
      if (err?.response?.status === 400) {
        const detail = err?.response?.data?.detail;
        if (detail === 'prompt_injection_detected') {
          setValidationModal(['prompt_injection']);
        } else if (detail?.fields) {
          setValidationModal(detail.fields);
        } else {
          setValidationModal(['title', 'description', 'skills']);
        }
        setSaving(false);
        return;
      }
    }

    // Auto-translate to the other language
    const otherLocale = locale === 'vi' ? 'en' : 'vi';
    let otherDesc = description;
    try {
      const { data } = await apiClient.post('/ai-advanced/translate', { texts: { desc: description }, target_locale: otherLocale });
      otherDesc = data?.desc || description;
    } catch {}
    const finalDesc = JSON.stringify({ [locale]: description, [otherLocale]: otherDesc });
    onSave({
      title,
      description: finalDesc,
      requiredSkills: skillsList,
      salaryRange: salary || undefined,
      location: location || undefined,
      category: category || undefined,
      deadline: deadline || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{t('editJob')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label={t('jobTitle')} value={title} onChange={setTitle} />
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('positionCategory')} *</label>
            <select value={category} onChange={e => { setCategory(e.target.value); setFormErrors(p => ({ ...p, category: '' })); }} className={`mt-1 w-full px-3 py-2 border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 bg-white ${formErrors.category ? 'border-red-400' : 'border-border-default'}`}>
              <option value="">{t('selectCategory')}</option>
              <option value="application_engineer">Application Engineer</option>
              <option value="bridge_se">Bridge System Engineer</option>
              <option value="qa_engineer">QA Engineer</option>
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
            </select>
            {formErrors.category && <p className="text-[11px] text-red-500 mt-1">{formErrors.category}</p>}
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('jobDescription')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
            <p className="text-[10px] text-text-muted mt-1">{locale === 'vi' ? 'Lưu sẽ tự động dịch sang tiếng Anh' : 'Saving will auto-translate to Vietnamese'}</p>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Skills</label>
            <TagInput value={skillsList} onChange={setSkillsList} suggestions={masterData?.skills || []} placeholder={t('typeSkillName')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('location')}</label>
              <select value={location} onChange={e => setLocation(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 bg-white">
                <option value="">{t('selectLocation')}</option>
                {(masterData?.locations || []).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('salaryRange')}</label>
              <select value={salary} onChange={e => setSalary(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 bg-white">
                <option value="">{t('selectRange')}</option>
                {(masterData?.salary_ranges || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Deadline</label>
            <div className="mt-1"><DatePicker value={deadline} onChange={setDeadline} placeholder="Select deadline" /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50">{saving ? t('saving') : t('save')}</button>
          </div>
        </div>
      </div>
      {validationModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-bg-panel rounded-2xl w-full max-w-sm shadow-xl border border-border-subtle p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <X size={24} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-semibold text-text-primary text-center mb-3">
              {validationModal.includes('prompt_injection') ? t('promptInjectionDetected') : t('jdValidationFailed')}
            </h3>
            {!validationModal.includes('prompt_injection') && (
              <ul className="space-y-2 mb-5">
                {validationModal.includes('title') && <li className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">• {t('jdFieldInvalidTitle')}</li>}
                {validationModal.includes('description') && <li className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">• {t('jdFieldInvalidDescription')}</li>}
                {validationModal.includes('skills') && <li className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">• {t('jdFieldInvalidSkills')}</li>}
              </ul>
            )}
            <div className="flex justify-center">
              <button onClick={() => setValidationModal(null)} className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
    </div>
  );
}

function exportJobPdf(job: any) {
  const html = `
    <html><head><title>${job.title} - LF Talent Scan</title>
    <style>body{font-family:system-ui;padding:40px;color:#1f1f1f;max-width:700px;margin:0 auto}
    h1{color:#ED6103;margin:0;font-size:24px}h2{font-size:14px;color:#333;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.5px}
    .header{border-bottom:2px solid #ED6103;padding-bottom:16px;margin-bottom:24px}
    .meta{color:#555;font-size:13px;margin:10px 0 0}.meta span{margin-right:16px}
    .skills{display:flex;flex-wrap:wrap;gap:6px}.skills span{background:#fff7ed;color:#ED6103;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500}
    .desc{font-size:14px;line-height:1.7;color:#333}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
    .info-item{background:#f9fafb;padding:12px;border-radius:8px}.info-label{font-size:11px;color:#888;text-transform:uppercase;margin-bottom:4px}.info-value{font-size:14px;color:#1f1f1f;font-weight:500}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
    </style></head><body>
    <div class="header">
      <h1>${job.title}</h1>
      <div class="meta">
        ${job.location ? `<span>📍 ${job.location}</span>` : ''}
        ${job.salaryRange ? `<span>💰 ${job.salaryRange}</span>` : ''}
        ${job.deadline ? `<span>📅 Deadline: ${job.deadline.slice(0,10)}</span>` : ''}
      </div>
    </div>
    ${job.description ? `<h2>Job Description</h2><div class="desc">${(() => { try { const d = JSON.parse(job.description); return (d.en || d.vi) ? (d.en + (d.vi ? '<br/><br/><em>' + d.vi + '</em>' : '')) : job.description; } catch { return job.description; } })()}</div>` : ''}
    <h2>Required Skills</h2>
    <div class="skills">${job.requiredSkills.map((s: string) => `<span>${s}</span>`).join('')}</div>
    <div class="info-grid">
      ${job.location ? `<div class="info-item"><div class="info-label">Location</div><div class="info-value">${job.location}</div></div>` : ''}
      ${job.salaryRange ? `<div class="info-item"><div class="info-label">Salary Range</div><div class="info-value">${job.salaryRange}</div></div>` : ''}
      ${job.deadline ? `<div class="info-item"><div class="info-label">Application Deadline</div><div class="info-value">${new Date(job.deadline).toLocaleDateString('en', {year:'numeric',month:'long',day:'numeric'})}</div></div>` : ''}
    </div>
    <div class="footer">LF Talent Scan · LIFULL Tech Vietnam</div>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function ActionModal({ action, onClose, onConfirm }: {
  action: 'approved' | 'rejected';
  onClose: () => void;
  onConfirm: (sendEmail: boolean) => void;
}) {
  const isApprove = action === 'approved';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm m-4 p-6" onClick={e => e.stopPropagation()}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isApprove ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {isApprove ? <CheckCircle size={24} className="text-emerald-500" /> : <XCircle size={24} className="text-red-500" />}
        </div>
        <h3 className="text-[15px] font-semibold text-text-primary text-center mb-1">
          {isApprove ? 'Approve Candidate' : 'Reject Candidate'}
        </h3>
        <p className="text-[13px] text-text-tertiary text-center mb-6">
          {isApprove ? 'Send a reminder email for the interview?' : 'Send a rejection notification email?'}
        </p>
        <div className="space-y-2">
          <button onClick={() => onConfirm(true)} className={`w-full py-2.5 text-[13px] font-medium rounded-lg transition-colors ${isApprove ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
            {isApprove ? 'Approve & Send Reminder' : 'Reject & Send Email'}
          </button>
          <button onClick={() => onConfirm(false)} className="w-full py-2.5 text-[13px] font-medium text-text-secondary bg-bg-surface rounded-lg hover:bg-bg-surface/80 transition-colors">
            {isApprove ? 'Approve Only' : 'Reject Only'}
          </button>
          <button onClick={onClose} className="w-full py-2 text-[12px] text-text-muted hover:text-text-secondary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailComposeModal({ candidateId, templateType, jobTitle, action, onClose, onSent }: {
  candidateId: string;
  templateType: string;
  jobTitle: string;
  action: 'approved' | 'rejected';
  onClose: () => void;
  onSent: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [greeting, setGreeting] = useState('');
  const [body, setBody] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [closing, setClosing] = useState('');

  useState(() => {
    apiClient.post('/outreach/preview', { candidate_id: candidateId, template_type: templateType })
      .then(({ data }) => {
        setGreeting(data.greeting);
        setBody(data.body);
        setHighlights(data.highlights || []);
        setTips(data.tips || []);
        setFeedback(data.feedback || '');
        setClosing(data.closing);
        setSubject(data.subject);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load template'); setLoading(false); });
  });

  const handleSend = async () => {
    if (!toEmail.trim()) { setError('Email address is required'); return; }
    setSending(true);
    setError('');
    try {
      await apiClient.post('/outreach/send', {
        candidate_id: candidateId,
        to_email: toEmail,
        template_type: templateType,
        subject, greeting, body, highlights, tips, feedback, closing,
        job_title: jobTitle,
      });
      onSent();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to send');
      setSending(false);
    }
  };

  const isApprove = action === 'approved';
  const btnLabel = isApprove ? 'Approve & Send' : 'Reject & Send';
  const btnClass = isApprove ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-white" />
            <h2 className="text-[15px] font-semibold text-white">{isApprove ? 'Reminder Email' : 'Rejection Email'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X size={18} className="text-white/80" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[13px] text-text-muted">Loading template...</div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">To</label>
              <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="candidate@email.com" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Greeting</label>
              <input value={greeting} onChange={e => setGreeting(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
            </div>
            {templateType === 'rejection' && (
              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Feedback (optional)</label>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} placeholder="Constructive feedback..." className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
              </div>
            )}
            {templateType === 'reminder' && (
              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Tips (one per line)</label>
                <textarea value={tips.join('\n')} onChange={e => setTips(e.target.value.split('\n').filter(Boolean))} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
              </div>
            )}
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Closing</label>
              <textarea value={closing} onChange={e => setClosing(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
            </div>

            {error && <p className="text-[13px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end pt-2">
              <button onClick={handleSend} disabled={sending} className={`flex items-center gap-2 px-5 py-2.5 text-white text-[13px] font-medium rounded-lg disabled:opacity-40 transition-colors ${btnClass}`}>
                <Send size={14} />
                {sending ? 'Sending...' : btnLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OutreachModal({ jobTitle, onClose }: { jobTitle: string; onClose: () => void }) {
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState(`🚀 Exciting opportunity: ${jobTitle} at LIFULL Tech Vietnam`);
  const [greeting, setGreeting] = useState('Hi there! 👋');
  const [body, setBody] = useState("We came across your profile and were impressed by your background. We'd love to explore an opportunity with you.");
  const [highlights, setHighlights] = useState(`Strong match for ${jobTitle}`);
  const [closing, setClosing] = useState('We look forward to connecting!');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!toEmail.trim()) { setError('Email address is required'); return; }
    setSending(true);
    setError('');
    try {
      await apiClient.post('/outreach/send', {
        candidate_id: null,
        to_email: toEmail,
        template_type: 'outreach',
        subject,
        greeting,
        body,
        highlights: highlights.split('\n').filter(Boolean),
        closing,
        job_title: jobTitle,
      });
      setSent(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-white" />
            <h2 className="text-[15px] font-semibold text-white">Outreach Email</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X size={18} className="text-white/80" />
          </button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <CheckCircle size={36} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-[15px] font-medium text-text-primary">Email sent successfully!</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-[13px] text-accent hover:bg-accent/10 rounded-lg transition-colors">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">To</label>
              <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="candidate@email.com" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Greeting</label>
              <input value={greeting} onChange={e => setGreeting(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Highlights (one per line)</label>
              <textarea value={highlights} onChange={e => setHighlights(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Closing</label>
              <textarea value={closing} onChange={e => setClosing(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
            </div>

            {error && <p className="text-[13px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end pt-2">
              <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors">
                <Send size={14} />
                {sending ? 'Sending...' : 'Send Outreach'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
