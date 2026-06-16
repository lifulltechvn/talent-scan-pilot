import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, Clock, CalendarCheck, CheckCircle, XCircle, ChevronRight, Eye } from 'lucide-react';
import { useCandidates } from '../hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useI18n } from '@/shared/i18n';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: 'text-blue-700', bg: 'bg-blue-500' },
  reviewed: { label: 'Reviewed', color: 'text-amber-700', bg: 'bg-amber-500' },
  assigned: { label: 'Assigned', color: 'text-purple-700', bg: 'bg-purple-500' },
  pending: { label: 'Phỏng vấn', color: 'text-cyan-700', bg: 'bg-cyan-500' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-500' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-500' },
};

export function CandidatesPage() {
  const { data: candidates, isLoading } = useCandidates();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { t } = useI18n();

  if (isLoading) return <LoadingSkeleton rows={5} />;

  const all = candidates ?? [];
  const counts: Record<string, number> = {};
  for (const c of all) counts[c.status] = (counts[c.status] || 0) + 1;
  const total = all.length;

  const needsAction = all.filter(c => c.status === 'new' || c.status === 'reviewed');
  const interviewing = all.filter(c => c.status === 'assigned' || c.status === 'pending');
  const done = all.filter(c => c.status === 'approved' || c.status === 'rejected');

  const searched = search
    ? all.filter(c => c.structuredData.name.toLowerCase().includes(search.toLowerCase()) || c.structuredData.skills.some(s => s.toLowerCase().includes(search.toLowerCase())))
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('candidates')}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{total} ứng viên</p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc kỹ năng..." className="w-full pl-9 pr-3 py-2 bg-bg-panel border border-border-subtle rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20" />
        </div>
      </div>

      {/* Search results */}
      {searched ? (
        <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-medium text-text-primary">Kết quả ({searched.length})</h2>
          </div>
          {searched.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-text-muted">Không tìm thấy ứng viên</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {searched.slice(0, 20).map(c => (
                <CandidateRow key={c.id} candidate={c} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Overview Progress Bar */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 mb-5">
            <div className="flex items-center gap-4 mb-3">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 text-[12px]">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
                  <span className="text-text-secondary">{cfg.label}</span>
                  <span className="font-medium text-text-primary">{counts[key] || 0}</span>
                </div>
              ))}
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-bg-surface">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const pct = total > 0 ? ((counts[key] || 0) / total) * 100 : 0;
                return pct > 0 ? <div key={key} className={`${cfg.bg} transition-all`} style={{ width: `${pct}%` }} /> : null;
              })}
            </div>
          </div>

          {/* Cần xử lý */}
          {needsAction.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
              <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <Clock size={15} /> Cần xử lý ({needsAction.length})
              </h2>
              <div className="space-y-2">
                {(counts['new'] || 0) > 0 && (
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[13px] text-text-primary font-medium">{counts['new']} CV mới</span>
                      <span className="text-[12px] text-text-muted">chưa review</span>
                    </div>
                    <Link to={`/candidates/${all.find(c => c.status === 'new')?.id}`} className="text-[12px] text-accent font-medium hover:underline flex items-center gap-0.5">
                      Review <ChevronRight size={12} />
                    </Link>
                  </div>
                )}
                {(counts['reviewed'] || 0) > 0 && (
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[13px] text-text-primary font-medium">{counts['reviewed']} đã review</span>
                      <span className="text-[12px] text-text-muted">chưa assign vào job</span>
                    </div>
                    <Link to="/jobs" className="text-[12px] text-accent font-medium hover:underline flex items-center gap-0.5">
                      Assign <ChevronRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Đang phỏng vấn */}
          {interviewing.length > 0 && (
            <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
                <CalendarCheck size={14} className="text-cyan-600" />
                <h2 className="text-sm font-medium text-text-primary">Đang phỏng vấn ({interviewing.length})</h2>
              </div>
              <div className="divide-y divide-border-subtle">
                {interviewing.map(c => (
                  <CandidateRow key={c.id} candidate={c} />
                ))}
              </div>
            </div>
          )}

          {/* Hoàn thành */}
          {done.length > 0 && (
            <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-600" />
                <h2 className="text-sm font-medium text-text-primary">Hoàn thành ({done.length})</h2>
              </div>
              <div className="divide-y divide-border-subtle">
                {done.map(c => (
                  <CandidateRow key={c.id} candidate={c} />
                ))}
              </div>
            </div>
          )}

          {/* All candidates */}
          {needsAction.length > 0 && (
            <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
                <Eye size={14} className="text-text-muted" />
                <h2 className="text-sm font-medium text-text-primary">Chưa xử lý ({needsAction.length})</h2>
              </div>
              <div className="divide-y divide-border-subtle">
                {needsAction.map(c => (
                  <CandidateRow key={c.id} candidate={c} />
                ))}
              </div>
            </div>
          )}

          {total === 0 && <EmptyState icon={Users} title="Chưa có ứng viên" description="Upload CV để bắt đầu" />}
        </>
      )}
    </div>
  );
}

function CandidateRow({ candidate: c }: { candidate: any }) {
  const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.new;
  return (
    <Link to={`/candidates/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface/50 transition-colors">
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[12px] font-bold shrink-0">
        {c.structuredData.name?.charAt(0) || 'C'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-text-primary truncate">{c.structuredData.name}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.color} bg-opacity-10`} style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
            {cfg.label}
          </span>
        </div>
        <p className="text-[12px] text-text-tertiary truncate">{c.structuredData.skills?.slice(0, 4).join(' · ')}</p>
      </div>
      <ChevronRight size={14} className="text-text-muted shrink-0" />
    </Link>
  );
}
