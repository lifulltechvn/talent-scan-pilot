import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, DollarSign, Users, Trophy, Edit, Trash2, Briefcase, Mail, X, Send, CheckCircle, XCircle, ClipboardCheck, Sparkles, Loader2, UserPlus, Download } from 'lucide-react';
import { useJob, useUpdateJob, useDeleteJob } from '../hooks/useJobs';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { getJobIcon } from '@/shared/utils/job-icon';
import { useCandidates, useUpdateCandidateStatus } from '@/features/candidates/hooks/useCandidates';
import { useI18n } from '@/shared/i18n';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import { DatePicker } from '@/shared/components/ui/DatePicker';
import { apiClient } from '@/data/api/client';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading: loadingJ } = useJob(id!);
  const { data: allCandidates, isLoading: loadingC } = useCandidates();
  const { t } = useI18n();
  const [outreachModal, setOutreachModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [quizModal, setQuizModal] = useState(false);
  const updateStatus = useUpdateCandidateStatus();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [actionModal, setActionModal] = useState<{ candidateId: string; action: 'approved' | 'rejected'; sendEmail?: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [scoreDetail, setScoreDetail] = useState<any | null>(null);
  const [scoreDetailLoading, setScoreDetailLoading] = useState(false);

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
      // Refresh candidates list to show newly assigned candidate
      window.location.reload();
    } catch { /* ignore */ }
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

  if (loadingJ || loadingC) return <LoadingSkeleton rows={3} />;
  if (!job) return <EmptyState icon={Briefcase} title="Job not found" description="This job may have been removed or the link is invalid" action={{ label: 'Back to Jobs', onClick: () => window.history.back() }} />;

  const candidates = allCandidates?.filter(c => c.jobId === job.id) ?? [];
  const gold = candidates.filter(c => c.score?.classification === 'gold').length;
  const silver = candidates.filter(c => c.score?.classification === 'silver').length;

  return (
    <div>
      <button onClick={() => window.history.back()} className="text-[13px] text-text-tertiary hover:text-accent flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back
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
          <div className="flex gap-2">
            <button onClick={handleSuggest} disabled={suggestLoading} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Suggest
            </button>
            <button onClick={() => setOutreachModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors">
              <Mail size={14} /> Outreach
            </button>
            <button onClick={() => setEditModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-accent/10 hover:text-accent border border-border-subtle transition-colors">
              <Edit size={14} /> Edit Job
            </button>
            <button onClick={() => exportJobPdf(job, candidates)} className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-accent/10 hover:text-accent border border-border-subtle transition-colors">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => { if (confirm('Delete this job?')) deleteJob.mutate(id!, { onSuccess: () => navigate('/jobs') }); }} className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface text-red-500 text-[13px] font-medium rounded-lg hover:bg-red-50 border border-border-subtle transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          </div>
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

      {/* Suggestions */}
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
                  <div className="text-[11px] text-text-tertiary mt-0.5">
                    {s.experience_years}y exp · Score: {Math.round(s.combined_score * 100)}%
                    {s.matched_skills.length > 0 && <span className="text-emerald-600"> · Match: {s.matched_skills.join(', ')}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {s.skills.slice(0, 4).map((sk: string) => (
                    <span key={sk} className={`text-[10px] px-1.5 py-0.5 rounded ${s.matched_skills.includes(sk.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{sk}</span>
                  ))}
                </div>
                {s.status === 'suggested' ? (
                  <button
                    onClick={() => handleAssign(s.id)}
                    disabled={assigning === s.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 shrink-0"
                  >
                    {assigning === s.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Assign
                  </button>
                ) : (
                  <button
                    onClick={() => { updateStatus.mutate({ id: s.id, status: 'approved' }); setSuggestions(prev => prev?.filter(x => x.id !== s.id) ?? null); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shrink-0"
                  >
                    <CheckCircle size={12} /> Apply
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
              <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">Actions</th>
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
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleViewScore(c.id)} className="p-1.5 text-accent hover:bg-accent/10 rounded-md transition-colors" title="View Score Detail">
                      <Sparkles size={15} />
                    </button>
                    {c.status === 'new' && (
                      <>
                        <button onClick={() => setActionModal({ candidateId: c.id, action: 'approved' })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Approve">
                          <CheckCircle size={15} />
                        </button>
                        <button onClick={() => setActionModal({ candidateId: c.id, action: 'rejected' })} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Reject">
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <EmptyState icon={Users} title="No candidates yet" description="Candidates will appear here after CV scanning" />}
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

      {/* Quiz Modal */}
      {quizModal && (
        <QuizModal candidates={candidates} onClose={() => setQuizModal(false)} />
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
            <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-white" />
                <h2 className="text-[15px] font-semibold text-white">Score Detail — {scoreDetail?.job_title ?? '...'}</h2>
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
                    {scoreDetail.final_score != null ? 'Điểm tổng hợp' : 'Điểm khớp sơ bộ'}
                  </div>
                  <div className="text-3xl font-bold text-accent mt-1">
                    {scoreDetail.final_score != null ? `${scoreDetail.final_score}/100` : `${Math.round(scoreDetail.combined_score * 100)}%`}
                  </div>
                  {scoreDetail.classification && <Badge variant={scoreDetail.classification}>{scoreDetail.classification}</Badge>}
                  {!scoreDetail.final_score && <span className="text-[11px] text-text-muted block mt-1">Ấn Assign để chạy chấm điểm chi tiết</span>}
                </div>

                {/* Breakdown - only when scored */}
                {scoreDetail.final_score != null && scoreDetail.details && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">Kỹ năng phù hợp</div>
                        <div className="text-[10px] text-text-muted">Ứng viên có bao nhiêu skills mà job yêu cầu</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.rule_scoring?.skills?.score ?? '—'}/100</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">Kinh nghiệm</div>
                        <div className="text-[10px] text-text-muted">{scoreDetail.details.rule_scoring?.experience?.note || 'So sánh số năm kinh nghiệm với yêu cầu'}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.rule_scoring?.experience?.score ?? '—'}/100</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">Học vấn</div>
                        <div className="text-[10px] text-text-muted">{scoreDetail.details.rule_scoring?.education?.note || 'So sánh bằng cấp với yêu cầu'}</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{scoreDetail.details.rule_scoring?.education?.score ?? '—'}/100</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">Đánh giá AI</div>
                        <div className="text-[10px] text-text-muted">AI phân tích tổng quan mức độ phù hợp</div>
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
                        <div className="text-[12px] font-medium text-text-primary">Kỹ năng khớp</div>
                        <div className="text-[10px] text-text-muted">Tỷ lệ skills ứng viên trùng với yêu cầu job</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{Math.round(scoreDetail.skill_score * 100)}%</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <div className="text-[12px] font-medium text-text-primary">Độ tương đồng hồ sơ</div>
                        <div className="text-[10px] text-text-muted">So sánh nội dung CV với mô tả job bằng AI embedding</div>
                      </div>
                      <div className="text-sm font-bold text-text-primary">{Math.round(scoreDetail.similarity_score * 100)}%</div>
                    </div>
                  </div>
                )}

                {/* Matched skills */}
                <div>
                  <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Skills phù hợp ({scoreDetail.matched_skills.length}/{scoreDetail.required_skills.length})</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {scoreDetail.matched_skills.map((s: string) => (
                      <span key={s} className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-medium">{s}</span>
                    ))}
                  </div>
                </div>

                {/* Missing skills */}
                {scoreDetail.missing_skills.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-red-600 uppercase tracking-wider">Skills còn thiếu ({scoreDetail.missing_skills.length})</span>
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
                    <span className="text-[10px] font-medium text-blue-700 uppercase">Nhận xét từ AI</span>
                    <p className="text-[12px] text-blue-800 mt-1">{scoreDetail.details.llm_summary}</p>
                  </div>
                )}

                {/* Candidate info */}
                {scoreDetail.candidate_experience_years && (
                  <div className="text-[11px] text-text-tertiary border-t border-border-subtle pt-3">
                    Kinh nghiệm ứng viên: {scoreDetail.candidate_experience_years} năm
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function QuizModal({ candidates, onClose }: { candidates: any[]; onClose: () => void }) {
  const [reason, setReason] = useState('insufficient_data');
  const [selected, setSelected] = useState<string[]>(candidates.filter(c => c.status === 'new').map(c => c.id));
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ name: string; token: string }[]>([]);

  const handleGenerate = async () => {
    setSending(true);
    const generated: { name: string; token: string }[] = [];
    for (const cid of selected) {
      try {
        const { data } = await apiClient.post('/quiz/generate', { candidate_id: cid, reason });
        const c = candidates.find(x => x.id === cid);
        generated.push({ name: c?.structuredData.name || cid, token: data.token });
      } catch { /* skip */ }
    }
    setResults(generated);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-white" />
            <h2 className="text-[15px] font-semibold text-white">Generate Quiz</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {results.length > 0 ? (
          <div className="p-5">
            <p className="text-[14px] font-medium text-text-primary mb-3">✅ {results.length} quiz(es) generated</p>
            <div className="space-y-2">
              {results.map(r => (
                <div key={r.token} className="flex items-center justify-between p-3 bg-bg-surface rounded-lg">
                  <span className="text-[13px] text-text-primary">{r.name}</span>
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/quiz/${r.token}`)} className="text-[12px] text-accent hover:underline">Copy link</button>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="mt-4 w-full py-2.5 text-[13px] font-medium text-text-secondary bg-bg-surface rounded-lg hover:bg-bg-surface/80">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Reason */}
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40">
                <option value="insufficient_data">Insufficient data — verify CV claims</option>
                <option value="suspected_ai_cv">Suspected AI-generated CV</option>
              </select>
            </div>

            {/* Candidate selection */}
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Candidates ({selected.length}/{candidates.length})</label>
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                {candidates.map(c => (
                  <label key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-surface cursor-pointer">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} className="w-4 h-4 accent-[var(--color-accent)]" />
                    <span className="text-[13px] text-text-primary">{c.structuredData.name}</span>
                    <span className="text-[11px] text-text-muted ml-auto capitalize">{c.status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={handleGenerate} disabled={sending || selected.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors">
                <ClipboardCheck size={14} />
                {sending ? 'Generating...' : `Generate ${selected.length} Quiz(es)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditJobModal({ job, onClose, onSave }: { job: any; onClose: () => void; onSave: (data: any) => void }) {
  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description || '');
  const [skills, setSkills] = useState(job.requiredSkills.join(', '));
  const [location, setLocation] = useState(job.location || '');
  const [salary, setSalary] = useState(job.salaryRange || '');
  const [deadline, setDeadline] = useState(job.deadline?.slice(0, 10) || '');

  const handleSave = () => {
    onSave({
      title,
      description,
      requiredSkills: skills.split(',').map((s: string) => s.trim()).filter(Boolean),
      salaryRange: salary || undefined,
      location: location || undefined,
      deadline: deadline || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{t("edit")}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Title" value={title} onChange={setTitle} />
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
          </div>
          <Field label="Skills (comma separated)" value={skills} onChange={setSkills} />
          <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. Ho Chi Minh City" />
          <Field label="Salary Range" value={salary} onChange={setSalary} placeholder="e.g. 25-40M VND" />
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">Deadline</label>
            <div className="mt-1"><DatePicker value={deadline} onChange={setDeadline} placeholder="Select deadline" /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSave} className="px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors">{t("save")}</button>
          </div>
        </div>
      </div>
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

function exportJobPdf(job: any, candidates: any[]) {
  const html = `
    <html><head><title>${job.title}</title>
    <style>body{font-family:system-ui;padding:40px;color:#1f1f1f}h1{color:#ED6103;margin:0}
    .meta{color:#666;font-size:13px;margin:8px 0 20px}.skills span{background:#fff7ed;color:#ED6103;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:6px}
    table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
    th{background:#f9f9f9;font-size:11px;text-transform:uppercase;color:#666}</style></head><body>
    <h1>${job.title}</h1>
    <div class="meta">${[job.location, job.salaryRange, job.deadline?.slice(0,10)].filter(Boolean).join(' · ')}</div>
    <p>${job.description || ''}</p>
    <div class="skills">${job.requiredSkills.map((s: string) => `<span>${s}</span>`).join(' ')}</div>
    <table><thead><tr><th>Candidate</th><th>Skills</th><th>Score</th><th>Status</th></tr></thead><tbody>
    ${candidates.map(c => `<tr><td>${c.structuredData.name}</td><td>${c.structuredData.skills.slice(0,4).join(', ')}</td><td>${c.score?.finalScore ?? '—'}</td><td>${c.status}</td></tr>`).join('')}
    </tbody></table>
    <p style="margin-top:30px;font-size:11px;color:#999">Generated by LF Talent Scan · ${new Date().toLocaleDateString()}</p>
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
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
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
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
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
