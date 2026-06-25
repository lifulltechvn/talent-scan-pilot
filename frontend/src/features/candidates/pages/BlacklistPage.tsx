import { useState, useEffect } from 'react';
import { ShieldOff, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

interface BlacklistedCandidate {
  id: string;
  name: string;
  email: string | null;
  blacklist_reason: string;
  blacklisted_at: string;
  blacklisted_by_name: string | null;
}

export function BlacklistPage() {
  const [candidates, setCandidates] = useState<BlacklistedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const { locale } = useI18n();

  useEffect(() => {
    apiClient.get('/candidates/blacklist').then(({ data }) => setCandidates(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleUnblacklist = async (id: string, name: string) => {
    setUnblacklistTarget({ id, name });
  };

  const [unblacklistTarget, setUnblacklistTarget] = useState<{ id: string; name: string } | null>(null);

  const confirmUnblacklist = async () => {
    if (!unblacklistTarget) return;
    await apiClient.post(`/candidates/${unblacklistTarget.id}/unblacklist`);
    setCandidates(prev => prev.filter(c => c.id !== unblacklistTarget.id));
    setUnblacklistTarget(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2"><ShieldOff size={20} className="text-red-500" /> Blacklist</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{t('blacklistSubtitle')}</p>
        </div>
        <span className="text-[13px] text-text-muted">{t('blacklistCount', { count: candidates.length })}</span>
      </div>

      {loading ? (
        <div className="text-[13px] text-text-muted py-8 text-center">Loading...</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12">
          <ShieldOff size={40} className="mx-auto text-text-muted mb-3 opacity-30" />
          <p className="text-[14px] text-text-muted">{t('noBlacklistedCandidates')}</p>
        </div>
      ) : (
        <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1.5fr_140px_80px] gap-3 px-4 py-2.5 border-b border-border-subtle text-[11px] font-medium text-text-muted uppercase">
            <span>{t('candidate')}</span>
            <span>Email</span>
            <span>{t('reason')}</span>
            <span>{t('date')}</span>
            <span></span>
          </div>
          <div className="divide-y divide-border-subtle">
            {candidates.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_1fr_1.5fr_140px_80px] gap-3 px-4 py-3 items-center">
                <Link to={`/candidates/${c.id}`} className="text-[13px] font-medium text-accent hover:underline truncate">{c.name}</Link>
                <span className="text-[12px] text-text-secondary truncate">{c.email || '—'}</span>
                <span className="text-[12px] text-red-600 truncate">{c.blacklist_reason}</span>
                <div className="text-[11px] text-text-muted">
                  <div>{new Date(c.blacklisted_at).toLocaleDateString(locale)}</div>
                  {c.blacklisted_by_name && <div className="text-[10px]">{t('byUser', { name: c.blacklisted_by_name })}</div>}
                </div>
                <button onClick={() => handleUnblacklist(c.id, c.name)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100">
                  <Undo2 size={11} /> {t('unblacklist')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unblacklistTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setUnblacklistTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-text-primary mb-2">{t('unblacklistTitle')}</h3>
            <p className="text-[12px] text-text-secondary mb-4" dangerouslySetInnerHTML={{ __html: t('unblacklistConfirm', { name: unblacklistTarget.name }) }} />
            <div className="flex gap-2">
              <button onClick={confirmUnblacklist} className="flex-1 py-2 bg-amber-500 text-white text-[13px] font-medium rounded-lg hover:bg-amber-600">{t('confirm')}</button>
              <button onClick={() => setUnblacklistTarget(null)} className="px-4 py-2 text-[13px] text-text-muted border border-border-subtle rounded-lg">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
