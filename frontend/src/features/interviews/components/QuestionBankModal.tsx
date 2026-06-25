import { useState, useEffect } from 'react';
import { Loader2, X, ChevronDown, ChevronRight, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

const CATEGORY_META: Record<string, { label_en: string; label_vi: string; icon: string }> = {
  programming: { label_en: 'Coding', label_vi: 'Lập trình', icon: '💻' },
  system_design: { label_en: 'System Design', label_vi: 'Thiết kế hệ thống', icon: '📐' },
  tech_stack: { label_en: 'Tech Stack', label_vi: 'Công nghệ', icon: '⚙️' },
  testing: { label_en: 'Testing & Debug', label_vi: 'Kiểm thử & Debug', icon: '🧪' },
  security: { label_en: 'Security', label_vi: 'Bảo mật', icon: '🔒' },
  devops: { label_en: 'DevOps / CI/CD', label_vi: 'DevOps / CI/CD', icon: '🚀' },
  problem_solving: { label_en: 'Problem Solving', label_vi: 'Giải quyết vấn đề', icon: '🔥' },
  soft_skills: { label_en: 'Soft Skills', label_vi: 'Kỹ năng mềm', icon: '🤝' },
};

interface Question {
  skill: string;
  question: string;
  answer: string;
  trap: string;
}

export function QuestionBankModal({ candidateId, candidateName, round = 1, onClose }: { candidateId: string; candidateName: string; round?: number; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const cleanMd = (s: string) => s?.replace(/[*#`]/g, '').replace(/^\s*[-•]\s*/gm, '- ') || '';
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; red_flag: string }>>({});
  const [loadingAnswer, setLoadingAnswer] = useState<string | null>(null);

  const handleExpandQ = (qKey: string, qId: string) => {
    if (expandedQ === qKey) { setExpandedQ(null); return; }
    setExpandedQ(qKey);
    if (!answers[qId]) {
      setLoadingAnswer(qId);
      apiClient.get(`/question-bank/answer/${qId}?locale=${locale}`)
        .then(({ data }) => setAnswers(prev => ({ ...prev, [qId]: { answer: data.answer || '', red_flag: data.red_flag || '' } })))
        .catch(() => setAnswers(prev => ({ ...prev, [qId]: { answer: 'Failed to load', red_flag: '' } })))
        .finally(() => setLoadingAnswer(null));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchQuestions = () => {
      apiClient.get(`/question-bank/for-candidate/${candidateId}?locale=${locale}&round=${round}`)
        .then(({ data }) => {
          if (cancelled) return;
          setData(data);
          // Auto-select first category
          if (data.categories && Object.keys(data.categories).length > 0 && !expandedCat) {
            setExpandedCat(Object.keys(data.categories)[0]);
          }
          // Retry if still generating
          if (!data.categories || Object.keys(data.categories).length === 0) {
            setTimeout(fetchQuestions, 3000);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    fetchQuestions();
    return () => { cancelled = true; };
  }, [candidateId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[85vh] overflow-hidden m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <BookOpen size={16} /> {t('questionBankTitle')}
            </h2>
            <p className="text-[12px] text-white/70 mt-0.5">
              {candidateName} {data ? `· ${data.level || ''} · ${data.skills?.join(', ') || ''}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="text-accent animate-spin" />
            <span className="ml-2 text-[13px] text-text-muted">{t('generatingQuestions')}</span>
          </div>
        ) : !data || !data.categories || Object.keys(data.categories).length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-accent" size={24} />
            <p className="text-[13px] text-text-muted">{t('generatingQuestions')}</p>
            <p className="text-[11px] text-text-muted">{t('questionsReady')}</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Category tabs (vertical) */}
            <div className="w-48 shrink-0 border-r border-border-subtle bg-bg-surface overflow-y-auto">
              {Object.entries(data.categories).map(([cat, questions]) => {
                const meta = CATEGORY_META[cat] || { label_en: cat, label_vi: cat, icon: '📋' };
                const catData = questions as any;
                const qs = Array.isArray(catData) ? catData : (catData?.questions || []);
                return (
                  <button key={cat} onClick={() => setExpandedCat(cat)} className={`w-full text-left px-4 py-3 border-b border-border-subtle transition-colors ${expandedCat === cat ? 'bg-white border-l-2 border-l-accent' : 'hover:bg-white/50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">{meta.icon}</span>
                      <span className={`text-[13px] font-medium ${expandedCat === cat ? 'text-accent' : 'text-text-primary'}`}>{locale === 'vi' ? meta.label_vi : meta.label_en}</span>
                    </div>
                    <span className="text-[11px] text-text-muted ml-6">{t('questionsCountShort', { count: qs.length })}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Questions list */}
            <div className="flex-1 overflow-y-auto p-5">
              {expandedCat && data.categories[expandedCat] && (
                <div className="space-y-3">
                  {(Array.isArray(data.categories[expandedCat]) ? data.categories[expandedCat] : (data.categories[expandedCat]?.questions || [])).map((q: any, i: number) => {
                    const qText = typeof q === 'string' ? q : q.question;
                    const qSkill = typeof q === 'string' ? '' : q.skill;
                    const qId = typeof q === 'string' ? '' : q.id;
                    const qKey = `${expandedCat}-${i}`;
                    const isOpen = expandedQ === qKey;
                    const hasDetail = !!qId;
                    return (
                      <div key={i} className="border border-border-subtle rounded-lg overflow-hidden">
                        <button onClick={() => hasDetail ? handleExpandQ(qKey, qId) : setExpandedQ(isOpen ? null : qKey)} className="w-full text-left px-4 py-3 hover:bg-bg-surface/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="text-[11px] font-bold text-accent bg-accent/10 w-6 h-6 rounded-md flex items-center justify-center shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-[13px] text-text-primary font-medium leading-relaxed">{qText}</p>
                              {qSkill && <span className="text-[10px] text-text-muted bg-bg-surface px-2 py-0.5 rounded mt-1.5 inline-block">{qSkill}</span>}
                            </div>
                          </div>
                        </button>

                        {isOpen && hasDetail && (
                          <div className="px-4 pb-4 pt-3 border-t border-border-subtle bg-bg-surface/30 space-y-3 ml-9">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <CheckCircle size={13} className="text-emerald-600" />
                                <span className="text-[11px] font-semibold text-emerald-700 uppercase">{t('correctAnswer')}</span>
                              </div>
                              <p className="text-[13px] text-emerald-800 bg-emerald-50 px-3 py-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">{loadingAnswer === qId ? t('loadingAnswer') : cleanMd(answers[qId]?.answer)}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <AlertTriangle size={13} className="text-red-600" />
                                <span className="text-[11px] font-semibold text-red-700 uppercase">{t('trapRedFlag')}</span>
                              </div>
                              <p className="text-[13px] text-red-800 bg-red-50 px-3 py-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">{loadingAnswer === qId ? t('loadingAnswer') : cleanMd(answers[qId]?.red_flag)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
