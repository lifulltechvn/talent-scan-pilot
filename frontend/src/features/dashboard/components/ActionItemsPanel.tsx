import { Link } from 'react-router-dom';
import { AlertCircle, Clock, FileCheck, CalendarClock, Inbox, BriefcaseBusiness } from 'lucide-react';
import { useActionItems } from '../hooks/useActionItems';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/shared/i18n';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'soon';
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface TaskItem {
  icon: typeof AlertCircle;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  link?: string;
}

export function ActionItemsPanel() {
  const { data, isLoading } = useActionItems();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-4 mb-6 animate-pulse">
        <div className="h-5 w-40 bg-bg-surface rounded mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-bg-surface rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tasks: TaskItem[] = [];

  // Unreviewed candidates
  if (data.unreviewed_count > 0) {
    tasks.push({
      icon: Inbox,
      iconColor: 'text-blue-500 bg-blue-50',
      title: t('unreviewedCVs', { count: data.unreviewed_count }),
      subtitle: data.stale_count > 0 ? t('staleWarning', { count: data.stale_count }) : t('needsReview'),
      badge: data.stale_count > 0 ? t('urgent') : undefined,
      badgeColor: 'bg-red-100 text-red-700',
      link: '/candidates',
    });
  }

  // Submitted quizzes awaiting review
  if (data.submitted_quizzes.length > 0) {
    tasks.push({
      icon: FileCheck,
      iconColor: 'text-emerald-500 bg-emerald-50',
      title: t('quizSubmitted', { count: data.submitted_quizzes.length }),
      subtitle: data.submitted_quizzes.map(q => q.candidate_name).slice(0, 2).join(', ') +
        (data.submitted_quizzes.length > 2 ? ` +${data.submitted_quizzes.length - 2}` : ''),
      link: '/candidates',
    });
  }

  // Expiring quizzes
  if (data.expiring_quizzes.length > 0) {
    tasks.push({
      icon: AlertCircle,
      iconColor: 'text-amber-500 bg-amber-50',
      title: t('quizExpiring', { count: data.expiring_quizzes.length }),
      subtitle: data.expiring_quizzes.map(q => `${q.candidate_name} (${timeUntil(q.deadline)})`).slice(0, 2).join(', '),
      badge: t('expiring'),
      badgeColor: 'bg-amber-100 text-amber-700',
    });
  }

  // Upcoming interviews
  if (data.upcoming_interviews.length > 0) {
    tasks.push({
      icon: CalendarClock,
      iconColor: 'text-purple-500 bg-purple-50',
      title: t('upcomingInterviews', { count: data.upcoming_interviews.length }),
      subtitle: data.upcoming_interviews.map(i => `${i.candidate_name} — ${formatTime(i.slot_start)}`).slice(0, 2).join(' · '),
      link: '/interviews',
    });
  }

  // Pending booking links
  if (data.pending_bookings_count > 0) {
    tasks.push({
      icon: Clock,
      iconColor: 'text-slate-500 bg-slate-50',
      title: t('pendingBookings', { count: data.pending_bookings_count }),
      subtitle: t('pendingBookingsDesc'),
    });
  }

  // Expiring jobs
  if (data.expiring_jobs.length > 0) {
    tasks.push({
      icon: BriefcaseBusiness,
      iconColor: 'text-orange-500 bg-orange-50',
      title: t('expiringJobs', { count: data.expiring_jobs.length }),
      subtitle: data.expiring_jobs.map(j => `${j.title} (${timeUntil(j.deadline)})`).slice(0, 2).join(', '),
      badge: t('deadline'),
      badgeColor: 'bg-orange-100 text-orange-700',
      link: '/jobs',
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
          <FileCheck size={18} className="text-emerald-600" />
        </div>
        <div>
          <div className="text-sm font-medium text-emerald-800">{t('allCaughtUp')}</div>
          <div className="text-[12px] text-emerald-600">{t('noTasksDescription')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{t('todayTasks')}</h2>
          <p className="text-[11px] text-text-muted mt-0.5">{t('tasksCount', { count: tasks.length })}</p>
        </div>
      </div>
      <div className="space-y-2">
        {tasks.map((task, i) => {
          const content = (
            <div className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg border border-transparent transition-colors',
              task.link ? 'hover:bg-bg-surface hover:border-border-subtle cursor-pointer' : ''
            )}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', task.iconColor)}>
                <task.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-text-primary">{task.title}</span>
                  {task.badge && (
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', task.badgeColor)}>
                      {task.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-text-muted truncate mt-0.5">{task.subtitle}</div>
              </div>
            </div>
          );
          return task.link ? <Link key={i} to={task.link}>{content}</Link> : <div key={i}>{content}</div>;
        })}
      </div>
    </div>
  );
}
