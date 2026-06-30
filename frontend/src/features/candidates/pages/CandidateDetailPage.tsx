import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, GraduationCap, Languages, DollarSign, Sparkles, Users, Clock, Download, CheckCircle, XCircle, Award, MapPin, Heart, ChevronLeft, ChevronRight, Trash2, Mail, Phone, Eye, Globe, AlertTriangle, Shield, Loader2, Cake } from 'lucide-react';
import { useCandidate, useCandidates, useUpdateCandidateStatus } from '../hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import { CandidateTimeline } from '../components/CandidateTimeline';
import { EmailCompose } from '@/features/outreach/components/EmailCompose';
import { useI18n } from '@/shared/i18n';
import { G_CRITERIA, CATEGORY_TITLES } from '@/data/g-criteria';
import { apiClient } from '@/data/api/client';
import { candidateApiRepo } from '@/data/repositories/candidates.api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useToast } from '@/shared/components/ui/Toast';
import { useConfirm } from '@/shared/components/ui/ConfirmDialog';

function EditCandidateData({ candidateId, data }: { candidateId: string; data: any }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.name || '');
  const [skills, setSkills] = useState((data.skills || []).join(', '));
  const [expYears, setExpYears] = useState(String(data.experience_years || 0));
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="w-full text-[11px] text-accent hover:underline py-1">
        {t("editData")}
      </button>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/candidates/${candidateId}/data`, {
        name,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        experience_years: parseInt(expYears) || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['candidates', candidateId] });
      toast('success', t("dataUpdated"));
      setEditing(false);
    } catch { toast('error', t("dataUpdateFailed")); }
    setSaving(false);
  };

  return (
    <div className="border border-accent/30 rounded-lg p-3 space-y-2 bg-accent/5">
      <div>
        <label className="text-[10px] text-text-muted uppercase">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full px-2 py-1 border border-border-subtle rounded text-[12px] mt-0.5" />
      </div>
      <div>
        <label className="text-[10px] text-text-muted uppercase">{t("skills")}</label>
        <input value={skills} onChange={e => setSkills(e.target.value)} className="w-full px-2 py-1 border border-border-subtle rounded text-[12px] mt-0.5" />
      </div>
      <div>
        <label className="text-[10px] text-text-muted uppercase">{t("experience")}</label>
        <input type="number" value={expYears} onChange={e => setExpYears(e.target.value)} className="w-full px-2 py-1 border border-border-subtle rounded text-[12px] mt-0.5" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="flex-1 py-1.5 text-[11px] font-medium bg-accent text-white rounded-lg disabled:opacity-50">{saving ? '...' : t("save")}</button>
        <button onClick={() => setEditing(false)} className="flex-1 py-1.5 text-[11px] font-medium text-text-muted border border-border-subtle rounded-lg">{t("cancel")}</button>
      </div>
    </div>
  );
}

function CandidateNotes({ candidateId }: { candidateId: string }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: notes = [] } = useQuery<{ id: string; text: string; author: string; created_at: string }[]>({
    queryKey: ['notes', candidateId],
    queryFn: () => apiClient.get(`/candidates/${candidateId}/notes`).then(r => r.data),
  });
  const addNote = useMutation({
    mutationFn: (noteText: string) => apiClient.post(`/candidates/${candidateId}/notes`, { text: noteText }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes', candidateId] }); setText(''); },
  });

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={15} className="text-accent" />
        <h2 className="text-sm font-medium text-text-primary">{t("notes")}</h2>
      </div>
      <div className="flex gap-2 mb-3">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && text.trim() && addNote.mutate(text)} placeholder={t("addNote")} className="flex-1 px-3 py-1.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
        <button onClick={() => text.trim() && addNote.mutate(text)} disabled={!text.trim()} className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg disabled:opacity-50">{t("add")}</button>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {notes.map(n => (
          <div key={n.id} className="text-xs bg-bg-surface rounded-lg px-3 py-2">
            <span className="text-text-primary">{n.text}</span>
            <div className="text-text-muted mt-0.5">{n.author} · {new Date(n.created_at).toLocaleDateString()}</div>
          </div>
        ))}
        {notes.length === 0 && <p className="text-xs text-text-muted text-center py-2">{t("noNotes")}</p>}
      </div>
    </div>
  );
}

function CandidateAvatar({ candidateId, avatar, name }: { candidateId: string; avatar: string | null; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!avatar) return;
    apiClient.get(`/candidates/${candidateId}/avatar`, { responseType: 'blob' })
      .then(({ data }) => setSrc(URL.createObjectURL(data)))
      .catch(() => {});
    return () => { if (src) URL.revokeObjectURL(src); };
  }, [candidateId, avatar]);

  if (src) return (
    <>
      <img src={src} alt={name} onClick={() => setExpanded(true)} className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-md cursor-pointer hover:scale-105 transition-transform shrink-0" />
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setExpanded(false)}>
          <img src={src} alt={name} className="max-w-[80vw] max-h-[80vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </>
  );
  return (
    <div className="w-20 h-20 rounded-xl bg-white/80 border-2 border-white shadow-md flex items-center justify-center text-accent text-2xl font-bold shrink-0">
      {name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
    </div>
  );
}

function CvAuthenticityButton({ candidateId, cachedResult }: { candidateId: string; cachedResult?: any }) {
  const [result, setResult] = useState<any>(cachedResult || null);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const { t, locale } = useI18n();

  const handleCheck = async () => {
    if (result && !result.error && result.verdict !== 'unknown') {
      setShowPopup(true);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post(`/ai-advanced/cv-authenticity/${candidateId}?force=false`);
      setResult(data);
      setShowPopup(true);
    } catch { setResult({ error: true }); }
    setLoading(false);
  };

  return (
    <>
      <button onClick={handleCheck} disabled={loading} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-40">
        {loading ? <><Loader2 size={13} className="animate-spin" /> {t("checking")}</> : <><Shield size={13} /> {t("checkCvAi")}</>}
      </button>
      {showPopup && result && !result.error && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setShowPopup(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">{t("checkCvAi")}</h3>
              <button onClick={() => setShowPopup(false)} className="text-text-muted hover:text-text-primary">
                <XCircle size={16} />
              </button>
            </div>
            <div className="flex items-center justify-center mb-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${result.score >= 80 ? 'bg-emerald-100' : result.score >= 50 ? 'bg-amber-100' : 'bg-red-100'}`}>
                <span className={`text-[24px] font-bold ${result.score >= 80 ? 'text-emerald-600' : result.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{result.score}%</span>
              </div>
            </div>
            <p className={`text-center text-[13px] font-medium mb-3 ${result.score >= 80 ? 'text-emerald-700' : result.score >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
              {result.score >= 80 ? t("cvAuthentic") : result.score >= 50 ? t("cvSuspicious") : t("cvLikelyAi")}
            </p>
            {result.reasons && (
              <ul className="space-y-1 mb-3">
                {(Array.isArray(result.reasons) ? result.reasons : (result.reasons[locale === 'ja' ? 'en' : locale] || result.reasons['en'] || result.reasons['vi'] || [])).map((r: string, i: number) => (
                  <li key={i} className="text-[11px] text-text-secondary flex items-start gap-1.5"><span className="mt-0.5">•</span>{r}</li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowPopup(false)} className="w-full py-2 text-[12px] font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5">{t("close")}</button>
          </div>
        </div>
      , document.body)}
    </>
  );
}

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidates', id],
    queryFn: () => candidateApiRepo.getById(id!),
    staleTime: 0,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 5000;
      const sd = d.structuredData || d.structured_data;
      // Stop once enrichment + translation complete for current locale
      if (!sd?.experience?.length || !sd?.insight?.strengths) return 5000;
      if (sd?.skill_level?.reason && !sd.skill_level.reason.vi) return 5000;
      return false;
    },
  });
  const { data: allCandidates } = useCandidates();
  const updateStatus = useUpdateCandidateStatus();
  useEffect(() => { updateStatus.reset(); }, [id]);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [cvBlobUrl, setCvBlobUrl] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [blacklistModal, setBlacklistModal] = useState(false);

  // Find prev/next candidates
  const candidateIds = allCandidates?.map(c => c.id) ?? [];
  const currentIdx = candidateIds.indexOf(id!);
  const prevId = currentIdx > 0 ? candidateIds[currentIdx - 1] : null;
  const nextId = currentIdx < candidateIds.length - 1 ? candidateIds[currentIdx + 1] : null;

  useEffect(() => {
    // Removed auto-mark as reviewed — HR should explicitly mark
  }, [candidate?.id]);

  // Helper to get localized text from i18n object or plain string
  const d = candidate?.structuredData ?? {} as any;
  const c = (v: any) => (!v || v === '<UNKNOWN>' || v === 'null' || v === 'N/A') ? '' : v;
  const clean = (v: any) => (!v || v === '<UNKNOWN>' || v === 'null' || v === 'N/A') ? '' : v;

  const isJa = (s: string) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(s);
  const loc = (val: any, viVal?: any) => {
    if (!val && !viVal) return '';
    // If explicit VI value provided and locale is VI, use it
    if (viVal && locale === 'vi') return viVal;
    // If val is object with locale keys
    if (typeof val === 'object' && !Array.isArray(val)) {
      const target = locale === 'vi' ? 'vi' : 'en';
      const result = val[target] || val['en'] || val['vi'] || '';
      if (typeof result === 'string' && isJa(result) && locale !== 'ja') return val['vi'] || val['en'] || result;
      return result;
    }
    // Plain string: if Japanese and locale != ja, use viVal
    if (typeof val === 'string' && isJa(val) && locale !== 'ja') return viVal || val;
    return val || '';
  };

  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (!candidate) return <EmptyState icon={Users} title={t("candidateNotFound")} description={t("candidateNotFoundDesc")} action={{ label: t("backToCandidates"), onClick: () => window.history.back() }} />;

  const score = candidate.score;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => window.history.back()} className="text-[13px] text-text-tertiary hover:text-accent flex items-center gap-1">
          <ArrowLeft size={14} /> {t("back")}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-muted">{currentIdx + 1} / {candidateIds.length}</span>
          <button onClick={() => prevId && navigate(`/candidates/${prevId}`)} disabled={!prevId} className="w-7 h-7 rounded-lg border border-border-subtle flex items-center justify-center hover:bg-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={14} className="text-text-secondary" />
          </button>
          <button onClick={() => nextId && navigate(`/candidates/${nextId}`)} disabled={!nextId} className="w-7 h-7 rounded-lg border border-border-subtle flex items-center justify-center hover:bg-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={14} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Sidebar Layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Main content */}
        <div className="flex-1 min-w-0">

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-5">
        {/* Missing Info Warning */}
        <MissingInfoPanel data={d} />

        {/* Skill Level Assessment */}
        {d.skill_level ? (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">📊</span>
              <h2 className="text-sm font-medium text-text-primary">{t("skillLevelAssessment")}</h2>
            </div>
            <span className="text-[11px] text-text-muted capitalize bg-bg-secondary px-2 py-0.5 rounded">{CATEGORY_TITLES[d.skill_level.category]?.[locale] || d.skill_level.category?.replace('_', ' ')}</span>
          </div>

          {/* G Level Badge + Progress */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-[22px] font-bold">{d.skill_level.level}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-2">
                {["G0","G1","G2","G3","G4","G5","G6"].map(g => (
                  <div key={g} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`w-full h-2.5 rounded-full transition-all ${
                      g <= d.skill_level!.level ? "bg-gradient-to-r from-purple-500 to-indigo-500 shadow-sm" : "bg-bg-tertiary"
                    }`} />
                    <span className={`text-[9px] ${g === d.skill_level!.level ? "font-bold text-purple-600" : "text-text-muted"}`}>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Level Description */}
          {G_CRITERIA[d.skill_level.category]?.[d.skill_level.level] && (
            <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">{t("levelStandard", { level: d.skill_level.level })}</span>
              </div>
              <p className="text-[12px] text-purple-800 leading-relaxed">{G_CRITERIA[d.skill_level.category][d.skill_level.level][locale === 'ja' ? 'en' : locale as 'en' | 'vi']}</p>
            </div>
          )}

          {/* AI Reason */}
          {d.skill_level.reason && ((locale === 'vi' ? d.skill_level.reason.vi : d.skill_level.reason.en)) ? (
            <div className="mb-3 p-3 bg-bg-secondary/60 rounded-lg border border-border-subtle/50">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">{t("aiReason")}</span>
              </div>
              <p className="text-[12px] text-text-secondary leading-relaxed">{locale === 'vi' ? d.skill_level.reason.vi : d.skill_level.reason.en}</p>
            </div>
          ) : (
            <div className="mb-3 p-3 bg-bg-secondary/30 rounded-lg border border-border-subtle/30 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-purple-400" />
              <span className="text-[11px] text-text-muted">{t("loadingAssessment")}</span>
            </div>
          )}

          {/* Domains */}
          {d.skill_level.domains && d.skill_level.domains.length > 0 && (
            <div className="pt-3 border-t border-border-subtle/50">
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t("assessmentDomains")}</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {d.skill_level.domains.map((domain, i) => (
                  <span key={i} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">{domain.split('(')[0].trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        ) : (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse" />
              <div className="h-2 bg-gray-100 rounded w-2/3 animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] text-text-muted mt-3">{t('analyzingSkillLevel')}</p>
        </div>
        )}

        {/* AI Insight */}
        {d.insight && (d.insight.strengths || d.insight.weaknesses) ? (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-text-primary">{t("aiInsight")}</h2>
          </div>
          <div className="space-y-3">
            {d.insight.strengths && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">{t("strengths")}</span>
              <p className="text-[13px] text-emerald-800 mt-1">{loc(d.insight.strengths, d.insight.strengths_vi)}</p>
            </div>
            )}
            {d.insight.weaknesses && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">{t("weaknesses")}</span>
              <p className="text-[13px] text-amber-800 mt-1">{loc(d.insight.weaknesses, d.insight.weaknesses_vi)}</p>
            </div>
            )}
            {d.insight.recommendation && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">{t("recommendation")}</span>
              <p className="text-[13px] text-blue-800 mt-1">{loc(d.insight.recommendation)}</p>
            </div>
            )}
            {/* Culture Fit */}
            {d._ai_culture_fit && (
            <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
              <span className="text-[11px] font-medium text-violet-700 uppercase tracking-wider">{t("cultureFit")}</span>
              <p className="text-[13px] text-violet-800 mt-1">
                {d._ai_culture_fit.retention_risk === 'low' ? t("retentionRiskLow") : d._ai_culture_fit.retention_risk === 'medium' ? t("retentionRiskMedium") : t("retentionRiskHigh")}
                {d._ai_culture_fit.work_style && ` · ${d._ai_culture_fit.work_style === 'leader' ? t("workStyleLeader") : d._ai_culture_fit.work_style === 'individual_contributor' ? t("workStyleIc") : t("workStyleBoth")}`}
              </p>
              {d._ai_culture_fit.recommendation && (
                <p className="text-[12px] text-violet-700 mt-0.5">💡 {loc(d._ai_culture_fit.recommendation)}</p>
              )}
            </div>
            )}
          </div>
        </div>
        ) : (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 size={14} className="animate-spin text-accent" />
            <span className="text-sm font-medium text-text-primary">AI Insight</span>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
          </div>
          <p className="text-[10px] text-text-muted mt-3">{t('analyzingDetails')}</p>
        </div>
        )}

        {/* Profile */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h2 className="text-sm font-medium text-text-primary mb-4">{t("profile")}</h2>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t("skills")}</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {Array.isArray(d.skills) && d.skills.map(s => <span key={s} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">{s}</span>)}
              </div>
            </div>
            {Array.isArray(d.experience) && d.experience.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Briefcase size={13} className="text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t("experience")}</span>
                </div>
                {d.experience.map((exp: any, i: number) => (
                  <div key={i} className="ml-5 py-1.5 border-l-2 border-border-subtle pl-3 mb-1">
                    <div className="text-[13px] font-medium text-text-primary">{loc(exp.role, exp.role_vi)}</div>
                    <div className="text-[12px] text-text-tertiary">{c(exp.company)}{exp.years ? ` · ${exp.years}y` : c(exp.duration) ? ` · ${c(exp.duration)}` : ''}</div>
                    {(exp.description || exp.description_vi) && <div className="text-[11px] text-text-secondary mt-0.5">{loc(exp.description, exp.description_vi)}</div>}
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(d.education) && d.education.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <GraduationCap size={13} className="text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t("education")}</span>
                </div>
                {d.education.map((edu, i) => (
                  <div key={i} className="ml-5 py-1">
                    <div className="text-[13px] text-text-primary">{c(loc(edu.degree, edu.degree_vi))}{c(edu.major) ? ` in ${c(loc(edu.major, edu.major_vi))}` : ''}</div>
                    <div className="text-[12px] text-text-tertiary">{c(edu.school)}{c(edu.year) ? ` · ${c(edu.year)}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(d.certifications) && d.certifications.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Award size={13} className="text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t("certifications")}</span>
                </div>
                {d.certifications.map((cert: any, i: number) => (
                  <div key={i} className="ml-5 py-1">
                    <div className="text-[13px] text-text-primary">{cert.name}</div>
                    <div className="text-[12px] text-text-tertiary">{cert.issuer && cert.issuer !== '<UNKNOWN>' ? cert.issuer : ''}{cert.year && cert.year !== '<UNKNOWN>' ? ` · ${cert.year}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {d.hometown && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-text-muted" />
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider mr-2">{t("address")}</span>
                <span className="text-[13px] text-text-primary">{d.hometown}</span>
              </div>
            )}
            {Array.isArray(d.activities) && d.activities.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Heart size={13} className="text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t("activities")}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-5">
                  {d.activities.map((a: string, i: number) => (
                    <span key={i} className="text-[11px] bg-bg-surface text-text-secondary px-2 py-0.5 rounded">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(d.languages) && d.languages.filter(l => l.language && l.language !== 'null').length > 0 && (
            <div className="flex items-center gap-1.5">
              <Languages size={13} className="text-text-muted" />
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider mr-2">{t("languages")}</span>
              {d.languages.filter(l => l.language && l.language !== 'null').map(l => (
                <span key={l.language} className="text-[11px] bg-bg-surface text-text-secondary px-2 py-0.5 rounded">{l.language}{l.level && l.level !== '<UNKNOWN>' && l.level !== 'null' ? ` (${l.level})` : ''}</span>
              ))}
            </div>
            )}
            {d.expectedSalary && (
              <div className="flex items-center gap-1.5">
                <DollarSign size={13} className="text-text-muted" />
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider mr-2">{t("expected")}</span>
                <span className="text-[13px] text-text-primary">{d.expectedSalary}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matched Jobs (Smart Pool) */}
      {candidate.status !== 'blacklisted' && (
        <MatchedJobsSection candidateId={id!} hasAssignedJob={!!candidate.jobId} sourceJobId={candidate.sourceJobId} sourceJobTitle={candidate.sourceJobTitle} />
      )}

      {/* Timeline */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mt-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-accent" />
          <h2 className="text-sm font-medium text-text-primary">{t("timeline")}</h2>
        </div>
        <CandidateTimeline candidateId={id!} />
      </div>

      {/* Notes */}
      <div className="mt-5">
        <CandidateNotes candidateId={id!} />
      </div>

        </div>{/* end left */}

        {/* Right: Profile Card (Sidebar) */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 sticky top-4">
            <div className="flex flex-col items-center text-center mb-4">
              <CandidateAvatar candidateId={id!} avatar={d.avatar} name={d.name} />
              <h2 className="text-[15px] font-semibold text-text-primary mt-3">{d.name}</h2>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant={score?.classification ?? 'neutral'}>{score?.classification ?? '—'}</Badge>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  candidate.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                  candidate.status === 'rejected' ? 'bg-red-50 text-red-700' :
                  candidate.status === 'new' ? 'bg-blue-50 text-blue-700' :
                  'bg-bg-surface text-text-muted'
                }`}>{candidate.status}</span>
              </div>

            </div>

            <div className="space-y-2 text-[12px] text-text-secondary border-t border-border-subtle pt-3 mb-4">
              <div className="flex items-center gap-2"><Briefcase size={12} className="text-text-muted" /> {t("yearsExp", { years: d.totalYearsExperience })}</div>
              {d.date_of_birth && d.date_of_birth !== 'null' && <div className="flex items-center gap-2"><Cake size={12} className="text-text-muted" /> {d.date_of_birth}</div>}
              {d.hometown && d.hometown !== 'null' && <div className="flex items-center gap-2"><MapPin size={12} className="text-text-muted" /> {d.hometown}</div>}
              {Array.isArray(d.languages) && d.languages.filter(l => l.language && l.language !== 'null').length > 0 && <div className="flex items-center gap-2"><Languages size={12} className="text-text-muted" /> {d.languages.filter(l => l.language && l.language !== 'null').map(l => l.language).join(', ')}</div>}
              {d.email && d.email !== '<UNKNOWN>' && d.email !== 'null' && <div className="flex items-center gap-2"><Mail size={12} className="text-text-muted" /> <span className="truncate">{d.email}</span></div>}
              {d.phone && d.phone !== '<UNKNOWN>' && d.phone !== 'null' && <div className="flex items-center gap-2"><Phone size={12} className="text-text-muted" /> {d.phone}</div>}
              {d.profile_urls?.length > 0 && d.profile_urls.map((url: string, i: number) => (
                <div key={i} className="flex items-center gap-2"><Globe size={12} className="text-text-muted" /> <a href={url} target="_blank" className="text-accent text-[11px] hover:underline truncate">{url.replace(/https?:\/\/(www\.)?/, '')}</a></div>
              ))}
              {d.address && <div className="flex items-center gap-2"><MapPin size={12} className="text-text-muted" /> <span className="text-[11px]">{d.address}</span></div>}
            </div>

            {/* Edit parsed data */}
            {candidate.status !== 'blacklisted' && (
            <div className="border-t border-border-subtle pt-2 mb-2">
              <EditCandidateData candidateId={candidate.id} data={d} />
            </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {candidate.status !== 'blacklisted' && (
              <>
              <button onClick={() => setEmailModal(true)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors">
                <Sparkles size={14} /> AI Email
              </button>
              {candidate.status === 'new' && (
                <>
                <button onClick={() => { updateStatus.mutate({ id: candidate.id, status: 'reviewed' }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['candidates', id] }); toast('success', t("markReviewed")); } }); }} disabled={updateStatus.isPending || updateStatus.isSuccess} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40">
                  <CheckCircle size={14} /> {updateStatus.isPending ? t("updating") : t("markReviewed")}
                </button>
                <button onClick={async () => { const ok = await confirm({ title: t('deleteCandidate'), message: t('deleteCandidateConfirm'), confirmLabel: t('delete'), variant: 'danger' }); if (!ok) return; try { await apiClient.delete(`/candidates/${candidate.id}`); queryClient.invalidateQueries({ queryKey: ['candidates'] }); toast('success', 'Đã xóa'); navigate('/candidates'); } catch(e: any) { toast('error', e?.response?.data?.detail || 'Lỗi'); } }} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors mt-2">
                  <Trash2 size={13} /> Xóa ứng viên
                </button>
                </>
              )}
              {candidate.status === 'approved' && <div className="text-center text-[13px] font-medium text-emerald-600 bg-emerald-50 py-2 rounded-lg">✓ {t("statusApproved")}</div>}
              {candidate.status === 'rejected' && <div className="text-center text-[13px] font-medium text-red-600 bg-red-50 py-2 px-3 rounded-lg">✗ {t("statusRejected")}{candidate.jobTitle && <span className="font-normal text-red-500"> — {candidate.jobTitle}</span>}</div>}
              {candidate.cvFilePath && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    const token = localStorage.getItem('token');
                    fetch(`/api/v1/candidates/${candidate.id}/cv`, { headers: { Authorization: `Bearer ${token}` } })
                      .then(r => r.blob())
                      .then(blob => { setCvBlobUrl(URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))); });
                  }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors">
                    <Eye size={14} /> {t("viewCv")}
                  </button>
                  <button onClick={() => {
                    const token = localStorage.getItem('token');
                    fetch(`/api/v1/candidates/${candidate.id}/cv`, { headers: { Authorization: `Bearer ${token}` } })
                      .then(r => r.blob())
                      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = candidate.cvFilePath!; a.click(); URL.revokeObjectURL(url); });
                  }} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-bg-surface transition-colors">
                    <Download size={14} />
                  </button>
                </div>
              )}
              </>
              )}
              {candidate.status !== 'blacklisted' && candidate.cvFilePath && (
                <CvAuthenticityButton candidateId={candidate.id} cachedResult={d._ai_authenticity} />
              )}
              {candidate.status !== 'blacklisted' ? (
                <button onClick={() => setBlacklistModal(true)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  🚫 Blacklist
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-center text-[11px] font-medium text-red-600 bg-red-50 py-2 rounded-lg">🚫 Blacklisted</div>
                  <button onClick={async () => {
                    const ok = await confirm({ title: t('removeBlacklistTitle'), message: t('removeBlacklistConfirm', { name: d.name }), confirmLabel: t('removeBlacklist'), variant: 'danger' });
                    if (!ok) return;
                    await apiClient.post(`/candidates/${candidate.id}/unblacklist`);
                    toast('success', t('removeBlacklist'));
                    window.location.reload();
                  }} className="w-full text-[11px] text-text-muted hover:text-accent text-center">{t('removeBlacklist')}</button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>{/* end sidebar layout */}

      {/* AI Email Modal */}
      {emailModal && (
        <EmailCompose
          candidateId={candidate.id}
          candidateName={d.name || 'Candidate'}
          candidateEmail={d.email || null}
          jobTitle={candidate.jobTitle || undefined}
          onClose={() => setEmailModal(false)}
          onSent={() => toast('success', '✓')}
        />
      )}

      {/* Blacklist Modal */}
      {blacklistModal && <BlacklistModal candidateId={candidate.id} candidateName={d.name} onClose={() => setBlacklistModal(false)} onDone={() => { toast('success', t('blacklisted')); window.location.reload(); }} />}

      {/* CV Preview Modal */}
      {cvBlobUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => { URL.revokeObjectURL(cvBlobUrl); setCvBlobUrl(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium">{t("cvPreview")} — {candidate.structuredData.name}</span>
              <button onClick={() => { URL.revokeObjectURL(cvBlobUrl); setCvBlobUrl(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <XCircle size={18} className="text-gray-500" />
              </button>
            </div>
            <iframe src={`${cvBlobUrl}#toolbar=1`} className="flex-1 w-full" title="CV Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

function AiSummaryInline({ summary }: { summary: string }) {
  const { locale } = useI18n();
  try {
    const parsed = JSON.parse(summary);
    // New format: {en: {summary, strengths, concerns}, vi: {...}}
    if (parsed.en || parsed.vi) {
      const target = locale === 'vi' ? 'vi' : 'en';
      const data = parsed[target] || parsed['en'] || parsed['vi'] || {};
      return (
        <div className="mt-1 space-y-1">
          {data.summary && <p className="text-[11px] text-blue-800">{data.summary}</p>}
          {data.strengths?.length > 0 && <p className="text-[10px] text-emerald-700">✓ {data.strengths.join(' • ')}</p>}
          {data.concerns?.length > 0 && <p className="text-[10px] text-amber-700">⚠ {data.concerns.join(' • ')}</p>}
          {data.suggestion && <p className="text-[10px] text-purple-700 italic">💡 {data.suggestion}</p>}
        </div>
      );
    }
    // Legacy format: {summary, strengths, concerns, suggestion}
    if (typeof parsed === 'object' && parsed.summary) {
      return (
        <div className="mt-1 space-y-1">
          <p className="text-[11px] text-blue-800">{parsed.summary}</p>
          {parsed.strengths?.length > 0 && <p className="text-[10px] text-emerald-700">✓ {parsed.strengths.join(' • ')}</p>}
          {parsed.concerns?.length > 0 && <p className="text-[10px] text-amber-700">⚠ {parsed.concerns.join(' • ')}</p>}
          {parsed.suggestion && <p className="text-[10px] text-purple-700 italic">💡 {parsed.suggestion}</p>}
        </div>
      );
    }
  } catch {}
  return <p className="text-[11px] text-blue-800 mt-0.5 whitespace-pre-line">{summary}</p>;
}

function MatchedJobsSection({ candidateId, hasAssignedJob, sourceJobId, sourceJobTitle }: { candidateId: string; hasAssignedJob: boolean; sourceJobId?: string | null; sourceJobTitle?: string | null }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fetchJobs = () => {
      apiClient.get(`/candidates/${candidateId}/matched-jobs`)
        .then(({ data }) => {
          setJobs(data);
          // Retry once after 10s if empty (Phase 2 might still be running)
          if (data.length === 0 && !timer) {
            timer = setTimeout(fetchJobs, 10000);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    fetchJobs();
    return () => { if (timer) clearTimeout(timer); };
  }, [candidateId, hasAssignedJob]);

  const handleAssign = async (jobId: string) => {
    setAssigning(jobId);
    try {
      await apiClient.post(`/jobs/${jobId}/assign/${candidateId}`);
      const { data } = await apiClient.get(`/candidates/${candidateId}/matched-jobs`);
      setJobs(data);
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['candidates'] });
    } catch { /* ignore */ }
    setAssigning(null);
  };

  if (loading) return null;
  if (jobs.length === 0) {
    // Show placeholder if enrichment not done yet (no experience = Phase 2 still running)
    if (!hasAssignedJob) {
      return (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mt-5">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={15} className="text-accent" />
            <h2 className="text-sm font-medium text-text-primary">{t("matchedJobs")}</h2>
          </div>
          <p className="text-[11px] text-text-muted">⏳ Đang tìm job phù hợp... Kết quả sẽ hiện sau vài giây.</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mt-5">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase size={15} className="text-accent" />
        <h2 className="text-sm font-medium text-text-primary">{t("matchedJobs")} ({jobs.length})</h2>
      </div>
      <div className="space-y-2">
        {jobs.map((j) => {
          const isScored = j.status === 'scored' && j.final_score != null;
          const mainScore = isScored ? `${j.final_score}/100` : `${Math.round(j.combined_score * 100)}%`;
          const mainLabel = isScored ? 'Final Score' : 'Match Score';
          return (
            <div key={j.job_id} className="rounded-lg border border-border-subtle overflow-hidden">
              <div
                className="flex items-center justify-between p-3 hover:bg-accent/5 transition-colors cursor-pointer"
                onClick={() => setExpanded(expanded === j.job_id ? null : j.job_id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{j.title || j.job_title}</span>
                  {sourceJobId && (j.id === sourceJobId || j.job_id === sourceJobId) && <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded border border-amber-200">{t('preTaggedBadge')}</span>}
                  <span className="text-xs text-text-muted">{mainLabel}: {mainScore}</span>
                </div>
                <div className="flex items-center gap-2">
                  {j.classification && <Badge variant={j.classification}>{j.classification}</Badge>}
                  {!isScored && <Badge variant="neutral">suggested</Badge>}
                </div>
              </div>
              {expanded === j.job_id && (
                <div className="px-3 pb-3 border-t border-border-subtle pt-3 space-y-3">
                  {/* Score breakdown */}
                  {isScored ? (
                    <div className="space-y-2">
                      {/* Final */}
                      <div className="flex items-center justify-between p-2.5 bg-accent/5 rounded-lg border border-accent/20">
                        <div>
                          <div className="text-[12px] font-medium text-accent">{t("compositeScore")}</div>
                          <div className="text-[10px] text-text-muted">{t("compositeFormula")}</div>
                        </div>
                        <div className="text-xl font-bold text-accent">{j.final_score}/100</div>
                      </div>
                      {/* Skills */}
                      <div className="flex items-center justify-between p-2 bg-bg-surface rounded-lg">
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{t("skillMatch")}</div>
                          <div className="text-[10px] text-text-muted">{t("skillMatchDesc")}</div>
                        </div>
                        <div className="text-sm font-bold text-text-primary">{j.details?.rule_scoring?.skills?.score ?? '—'}/100</div>
                      </div>
                      {/* Experience */}
                      <div className="flex items-center justify-between p-2 bg-bg-surface rounded-lg">
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{t("experienceScore")}</div>
                          <div className="text-[10px] text-text-muted">{j.details?.rule_scoring?.experience?.note || t("experienceScoreDesc")}</div>
                        </div>
                        <div className="text-sm font-bold text-text-primary">{j.details?.rule_scoring?.experience?.score ?? '—'}/100</div>
                      </div>
                      {/* Education */}
                      <div className="flex items-center justify-between p-2 bg-bg-surface rounded-lg">
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{t("educationScore")}</div>
                          <div className="text-[10px] text-text-muted">{j.details?.rule_scoring?.education?.note || t("educationScoreDesc")}</div>
                        </div>
                        <div className="text-sm font-bold text-text-primary">{j.details?.rule_scoring?.education?.score ?? '—'}/100</div>
                      </div>
                      {/* LLM */}
                      <div className="flex items-center justify-between p-2 bg-bg-surface rounded-lg">
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{t("aiEvaluation")}</div>
                          <div className="text-[10px] text-text-muted">{t("aiEvaluationDesc")}</div>
                        </div>
                        <div className="text-sm font-bold text-text-primary">{j.details?.llm_score ?? '—'}/100</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-bg-surface rounded-lg">
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{t("skillOverlap")}</div>
                          <div className="text-[10px] text-text-muted">{t("skillOverlapDesc")}</div>
                        </div>
                        <div className="text-sm font-bold text-text-primary">{Math.round(j.skill_score * 100)}%</div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-bg-surface rounded-lg">
                        <div>
                          <div className="text-[12px] font-medium text-text-primary">{t("profileSimilarity")}</div>
                          <div className="text-[10px] text-text-muted">{t("profileSimilarityDesc")}</div>
                        </div>
                        <div className="text-sm font-bold text-text-primary">{Math.round(j.similarity_score * 100)}%</div>
                      </div>
                    </div>
                  )}
                  {/* Matched skills */}
                  {j.matched_skills?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-medium text-emerald-700 uppercase">{t("matchedSkills")}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {j.matched_skills.map((s: string) => (
                          <span key={s} className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Missing skills */}
                  {j.missing_skills?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-medium text-red-600 uppercase">{t("missingSkills")}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {j.missing_skills.map((s: string) => (
                          <span key={s} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* AI summary */}
                  {j.details?.llm_summary && (
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-[10px] font-medium text-blue-700 uppercase">{t("aiComment")}</span>
                      <AiSummaryInline summary={j.details.llm_summary} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {!isScored && (
                      <button
                        onClick={() => handleAssign(j.job_id)}
                        disabled={assigning === j.job_id || hasAssignedJob}
                        title={hasAssignedJob ? t('candidateAlreadyAssigned') : ''}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {assigning === j.job_id ? t("scoring") : hasAssignedJob ? t("assignedJob") : t("assignScore")}
                      </button>
                    )}
                    <Link to={`/jobs/${j.job_id}`} className="text-[11px] text-accent hover:underline">
                      {t("viewJob")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



function MissingInfoPanel({ data }: { data: any }) {
  const { t } = useI18n();
  const missing: string[] = [];
  const isEmpty = (v: any) => !v || v === 'null' || v === '<UNKNOWN>';
  if (isEmpty(data.email)) missing.push(t("missingEmail"));
  if (isEmpty(data.phone)) missing.push(t("missingPhone"));
  if (!Array.isArray(data.skills) || data.skills.length === 0) missing.push(t("missingSkillsList"));
  if (!Array.isArray(data.experience) || data.experience.length === 0) missing.push(t("missingExperience"));
  if (!Array.isArray(data.education) || data.education.length === 0) missing.push(t("missingEducation"));
  if (!data.totalYearsExperience) missing.push(t("missingYears"));
  if (!Array.isArray(data.languages) || data.languages.filter((l: any) => l.language && l.language !== 'null').length === 0) missing.push(t("missingLanguages"));
  if (isEmpty(data.avatar)) missing.push(t("missingAvatar"));

  if (missing.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={15} className="text-amber-600" />
        <span className="text-[13px] font-medium text-amber-800">{t("missingInfo", { count: missing.length })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {missing.map(m => (
          <span key={m} className="text-[11px] px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-medium">{m}</span>
        ))}
      </div>
      <p className="text-[11px] text-amber-600 mt-2">{t("missingInfoNote")}</p>
    </div>
  );
}

function BlacklistModal({ candidateId, candidateName, onClose, onDone }: { candidateId: string; candidateName: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await apiClient.post(`/candidates/${candidateId}/blacklist`, { reason });
      onDone();
    } catch { }
    setSaving(false);
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-96 p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-text-primary mb-1">{t('blacklistCandidate')}</h3>
        <p className="text-[12px] text-text-muted mb-4" dangerouslySetInnerHTML={{ __html: t('blacklistCandidateDesc', { name: candidateName }) }} />
        <label className="text-[11px] font-medium text-text-muted uppercase">{t('blacklistReasonLabel')}</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder={t('blacklistReasonPlaceholder')} />
        <div className="flex gap-2 mt-4">
          <button onClick={handleSubmit} disabled={saving || !reason.trim()} className="flex-1 py-2.5 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 disabled:opacity-40">
            {saving ? t('processing') : t('confirmBlacklist')}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] text-text-muted border border-border-subtle rounded-lg hover:bg-bg-surface">{t('cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
