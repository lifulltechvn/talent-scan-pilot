import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DatabaseZap, RefreshCw, UserCheck, Clock, ArrowUpRight } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/shared/i18n';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { mockTalentPool } from '@/data/mock/data/mock-interviews';
import type { TalentPoolEntry } from '@/domain/models/talent-pool';

const statusConfig: Record<TalentPoolEntry['status'], { icon: typeof Clock; color: string; bg: string }> = {
  active: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  rematched: { icon: RefreshCw, color: 'text-accent', bg: 'bg-orange-50' },
  hired: { icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  expired: { icon: Clock, color: 'text-text-muted', bg: 'bg-gray-100' },
};

type Filter = 'all' | TalentPoolEntry['status'];

export function TalentPoolPage() {
  const { t, locale } = useI18n();
  const loc = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'object' && !Array.isArray(val) && (val.en || val.vi)) return val[locale] || val['en'] || val['vi'];
    return String(val);
  };
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t); }, []);

  if (loading) return <LoadingSkeleton rows={4} />;

  const filtered = filter === 'all' ? mockTalentPool : mockTalentPool.filter(tp => tp.status === filter);
  const active = mockTalentPool.filter(tp => tp.status === 'active').length;
  const rematched = mockTalentPool.filter(tp => tp.status === 'rematched').length;

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `${t('all')} (${mockTalentPool.length})` },
    { value: 'active', label: `${t('active')} (${active})` },
    { value: 'rematched', label: `${t('rematched')} (${rematched})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t("navTalentPool")}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{t('talentPoolSubtitle').replace('{count}', String(active))}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <DatabaseZap size={14} className="text-blue-500" />
            <span className="text-[11px] text-text-tertiary">{t('inPool')}</span>
          </div>
          <span className="text-lg font-bold text-text-primary">{active}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={14} className="text-accent" />
            <span className="text-[11px] text-text-tertiary">{t('rematched')}</span>
          </div>
          <span className="text-lg font-bold text-text-primary">{rematched}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck size={14} className="text-emerald-500" />
            <span className="text-[11px] text-text-tertiary">{t('avgScore')}</span>
          </div>
          <span className="text-lg font-bold text-text-primary">
            {Math.round(mockTalentPool.reduce((s, tp) => s + tp.score, 0) / mockTalentPool.length)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-5">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors',
              filter === f.value ? 'bg-accent text-white' : 'bg-bg-surface text-text-secondary hover:text-text-primary'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Candidate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(tp => {
          const sc = statusConfig[tp.status];
          const StatusIcon = sc.icon;

          return (
            <div key={tp.id} className="bg-bg-panel border border-border-subtle rounded-xl p-4 hover:border-border-default transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-[12px] font-bold shrink-0">
                    {tp.candidateName.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
                  </div>
                  <div>
                    <Link to={`/candidates/${tp.candidateId}`} className="text-[13px] font-medium text-accent hover:underline">
                      {tp.candidateName}
                    </Link>
                    <div className="text-[11px] text-text-muted">
                      from <Link to={`/jobs/${tp.originalJobId}`} className="hover:text-accent">{tp.originalJobTitle}</Link>
                    </div>
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', sc.bg, sc.color)}>
                  <StatusIcon size={11} />
                  {t(tp.status as any)}
                </span>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1 mb-3">
                {tp.skills.map(s => (
                  <span key={s} className="text-[10px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded">{s}</span>
                ))}
              </div>

              {/* Reason */}
              <p className="text-[12px] text-text-secondary bg-bg-surface rounded-md px-2.5 py-1.5 mb-3">{loc(tp.reason)}</p>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <ScoreBar score={tp.score} />
                <div className="flex items-center gap-2">
                  {tp.rematchedJobTitle && (
                    <span className="text-[11px] text-accent flex items-center gap-0.5">
                      <ArrowUpRight size={11} />
                      {tp.rematchedJobTitle}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted">{new Date(tp.addedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-2">
            <EmptyState icon={DatabaseZap} title={t('noCandidatesInPool')} description={t('noCandidatesInPoolDescription')} />
          </div>
        )}
      </div>
    </div>
  );
}
