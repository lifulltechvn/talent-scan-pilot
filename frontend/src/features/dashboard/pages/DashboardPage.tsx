import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Briefcase, Trophy, CalendarCheck, AlertTriangle, Clock, FileText, Plus, ArrowRight } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { Badge } from '@/shared/components/ui/Badge';
import { useI18n } from '@/shared/i18n';

interface DashboardData {
  stats: {
    total_candidates: number;
    new_this_week: number;
    active_jobs: number;
    gold_count: number;
    interviews_today: number;
    need_feedback: number;
    need_review: number;
    pending_duplicates: number;
  };
  today_interviews: any[];
  recent_candidates: any[];
  jobs_overview: any[];
  activity: any[];
}

const activityIcons: Record<string, string> = {
  candidate_added: '📄',
  interview_created: '📅',
  job_created: '💼',
};

export function DashboardPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/dashboard/overview').then(({ data }) => setData(data)).catch(() => {});
    apiClient.get('/dashboard/hiring-funnel').then(({ data }) => setFunnel(data)).catch(() => {});
    apiClient.get('/dashboard/weekly-stats').then(({ data }) => setWeeklyStats(data)).catch(() => {});
  }, []);

  if (!data) return (
    <div className="space-y-5">
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );

  const { stats } = data;
  const greeting = new Date().getHours() < 12 ? t('greetingMorning') : new Date().getHours() < 18 ? t('greetingAfternoon') : t('greetingEvening');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{greeting}! 👋</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/cv-upload" className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover">
          <Plus size={14} /> {t('uploadCv')}
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FileText} label={t('newCvsThisWeek')} value={stats.new_this_week} color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={Briefcase} label={t("activeJobs")} value={stats.active_jobs} color="text-accent" bg="bg-orange-50" />
        <StatCard icon={Trophy} label={t("goldCandidates")} value={stats.gold_count} color="text-amber-600" bg="bg-amber-50" />
        <StatCard icon={CalendarCheck} label={t("todayInterviews")} value={stats.interviews_today} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard icon={AlertTriangle} label={t('needAction')} value={stats.need_review + stats.need_feedback + stats.pending_duplicates} color="text-red-600" bg="bg-red-50" />
      </div>

      {/* Hiring Funnel & Weekly Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hiring Funnel */}
        {funnel && (
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
            <h2 className="text-sm font-medium text-text-primary mb-4">{t('hiringFunnel')}</h2>
            <div className="space-y-2">
              {funnel.funnel.map((stage: any, i: number) => {
                const maxCount = funnel.funnel[0]?.count || 1;
                const pct = maxCount ? Math.round((stage.count / maxCount) * 100) : 0;
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="text-[11px] text-text-muted w-24 shrink-0">{
                      ({Total_CVs: t('totalCVs'), Reviewed: t('statusReviewed'), Approved: t('statusApproved'), Interviewed: t('interviewsTitle'), Hired: t('hired')} as any)[stage.stage.replace(' ', '_')] || stage.stage
                    }</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-accent/70 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[12px] font-medium text-text-primary w-8 text-right">{stage.count}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 pt-3 border-t border-border-subtle text-[11px] text-text-muted">
              <span>{t('approval')}: <strong className="text-emerald-600">{funnel.approval_rate}%</strong></span>
              <span>{t('rejection')}: <strong className="text-red-500">{funnel.rejection_rate}%</strong></span>
              <span>{t('interview')}: <strong className="text-blue-600">{funnel.interview_rate}%</strong></span>
            </div>
          </div>
        )}

        {/* Weekly Stats */}
        {weeklyStats && (
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
            <h2 className="text-sm font-medium text-text-primary mb-4">{t('weeklyStats')}</h2>
            <div className="space-y-3">
              {weeklyStats.weeks.map((w: any) => (
                <div key={w.week} className="flex items-center gap-3">
                  <span className="text-[11px] text-text-muted w-16 shrink-0">{w.start}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-4 bg-blue-50 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(w.uploads * 5, 100)}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-blue-900">{w.uploads} CVs</span>
                    </div>
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <Trophy size={11} className="text-amber-500" />
                      <span className="text-[11px] font-medium text-amber-700">{w.gold} gold</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Action items */}
          {(stats.need_review > 0 || stats.need_feedback > 0 || stats.pending_duplicates > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h2 className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2"><AlertTriangle size={14} /> {t('needAction')}</h2>
              <div className="space-y-2">
                {stats.need_review > 0 && (
                  <Link to="/candidates" className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 hover:border-accent/30">
                    <span className="text-[13px] text-text-primary">{t('unreviewedCount', { count: stats.need_review })}</span>
                    <ArrowRight size={14} className="text-text-muted" />
                  </Link>
                )}
                {stats.need_feedback > 0 && (
                  <Link to="/interviews" className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 hover:border-accent/30">
                    <span className="text-[13px] text-text-primary">{t('needFeedbackCount', { count: stats.need_feedback })}</span>
                    <ArrowRight size={14} className="text-text-muted" />
                  </Link>
                )}
                {stats.pending_duplicates > 0 && (
                  <Link to="/cv-upload" className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 hover:border-accent/30">
                    <span className="text-[13px] text-text-primary">{t('duplicateCvCount', { count: stats.pending_duplicates })}</span>
                    <ArrowRight size={14} className="text-text-muted" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Recent candidates */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h2 className="text-sm font-medium text-text-primary">{t('recentCandidatesTitle')}</h2>
              <Link to="/candidates" className="text-[11px] text-accent hover:underline">{t('viewAll')} →</Link>
            </div>
            <div className="divide-y divide-border-subtle">
              {data.recent_candidates.map(c => (
                <Link key={c.id} to={`/candidates/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg-surface/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-bold">
                      {(c.name || '?').charAt(0)}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-text-primary">{c.name}</div>
                      <div className="text-[11px] text-text-muted">{c.job_title || t('noJobMatch')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.score && <span className="text-[12px] font-medium text-text-secondary">{c.score}/100</span>}
                    {c.classification && <Badge variant={c.classification}>{c.classification}</Badge>}
                    <span className="text-[11px] text-text-muted capitalize">{c.status}</span>
                  </div>
                </Link>
              ))}
              {data.recent_candidates.length === 0 && (
                <div className="px-4 py-6 text-center text-[13px] text-text-muted">{t('noCandidatesYet')}</div>
              )}
            </div>
          </div>

          {/* Jobs overview */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h2 className="text-sm font-medium text-text-primary">{t('jobsRecruiting')}</h2>
              <Link to="/jobs" className="text-[11px] text-accent hover:underline">{t('viewAll')} →</Link>
            </div>
            <div className="divide-y divide-border-subtle">
              {data.jobs_overview.map(j => (
                <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg-surface/50 transition-colors">
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{j.title}</div>
                    {j.deadline && <div className="text-[10px] text-text-muted">Deadline: {new Date(j.deadline).toLocaleDateString(locale)}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[13px] font-medium text-text-primary">{j.candidate_count}</div>
                      <div className="text-[10px] text-text-muted">{t('candidateCount')}</div>
                    </div>
                    {j.gold > 0 && (
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-amber-600">{j.gold}</div>
                        <div className="text-[10px] text-text-muted">gold</div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {data.jobs_overview.length === 0 && (
                <div className="px-4 py-6 text-center text-[13px] text-text-muted">{t('noJobsYet')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Today's interviews */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <h2 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <CalendarCheck size={14} className="text-accent" /> {t('todayInterviews')}
            </h2>
            {data.today_interviews.length === 0 ? (
              <p className="text-[12px] text-text-muted py-2">{t('noInterviewsToday')}</p>
            ) : (
              <div className="space-y-2">
                {data.today_interviews.map(i => (
                  <Link key={i.id} to="/interviews" className="block p-2.5 bg-bg-surface rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-text-primary">{i.candidate_name}</span>
                      <span className="text-[10px] text-accent font-medium">
                        {new Date(i.start_time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">{i.job_title || i.title}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <h2 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Clock size={14} className="text-text-muted" /> {t('recentActivity')}
            </h2>
            <div className="space-y-2.5">
              {data.activity.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[12px] shrink-0">{activityIcons[a.type] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-text-secondary truncate">{a.detail}</div>
                    <div className="text-[10px] text-text-muted">{formatTimeAgo(a.created_at, t)}</div>
                  </div>
                </div>
              ))}
              {data.activity.length === 0 && <p className="text-[12px] text-text-muted">{t('noData')}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
        <Icon size={16} className={color} />
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-[11px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

function formatTimeAgo(iso: string, t: (key: any, params?: any) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('daysAgo', { count: days });
}
