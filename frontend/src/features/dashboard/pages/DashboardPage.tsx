import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Briefcase, Trophy, CalendarCheck, AlertTriangle, Clock, FileText, Plus, ArrowRight } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { Badge } from '@/shared/components/ui/Badge';

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
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiClient.get('/dashboard/overview').then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) return <div className="p-8 text-center text-text-muted">Loading...</div>;

  const { stats } = data;
  const greeting = new Date().getHours() < 12 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{greeting}! 👋</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{new Date().toLocaleDateString('vi', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/cv-upload" className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover">
          <Plus size={14} /> Upload CV
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FileText} label="CV mới tuần này" value={stats.new_this_week} color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={Briefcase} label="Jobs đang tuyển" value={stats.active_jobs} color="text-accent" bg="bg-orange-50" />
        <StatCard icon={Trophy} label="Ứng viên Gold" value={stats.gold_count} color="text-amber-600" bg="bg-amber-50" />
        <StatCard icon={CalendarCheck} label="Phỏng vấn hôm nay" value={stats.interviews_today} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard icon={AlertTriangle} label="Cần hành động" value={stats.need_review + stats.need_feedback + stats.pending_duplicates} color="text-red-600" bg="bg-red-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Action items */}
          {(stats.need_review > 0 || stats.need_feedback > 0 || stats.pending_duplicates > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h2 className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Cần hành động</h2>
              <div className="space-y-2">
                {stats.need_review > 0 && (
                  <Link to="/candidates" className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 hover:border-accent/30">
                    <span className="text-[13px] text-text-primary">📋 {stats.need_review} ứng viên chưa review</span>
                    <ArrowRight size={14} className="text-text-muted" />
                  </Link>
                )}
                {stats.need_feedback > 0 && (
                  <Link to="/interviews" className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 hover:border-accent/30">
                    <span className="text-[13px] text-text-primary">⭐ {stats.need_feedback} phỏng vấn cần feedback</span>
                    <ArrowRight size={14} className="text-text-muted" />
                  </Link>
                )}
                {stats.pending_duplicates > 0 && (
                  <Link to="/cv-upload" className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 hover:border-accent/30">
                    <span className="text-[13px] text-text-primary">⚠️ {stats.pending_duplicates} CV trùng cần xử lý</span>
                    <ArrowRight size={14} className="text-text-muted" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Recent candidates */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h2 className="text-sm font-medium text-text-primary">Ứng viên gần đây</h2>
              <Link to="/candidates" className="text-[11px] text-accent hover:underline">Xem tất cả →</Link>
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
                      <div className="text-[11px] text-text-muted">{c.job_title || 'Chưa match job'}</div>
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
                <div className="px-4 py-6 text-center text-[13px] text-text-muted">Chưa có ứng viên</div>
              )}
            </div>
          </div>

          {/* Jobs overview */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h2 className="text-sm font-medium text-text-primary">Jobs đang tuyển</h2>
              <Link to="/jobs" className="text-[11px] text-accent hover:underline">Xem tất cả →</Link>
            </div>
            <div className="divide-y divide-border-subtle">
              {data.jobs_overview.map(j => (
                <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg-surface/50 transition-colors">
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{j.title}</div>
                    {j.deadline && <div className="text-[10px] text-text-muted">Deadline: {new Date(j.deadline).toLocaleDateString('vi')}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[13px] font-medium text-text-primary">{j.candidate_count}</div>
                      <div className="text-[10px] text-text-muted">ứng viên</div>
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
                <div className="px-4 py-6 text-center text-[13px] text-text-muted">Chưa có job</div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Today's interviews */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <h2 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <CalendarCheck size={14} className="text-accent" /> Phỏng vấn hôm nay
            </h2>
            {data.today_interviews.length === 0 ? (
              <p className="text-[12px] text-text-muted py-2">Không có lịch phỏng vấn</p>
            ) : (
              <div className="space-y-2">
                {data.today_interviews.map(i => (
                  <Link key={i.id} to="/interviews" className="block p-2.5 bg-bg-surface rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-text-primary">{i.candidate_name}</span>
                      <span className="text-[10px] text-accent font-medium">
                        {new Date(i.start_time).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
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
              <Clock size={14} className="text-text-muted" /> Hoạt động gần đây
            </h2>
            <div className="space-y-2.5">
              {data.activity.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[12px] shrink-0">{activityIcons[a.type] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-text-secondary truncate">{a.detail}</div>
                    <div className="text-[10px] text-text-muted">{formatTimeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
              {data.activity.length === 0 && <p className="text-[12px] text-text-muted">Chưa có hoạt động</p>}
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

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
