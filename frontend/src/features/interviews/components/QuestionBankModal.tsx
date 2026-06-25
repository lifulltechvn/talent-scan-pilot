import { useState, useEffect } from 'react';
import { Loader2, X, Brain, Zap, Target } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { apiClient } from '@/data/api/client';

interface Props {
  candidateId: string;
  candidateName: string;
  jobId?: string;
  onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; labelVi: string; icon: any; color: string }> = {
  problem_solving: { label: 'Problem Solving', labelVi: 'Giải quyết vấn đề', icon: Brain, color: 'text-blue-600 bg-blue-50' },
  ai_skills: { label: 'AI Skills', labelVi: 'Kỹ năng sử dụng AI', icon: Zap, color: 'text-purple-600 bg-purple-50' },
  g_assessment: { label: 'G-Level Assessment', labelVi: 'Đánh giá G-level', icon: Target, color: 'text-amber-600 bg-amber-50' },
};

export function QuestionBankModal({ candidateId, candidateName, jobId, onClose }: Props) {
  const { locale } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchQuestions = () => {
      const params = new URLSearchParams({ locale });
      if (jobId) params.set('job_id', jobId);
      apiClient.get(`/question-bank/for-candidate/${candidateId}?${params}`)
        .then(({ data }) => {
          if (cancelled) return;
          setData(data);
          if (data.categories && Object.keys(data.categories).length > 0 && !expandedCat) {
            setExpandedCat(Object.keys(data.categories)[0]);
          }
          if (!data.categories || Object.keys(data.categories).length === 0) {
            setTimeout(fetchQuestions, 3000);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    fetchQuestions();
    return () => { cancelled = true; };
  }, [candidateId, jobId]);

  const categories = data?.categories || {};
  const hasQuestions = Object.keys(categories).length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">📋 Câu hỏi phỏng vấn</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">{candidateName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="text-accent animate-spin" />
            <span className="ml-2 text-[13px] text-gray-500">Đang tải...</span>
          </div>
        ) : !hasQuestions ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-accent" size={24} />
            <p className="text-[13px] text-gray-500">Đang tạo câu hỏi phỏng vấn...</p>
            <p className="text-[11px] text-gray-400">Sẽ sẵn sàng trong 10-15 giây</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Category tabs */}
            <div className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
              {Object.entries(categories).map(([cat, catData]: [string, any]) => {
                const meta = CATEGORY_META[cat] || { label: cat, labelVi: cat, icon: Brain, color: 'text-gray-600 bg-gray-50' };
                const Icon = meta.icon;
                const qs = catData.questions || [];
                return (
                  <button
                    key={cat}
                    onClick={() => setExpandedCat(cat)}
                    className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors ${expandedCat === cat ? 'bg-white border-l-2 border-l-accent' : 'hover:bg-white/70'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-md ${meta.color}`}><Icon size={14} /></div>
                      <div>
                        <div className="text-[12px] font-medium text-gray-800">{locale === 'vi' ? meta.labelVi : meta.label}</div>
                        <div className="text-[10px] text-gray-400">{qs.length} câu hỏi</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Questions list */}
            <div className="flex-1 overflow-y-auto p-5">
              {expandedCat && categories[expandedCat] && (
                <div className="space-y-3">
                  {(categories[expandedCat].questions || []).map((q: string, i: number) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors">
                      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        i < 3 ? 'bg-emerald-100 text-emerald-700' : i < 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-[13px] text-gray-800 leading-relaxed">{q}</p>
                        <span className="text-[9px] text-gray-400 mt-1 inline-block">
                          {i < 3 ? '● Cơ bản' : i < 7 ? '●● Trung bình' : '●●● Nâng cao'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
