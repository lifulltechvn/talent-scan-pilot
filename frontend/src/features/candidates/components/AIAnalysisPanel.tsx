import { useState } from 'react';
import { Shield, Brain, Users, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/data/api/client';

export function AIAnalysisPanel({ candidateId }: { candidateId: string }) {
  const [activeTab, setActiveTab] = useState<'authenticity' | 'culture'>('authenticity');
  const [authResult, setAuthResult] = useState<any>(null);
  const [cultureResult, setCultureResult] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const runAuthenticity = async () => {
    setLoading('authenticity');
    try {
      const { data } = await apiClient.post(`/ai-advanced/cv-authenticity/${candidateId}`);
      setAuthResult(data);
    } catch { setAuthResult({ error: true }); }
    setLoading(null);
  };

  const runCultureFit = async () => {
    setLoading('culture');
    try {
      const { data } = await apiClient.post(`/ai-advanced/culture-fit/${candidateId}`);
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
              <p className="text-[12px] text-text-muted mb-3">Phân tích CV có phải AI viết hoặc thông tin giả không</p>
              <button onClick={runAuthenticity} disabled={loading === 'authenticity'} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
                {loading === 'authenticity' ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang phân tích...</span> : '🔍 Kiểm tra CV'}
              </button>
            </div>
          ) : authResult.error ? (
            <p className="text-[13px] text-red-500 text-center py-4">Phân tích thất bại</p>
          ) : (
            <div className="space-y-3">
              {/* Score */}
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: authResult.score >= 80 ? '#86efac' : authResult.score >= 50 ? '#fde047' : '#fca5a5', backgroundColor: authResult.score >= 80 ? '#f0fdf4' : authResult.score >= 50 ? '#fefce8' : '#fef2f2' }}>
                <div className="flex items-center gap-2">
                  {authResult.score >= 80 ? <CheckCircle size={16} className="text-emerald-600" /> : authResult.score >= 50 ? <AlertTriangle size={16} className="text-amber-600" /> : <XCircle size={16} className="text-red-600" />}
                  <span className="text-[13px] font-medium">{authResult.verdict === 'authentic' ? 'CV xác thực' : authResult.verdict === 'suspicious' ? 'Có dấu hiệu nghi ngờ' : 'Có thể AI viết'}</span>
                </div>
                <span className="text-[18px] font-bold" style={{ color: authResult.score >= 80 ? '#16a34a' : authResult.score >= 50 ? '#d97706' : '#dc2626' }}>{authResult.score}/100</span>
              </div>

              {/* Reasons */}
              {authResult.reasons?.length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-text-muted uppercase">Phân tích</span>
                  <ul className="mt-1.5 space-y-1">
                    {authResult.reasons.map((r: string, i: number) => (
                      <li key={i} className="text-[12px] text-text-secondary flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red/Green flags */}
              <div className="grid grid-cols-2 gap-2">
                {authResult.red_flags?.length > 0 && (
                  <div className="p-2 bg-red-50 rounded-lg">
                    <span className="text-[10px] font-medium text-red-700 uppercase">🚩 Red flags</span>
                    {authResult.red_flags.map((f: string, i: number) => (
                      <p key={i} className="text-[11px] text-red-600 mt-0.5">{f}</p>
                    ))}
                  </div>
                )}
                {authResult.green_flags?.length > 0 && (
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] font-medium text-emerald-700 uppercase">✅ Good signs</span>
                    {authResult.green_flags.map((f: string, i: number) => (
                      <p key={i} className="text-[11px] text-emerald-600 mt-0.5">{f}</p>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setAuthResult(null)} className="text-[11px] text-text-muted hover:text-accent">↻ Chạy lại</button>
            </div>
          )}
        </div>
      )}

      {/* Culture Fit Tab */}
      {activeTab === 'culture' && (
        <div>
          {!cultureResult ? (
            <div className="text-center py-4">
              <p className="text-[12px] text-text-muted mb-3">Đánh giá mức độ phù hợp văn hoá công ty & rủi ro nghỉ việc</p>
              <button onClick={runCultureFit} disabled={loading === 'culture'} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
                {loading === 'culture' ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang phân tích...</span> : '🎯 Đánh giá Culture Fit'}
              </button>
            </div>
          ) : cultureResult.error ? (
            <p className="text-[13px] text-red-500 text-center py-4">Phân tích thất bại</p>
          ) : (
            <div className="space-y-3">
              {/* Scores */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-bg-surface rounded-lg text-center">
                  <div className="text-[18px] font-bold text-accent">{cultureResult.culture_score}</div>
                  <div className="text-[10px] text-text-muted">Culture Fit</div>
                </div>
                <div className="p-3 bg-bg-surface rounded-lg text-center">
                  <div className={`text-[14px] font-bold ${cultureResult.retention_risk === 'low' ? 'text-emerald-600' : cultureResult.retention_risk === 'medium' ? 'text-amber-600' : 'text-red-600'}`}>
                    {cultureResult.retention_risk === 'low' ? '✓ Thấp' : cultureResult.retention_risk === 'medium' ? '⚠ Trung bình' : '⚠ Cao'}
                  </div>
                  <div className="text-[10px] text-text-muted">Rủi ro nghỉ</div>
                </div>
                <div className="p-3 bg-bg-surface rounded-lg text-center">
                  <div className={`text-[14px] font-bold ${cultureResult.growth_potential === 'high' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {cultureResult.growth_potential === 'high' ? '↑ Cao' : cultureResult.growth_potential === 'medium' ? '→ TB' : '↓ Thấp'}
                  </div>
                  <div className="text-[10px] text-text-muted">Tiềm năng</div>
                </div>
              </div>

              {/* Fit reasons */}
              {cultureResult.fit_reasons?.length > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <span className="text-[10px] font-medium text-emerald-700 uppercase">Phù hợp</span>
                  {cultureResult.fit_reasons.map((r: string, i: number) => (
                    <p key={i} className="text-[11px] text-emerald-700 mt-0.5">✓ {r}</p>
                  ))}
                </div>
              )}

              {/* Risk factors */}
              {cultureResult.risk_factors?.length > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-lg">
                  <span className="text-[10px] font-medium text-amber-700 uppercase">Rủi ro</span>
                  {cultureResult.risk_factors.map((r: string, i: number) => (
                    <p key={i} className="text-[11px] text-amber-700 mt-0.5">⚠ {r}</p>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              {cultureResult.recommendation && (
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <span className="text-[10px] font-medium text-blue-700 uppercase">Khuyến nghị</span>
                  <p className="text-[12px] text-blue-800 mt-0.5">{cultureResult.recommendation}</p>
                </div>
              )}

              <button onClick={() => setCultureResult(null)} className="text-[11px] text-text-muted hover:text-accent">↻ Chạy lại</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
