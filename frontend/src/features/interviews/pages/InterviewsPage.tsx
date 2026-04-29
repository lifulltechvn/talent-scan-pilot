import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, CheckCircle, XCircle, AlertCircle, ArrowRight, Bell, BellOff } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
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
          <h1 className="text-xl font-semibold text-text-primary">Interviews</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{upcoming} upcoming · {completed} completed</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(iv => {
          const sc = statusConfig[iv.status];
          const StatusIcon = sc.icon;
          const date = new Date(iv.scheduledAt);

          return (
            <div key={iv.id} className="bg-bg-panel border border-border-subtle rounded-xl p-3 hover:border-border-default transition-colors flex flex-col h-[120px]">
              <div className="flex items-start justify-between gap-3 mb-auto">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Date block */}
                  <div className="w-12 h-12 rounded-lg bg-bg-surface flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] text-text-muted uppercase">{date.toLocaleDateString('en', { month: 'short' })}</span>
                    <span className="text-base font-bold text-text-primary leading-none">{date.getDate()}</span>
                    <span className="text-[9px] text-text-tertiary">{date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link to={`/candidates/${iv.candidateId}`} className="text-[13px] font-medium text-accent hover:underline truncate">
                        {iv.candidateName}
                      </Link>
                      <span className="text-[10px] text-text-muted shrink-0">R{iv.round}</span>
                    </div>
                    <Link to={`/jobs/${iv.jobId}`} className="text-[12px] text-text-tertiary hover:text-accent block truncate">{iv.jobTitle}</Link>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', sc.bg, sc.color)}>
                    <StatusIcon size={10} />
                    {sc.label}
                  </span>
                  {iv.result && (
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', resultBadge[iv.result].color)}>
                      {iv.result === 'next_round' && <ArrowRight size={10} />}
                      {resultBadge[iv.result].label}
                    </span>
                  )}
                </div>
              </div>

              {/* Footer: notes + reminder */}
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between gap-2">
                <p className="text-[11px] text-text-secondary truncate flex-1">{iv.notes || 'No notes'}</p>
                <span className={cn('text-[10px] flex items-center gap-0.5 shrink-0', iv.reminderSent ? 'text-emerald-500' : 'text-text-muted')}>
                  {iv.reminderSent ? <Bell size={10} /> : <BellOff size={10} />}
                  {iv.reminderSent ? 'Sent' : 'Pending'}
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-2">
            <EmptyState icon={CalendarCheck} title="No interviews found" description="Interviews will appear here when candidates are scheduled" />
          </div>
        )}
      </div>
    </div>
  );
}
