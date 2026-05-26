import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, CheckCircle, XCircle, AlertCircle, Bell, BellOff } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/shared/i18n';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { mockInterviews } from '@/data/mock/data/mock-interviews';
import type { InterviewStatus } from '@/domain/models/interview';

const statusConfig: Record<InterviewStatus, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  no_show: { label: 'No Show', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
};

const resultBadge = {
  pass: { label: 'Pass', color: 'bg-emerald-100 text-emerald-700' },
  fail: { label: 'Fail', color: 'bg-red-100 text-red-700' },
  next_round: { label: 'Next Round', color: 'bg-blue-100 text-blue-700' },
};

type Filter = 'all' | InterviewStatus;

export function InterviewsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t); }, []);

  if (loading) return <LoadingSkeleton rows={4} />;

  const filtered = filter === 'all' ? mockInterviews : mockInterviews.filter(iv => iv.status === filter);
  const upcoming = mockInterviews.filter(iv => iv.status === 'scheduled').length;
  const completed = mockInterviews.filter(iv => iv.status === 'completed').length;

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `All (${mockInterviews.length})` },
    { value: 'scheduled', label: `Scheduled (${upcoming})` },
    { value: 'completed', label: `Completed (${completed})` },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('interviewsTitle')}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{t('interviewsSubtitle', { upcoming, completed })}</p>
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

      {/* Interview Cards */}
      <div className="space-y-3">
        {filtered.map(iv => {
          const sc = statusConfig[iv.status];
          const StatusIcon = sc.icon;
          const date = new Date(iv.scheduledAt);

          return (
            <div key={iv.id} className="bg-bg-panel border border-border-subtle rounded-xl p-4 hover:border-border-default transition-colors">
              <div className="flex items-start gap-4">
                {/* Date block */}
                <div className="w-14 h-14 rounded-xl bg-accent/5 border border-accent/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium text-accent uppercase">{date.toLocaleDateString('en', { month: 'short' })}</span>
                  <span className="text-lg font-bold text-text-primary leading-tight">{date.getDate()}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link to={`/candidates/${iv.candidateId}`} className="text-[14px] font-medium text-text-primary hover:text-accent truncate">
                        {iv.candidateName}
                      </Link>
                      <span className="text-[10px] text-text-muted bg-bg-surface px-1.5 py-0.5 rounded shrink-0">R{iv.round}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {iv.result && (
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', resultBadge[iv.result].color)}>
                          {resultBadge[iv.result].label}
                        </span>
                      )}
                      <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', sc.bg, sc.color)}>
                        <StatusIcon size={11} />
                        {sc.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[12px] text-text-tertiary mb-2">
                    <Link to={`/jobs/${iv.jobId}`} className="hover:text-accent">{iv.jobTitle}</Link>
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-accent/60" />
                      {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {iv.notes && (
                    <p className="text-[12px] text-text-secondary bg-bg-surface/60 rounded-lg px-3 py-2 line-clamp-2">{iv.notes}</p>
                  )}
                </div>

                {/* Reminder indicator */}
                <div className="shrink-0 pt-1">
                  <span className={cn('flex items-center gap-1 text-[10px]', iv.reminderSent ? 'text-emerald-500' : 'text-text-muted')} title={iv.reminderSent ? t('reminderSent') : t('reminderPending')}>
                    {iv.reminderSent ? <Bell size={12} /> : <BellOff size={12} />}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState icon={CalendarCheck} title={t('noInterviewsFound')} description={t('noInterviewsDescription')} />
        )}
      </div>
    </div>
  );
}
