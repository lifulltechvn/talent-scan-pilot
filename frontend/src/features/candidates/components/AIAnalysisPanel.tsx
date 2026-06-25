import { useState } from 'react';
import { Shield, Brain, Users, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

export function AIAnalysisPanel({ candidateId }: { candidateId: string }) {
  const { t, locale } = useI18n();
  // Helper: extract locale-specific value from i18n object or fallback
  const loc = (val: any): any => {
    if (!val) return val;
    if (typeof val === 'object' && !Array.isArray(val) && (val.en || val.vi)) return val[locale] || val['en'] || val['vi'];
    return val;
  };
  const [activeTab, setActiveTab] = useState<'authenticity' | 'culture'>('authenticity');
  const [authResult, setAuthResult] = useState<any>(null);
  const [cultureResult, setCultureResult] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Load cached results on mount
  useState(() => {
    apiClient.post(`/ai-advanced/cv-authenticity/${candidateId}`).then(({ data }) => { if (data.verdict !== 'unknown') setAuthResult(data); }).catch(() => {});
    apiClient.post(`/ai-advanced/culture-fit/${candidateId}`).then(({ data }) => { if (data.retention_risk !== 'unknown') setCultureResult(data); }).catch(() => {});
  });

  const runAuthenticity = async (force = false) => {
    setLoading('authenticity');
    try {
      const { data } = await apiClient.post(`/ai-advanced/cv-authenticity/${candidateId}?force=${force}`);
      setAuthResult(data);
    } catch { setAuthResult({ error: true }); }
    setLoading(null);
  };

  const runCultureFit = async (force = false) => {
    setLoading('culture');
    try {
      const { data } = await apiClient.post(`/ai-advanced/culture-fit/${candidateId}?force=${force}`);
      setCultureResult(data);
    } catch { setCultureResult({ error: true }); }
    setLoading(null);
  };

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
      <h2 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
        <Brain size={16} className="text-accent" /> AI Analysis
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bg-surface rounded-lg mb-4">
        <button onClick={() => setActiveTab('authenticity')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${activeTab === 'authenticity' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>
          <Shield size={12} /> CV Authenticity
        </button>
        <button onClick={() => setActiveTab('culture')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${activeTab === 'culture' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>
          <Users size={12} /> Culture Fit
        </button>
      </div>

      {/* Authenticity Tab */}
      {activeTab === 'authenticity' && (
        <div>
          {!authResult ? (
            <div className="text-center py-4">
              <p className="text-[12px] text-text-muted mb-3">{t('analyzeAuthenticityDesc')}</p>
              <button onClick={() => runAuthenticity()} disabled={loading === 'authenticity'} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
                {loading === 'authenticity' ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {t('analyzingLabel')}</span> : t('checkCvBtnLabel')}
              </button>
            </div>
          ) : authResult.error ? (
            <p className="text-[13px] text-red-500 text-center py-4">{t('analysisFailed')}</p>
          ) : (
            <div className="space-y-3">
              {/* Score */}
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: authResult.score >= 80 ? '#86efac' : authResult.score >= 50 ? '#fde047' : '#fca5a5', backgroundColor: authResult.score >= 80 ? '#f0fdf4' : authResult.score >= 50 ? '#fefce8' : '#fef2f2' }}>
                <div className="flex items-center gap-2">
                  {authResult.score >= 80 ? <CheckCircle size={16} className="text-emerald-600" /> : authResult.score >= 50 ? <AlertTriangle size={16} className="text-amber-600" /> : <XCircle size={16} className="text-red-600" />}
                  <span className="text-[13px] font-medium">{authResult.verdict === 'authentic' ? t('cvAuthenticVerdict') : authResult.verdict === 'suspicious' ? t('cvSuspiciousVerdict') : t('cvAiVerdict')}</span>
                </div>
                <span className="text-[18px] font-bold" style={{ color: authResult.score >= 80 ? '#16a34a' : authResult.score >= 50 ? '#d97706' : '#dc2626' }}>{authResult.score}/100</span>
              </div>

              {/* Reasons */}
              {authResult.reasons && (Array.isArray(loc(authResult.reasons)) ? loc(authResult.reasons) : []).length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-text-muted uppercase">{t('analysisReasonsLabel')}</span>
                  <ul className="mt-1.5 space-y-1">
                    {(loc(authResult.reasons) as string[]).map((r: string, i: number) => (
                      <li key={i} className="text-[12px] text-text-secondary flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red/Green flags */}
              <div className="grid grid-cols-2 gap-2">
                {(loc(authResult.red_flags) as string[] || []).length > 0 && (
                  <div className="p-2 bg-red-50 rounded-lg">
                    <span className="text-[10px] font-medium text-red-700 uppercase">🚩 Red flags</span>
                    {(loc(authResult.red_flags) as string[]).map((f: string, i: number) => (
                      <p key={i} className="text-[11px] text-red-600 mt-0.5">{f}</p>
                    ))}
                  </div>
                )}
                {(loc(authResult.green_flags) as string[] || []).length > 0 && (
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] font-medium text-emerald-700 uppercase">✅ Good signs</span>
                    {(loc(authResult.green_flags) as string[]).map((f: string, i: number) => (
                      <p key={i} className="text-[11px] text-emerald-600 mt-0.5">{f}</p>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* Culture Fit Tab */}
      {activeTab === 'culture' && (
        <div>
          {!cultureResult ? (
            <div className="text-center py-4">
              <p className="text-[12px] text-text-muted mb-3">{t('cultureFitDesc')}</p>
              <button onClick={() => runCultureFit()} disabled={loading === 'culture'} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
                {loading === 'culture' ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {t('analyzingLabel')}</span> : t('assessCultureFitBtn')}
              </button>
            </div>
          ) : cultureResult.error ? (
            <p className="text-[13px] text-red-500 text-center py-4">{t('analysisFailed')}</p>
          ) : (
            <div className="space-y-3">
              {/* Scores */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-bg-surface rounded-lg text-center">
                  <div className={`text-[14px] font-bold ${cultureResult.retention_risk === 'low' ? 'text-emerald-600' : cultureResult.retention_risk === 'medium' ? 'text-amber-600' : 'text-red-600'}`}>
                    {cultureResult.retention_risk === 'low' ? t('riskLow') : cultureResult.retention_risk === 'medium' ? t('riskMedium') : t('riskHigh')}
                  </div>
                  <div className="text-[10px] text-text-muted">{t('retentionRiskLabel')}</div>
                </div>
                <div className="p-3 bg-bg-surface rounded-lg text-center">
                  <div className="text-[14px] font-bold text-text-primary">{cultureResult.avg_tenure_years || '?'}y</div>
                  <div className="text-[10px] text-text-muted">{t('avgTenureLabel')}</div>
                </div>
                <div className="p-3 bg-bg-surface rounded-lg text-center">
                  <div className="text-[14px] font-bold text-accent">{cultureResult.career_trajectory === 'growing' ? '↑' : cultureResult.career_trajectory === 'lateral' ? '→' : '↓'}</div>
                  <div className="text-[10px] text-text-muted">{cultureResult.career_trajectory || 'N/A'}</div>
                </div>
              </div>

              {/* Work style */}
              {cultureResult.work_style && (
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <span className="text-[10px] font-medium text-blue-700 uppercase">{t('workStyleSection')}</span>
                  <p className="text-[12px] text-blue-800 mt-0.5">{cultureResult.work_style === 'leader' ? t('workStyleLeader') : cultureResult.work_style === 'individual_contributor' ? t('workStyleIc') : t('workStyleBoth')}</p>
                </div>
              )}

              {/* Strengths */}
              {(loc(cultureResult.strengths) as string[] || []).length > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <span className="text-[10px] font-medium text-emerald-700 uppercase">{t('strengthsCultureLabel')}</span>
                  {(loc(cultureResult.strengths) as string[]).map((r: string, i: number) => (
                    <p key={i} className="text-[11px] text-emerald-700 mt-0.5">✓ {r}</p>
                  ))}
                </div>
              )}

              {/* Risk factors */}
              {(loc(cultureResult.risk_factors) as string[] || []).length > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-lg">
                  <span className="text-[10px] font-medium text-amber-700 uppercase">{t('riskFactorsLabel')}</span>
                  {(loc(cultureResult.risk_factors) as string[]).map((r: string, i: number) => (
                    <p key={i} className="text-[11px] text-amber-700 mt-0.5">⚠ {r}</p>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              {cultureResult.recommendation && (
                <div className="p-2.5 bg-bg-surface rounded-lg border border-border-subtle">
                  <span className="text-[10px] font-medium text-text-muted uppercase">{t('recommendationCultureLabel')}</span>
                  <p className="text-[12px] text-text-primary mt-0.5 font-medium">{loc(cultureResult.recommendation)}</p>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
