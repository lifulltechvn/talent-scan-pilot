import { useState } from 'react';
import { Brain, Loader2, X } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

export function InterviewCoachingModal({ interviewId, onClose }: { interviewId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await apiClient.post(`/ai-advanced/interview-coaching/${interviewId}`);
      setResult(data);
    } catch (e: any) { setError(e.response?.data?.detail || t('cannotAnalyze')); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-white" />
            <h2 className="text-[15px] font-semibold text-white">{t('aiInterviewCoaching')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5">
          {!result && !loading && !error && (
            <div className="text-center py-4">
              <p className="text-[12px] text-text-muted mb-3">{t('coachingDescription')}</p>
              <button onClick={run} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover">
                {t('analyzeFeedback')}
              </button>
            </div>
          )}
          {loading && (
            <div className="text-center py-6">
              <Loader2 size={24} className="mx-auto text-accent animate-spin mb-2" />
              <p className="text-[13px] text-text-muted">{t('analyzing')}</p>
            </div>
          )}
          {error && <p className="text-[13px] text-red-500 text-center py-4">{error}</p>}
          {result && (
            <div className="space-y-3">
              {/* Overall quality */}
              <div className={`p-3 rounded-lg text-center ${result.overall_quality === 'good' ? 'bg-emerald-50' : result.overall_quality === 'needs_improvement' ? 'bg-amber-50' : 'bg-red-50'}`}>
                <span className={`text-[14px] font-bold ${result.overall_quality === 'good' ? 'text-emerald-700' : result.overall_quality === 'needs_improvement' ? 'text-amber-700' : 'text-red-700'}`}>
                  {result.overall_quality === 'good' ? t('feedbackQualityGood') : result.overall_quality === 'needs_improvement' ? t('feedbackNeedsImprovement') : t('feedbackPoorQuality')}
                </span>
              </div>

              {/* Per-interviewer assessment */}
              {result.assessments?.map((a: any, i: number) => (
                <div key={i} className="p-3 bg-bg-surface rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-text-primary">{a.name}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${a.quality === 'good' ? 'bg-emerald-100 text-emerald-700' : a.quality === 'fair' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{a.quality}</span>
                  </div>
                  {a.issue && <p className="text-[11px] text-text-secondary">{a.issue}</p>}
                  {a.tip && <p className="text-[11px] text-accent mt-0.5">💡 {a.tip}</p>}
                </div>
              ))}

              {/* Bias warning */}
              {result.bias_warning && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-[11px] font-medium text-red-700">{t('biasWarning')}</span>
                  <p className="text-[12px] text-red-600 mt-0.5">{result.bias_warning}</p>
                </div>
              )}

              {/* Summary */}
              {result.summary && (
                <p className="text-[12px] text-text-secondary italic">{result.summary}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
