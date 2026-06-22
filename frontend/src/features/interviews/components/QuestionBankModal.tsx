import { useState, useEffect } from 'react';
import { Loader2, X, ChevronDown, ChevronRight, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/data/api/client';

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  programming: { label: 'Programming', icon: '💻' },
  architecture: { label: 'Architecture', icon: '🏗️' },
  technical: { label: 'Technical', icon: '⚙️' },
  security: { label: 'Security', icon: '🔒' },
  soft_skills: { label: 'Soft Skills', icon: '🤝' },
};

interface Question {
  skill: string;
  question: string;
  answer: string;
  trap: string;
}

export function QuestionBankModal({ candidateId, candidateName, onClose }: { candidateId: string; candidateName: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>('programming');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get(`/question-bank/for-candidate/${candidateId}`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [candidateId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <BookOpen size={16} /> Bộ câu hỏi phỏng vấn
            </h2>
            <p className="text-[12px] text-white/70 mt-0.5">
              {candidateName} {data ? `· ${data.level} · ${data.skills.join(', ')}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-accent animate-spin" />
              <span className="ml-2 text-[13px] text-text-muted">Đang tạo câu hỏi...</span>
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-[13px] text-text-muted">Không thể tải câu hỏi</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {Object.entries(data.categories).map(([cat, questions]) => {
                const meta = CATEGORY_META[cat] || { label: cat, icon: '📋' };
                const qs = questions as Question[];
                const isExpanded = expandedCat === cat;

                return (
                  <div key={cat}>
                    {/* Category header */}
                    <button onClick={() => setExpandedCat(isExpanded ? null : cat)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-surface/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[16px]">{meta.icon}</span>
                        <span className="text-[14px] font-medium text-text-primary">{meta.label}</span>
                        <span className="text-[11px] text-text-muted bg-bg-surface px-2 py-0.5 rounded-full">{qs.length} câu</span>
                      </div>
                      {isExpanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                    </button>

                    {/* Questions */}
                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-2">
                        {qs.map((q, i) => {
                          const qKey = `${cat}-${i}`;
                          const isOpen = expandedQ === qKey;
                          return (
                            <div key={i} className="border border-border-subtle rounded-lg overflow-hidden">
                              {/* Question */}
                              <button onClick={() => setExpandedQ(isOpen ? null : qKey)} className="w-full text-left px-4 py-3 hover:bg-bg-surface/30 transition-colors">
                                <div className="flex items-start gap-2">
                                  <span className="text-[11px] font-bold text-accent bg-accent/10 w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5">Q{i + 1}</span>
                                  <div className="flex-1">
                                    <p className="text-[13px] text-text-primary font-medium">{q.question}</p>
                                    <span className="text-[10px] text-text-muted bg-bg-surface px-1.5 py-0.5 rounded mt-1 inline-block">{q.skill}</span>
                                  </div>
                                  {isOpen ? <ChevronDown size={14} className="text-text-muted mt-1" /> : <ChevronRight size={14} className="text-text-muted mt-1" />}
                                </div>
                              </button>

                              {/* Answer + Trap (expandable) */}
                              {isOpen && (
                                <div className="px-4 pb-3 space-y-2 border-t border-border-subtle bg-bg-surface/30">
                                  <div className="pt-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <CheckCircle size={12} className="text-emerald-600" />
                                      <span className="text-[11px] font-medium text-emerald-700 uppercase">Đáp án đúng</span>
                                    </div>
                                    <p className="text-[12px] text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg">{q.answer}</p>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <AlertTriangle size={12} className="text-red-600" />
                                      <span className="text-[11px] font-medium text-red-700 uppercase">Trap / Red flag</span>
                                    </div>
                                    <p className="text-[12px] text-red-800 bg-red-50 px-3 py-2 rounded-lg">{q.trap}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
