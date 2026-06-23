import { useState, useEffect } from 'react';
import { ShieldOff, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/data/api/client';

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
          <p className="text-[13px] text-text-tertiary mt-0.5">Ứng viên bị chặn vĩnh viễn khỏi hệ thống tuyển dụng</p>
        </div>
        <span className="text-[13px] text-text-muted">{candidates.length} ứng viên</span>
      </div>

      {loading ? (
        <div className="text-[13px] text-text-muted py-8 text-center">Loading...</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12">
          <ShieldOff size={40} className="mx-auto text-text-muted mb-3 opacity-30" />
          <p className="text-[14px] text-text-muted">Chưa có ứng viên nào bị blacklist</p>
        </div>
      ) : (
        <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1.5fr_140px_80px] gap-3 px-4 py-2.5 border-b border-border-subtle text-[11px] font-medium text-text-muted uppercase">
            <span>Ứng viên</span>
            <span>Email</span>
            <span>Lý do</span>
            <span>Ngày</span>
            <span></span>
          </div>
          <div className="divide-y divide-border-subtle">
            {candidates.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_1fr_1.5fr_140px_80px] gap-3 px-4 py-3 items-center">
                <Link to={`/candidates/${c.id}`} className="text-[13px] font-medium text-accent hover:underline truncate">{c.name}</Link>
                <span className="text-[12px] text-text-secondary truncate">{c.email || '—'}</span>
                <span className="text-[12px] text-red-600 truncate">{c.blacklist_reason}</span>
                <div className="text-[11px] text-text-muted">
                  <div>{new Date(c.blacklisted_at).toLocaleDateString('vi')}</div>
                  {c.blacklisted_by_name && <div className="text-[10px]">bởi {c.blacklisted_by_name}</div>}
                </div>
                <button onClick={() => handleUnblacklist(c.id, c.name)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100">
                  <Undo2 size={11} /> Gỡ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unblacklistTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setUnblacklistTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-text-primary mb-2">Gỡ Blacklist</h3>
            <p className="text-[12px] text-text-secondary mb-4">Gỡ blacklist cho <strong>{unblacklistTarget.name}</strong>? Ứng viên sẽ quay lại hệ thống.</p>
            <div className="flex gap-2">
              <button onClick={confirmUnblacklist} className="flex-1 py-2 bg-amber-500 text-white text-[13px] font-medium rounded-lg hover:bg-amber-600">Xác nhận</button>
              <button onClick={() => setUnblacklistTarget(null)} className="px-4 py-2 text-[13px] text-text-muted border border-border-subtle rounded-lg">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
