import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, Briefcase, Trophy, TrendingUp, ArrowUpRight, Clock } from 'lucide-react';
import { useCandidates } from '@/features/candidates/hooks/useCandidates';
import { useJobs } from '@/features/jobs/hooks/useJobs';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';

const PIE_COLORS = ['#f59e0b', '#64748b', '#6366f1'];

export function DashboardPage() {
  const { data: candidates, isLoading: loadingC } = useCandidates();
  const { data: jobs, isLoading: loadingJ } = useJobs();

  if (loadingC || loadingJ) return <div className="text-text-tertiary text-sm">Loading…</div>;

  const gold = candidates?.filter(c => c.score?.classification === 'gold') ?? [];
  const silver = candidates?.filter(c => c.score?.classification === 'silver') ?? [];
  const pool = candidates?.filter(c => c.score?.classification === 'talent_pool') ?? [];

  const pieData = [
    { name: 'Gold', value: gold.length },
    { name: 'Silver', value: silver.length },
    { name: 'Talent Pool', value: pool.length },
  ];

  const scoreRanges = [
    { range: '0-30', count: candidates?.filter(c => (c.score?.finalScore ?? 0) < 30).length ?? 0, fill: '#ef4444' },
    { range: '30-50', count: candidates?.filter(c => { const s = c.score?.finalScore ?? 0; return s >= 30 && s < 50; }).length ?? 0, fill: '#f59e0b' },
    { range: '50-80', count: candidates?.filter(c => { const s = c.score?.finalScore ?? 0; return s >= 50 && s < 80; }).length ?? 0, fill: '#3b82f6' },
    { range: '80-100', count: candidates?.filter(c => (c.score?.finalScore ?? 0) >= 80).length ?? 0, fill: '#10b981' },
  ];

  // Mock weekly trend data
  const trendData = [
    { day: 'Mon', cvs: 3 }, { day: 'Tue', cvs: 5 }, { day: 'Wed', cvs: 2 },
    { day: 'Thu', cvs: 8 }, { day: 'Fri', cvs: 4 }, { day: 'Sat', cvs: 1 }, { day: 'Sun', cvs: 0 },
  ];

  const stats = [
    { label: 'Total CVs', value: candidates?.length ?? 0, icon: Users, color: 'bg-accent/10 text-accent', trend: '+12%' },
    { label: 'Gold Candidates', value: gold.length, icon: Trophy, color: 'bg-amber-50 text-amber-600', trend: '+5%' },
    { label: 'Active Jobs', value: jobs?.length ?? 0, icon: Briefcase, color: 'bg-blue-50 text-blue-600', trend: '+2' },
    { label: 'Avg Score', value: Math.round((candidates?.reduce((sum, c) => sum + (c.score?.finalScore ?? 0), 0) ?? 0) / (candidates?.length || 1)), icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600', trend: '+3pts' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">Overview of your recruitment pipeline</p>
        </div>
        <div className="flex gap-2">
          <Link to="/jobs" className="text-[13px] font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
            View Jobs <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-bg-panel border border-border-subtle rounded-xl p-4 hover:border-border-default transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon size={18} />
              </div>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{s.trend}</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{s.value}</div>
            <div className="text-[12px] text-text-tertiary mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        {/* Classification Pie */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <h2 className="text-sm font-medium text-text-primary mb-1">Classification</h2>
          <p className="text-[11px] text-text-muted mb-3">Candidate distribution</p>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7ef' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="text-[11px] text-text-tertiary">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Score Distribution Bar */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <h2 className="text-sm font-medium text-text-primary mb-1">Score Distribution</h2>
          <p className="text-[11px] text-text-muted mb-3">Candidates by score range</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreRanges} barSize={32}>
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6b7194' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7194' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7ef' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {scoreRanges.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Trend */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <h2 className="text-sm font-medium text-text-primary mb-1">Weekly Trend</h2>
          <p className="text-[11px] text-text-muted mb-3">CVs scanned this week</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorCvs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ED6103" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ED6103" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7194' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7194' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7ef' }} />
              <Area type="monotone" dataKey="cvs" stroke="#ED6103" strokeWidth={2} fill="url(#colorCvs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Candidates */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Recent Candidates</h2>
              <p className="text-[11px] text-text-muted mt-0.5">Latest scanned CVs</p>
            </div>
            <Link to="/candidates" className="text-[12px] text-accent hover:text-accent-hover flex items-center gap-0.5">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {candidates?.slice(0, 5).map(c => (
              <Link key={c.id} to={`/candidates/${c.id}`} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-bg-surface transition-colors -mx-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-bold shrink-0">
                    {c.structuredData.name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text-primary truncate">{c.structuredData.name}</div>
                    <div className="text-[11px] text-text-muted truncate">{c.structuredData.skills.slice(0, 3).join(' · ')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <ScoreBar score={c.score?.finalScore ?? 0} />
                  <Badge variant={c.score?.classification ?? 'neutral'}>{c.score?.classification ?? '—'}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Active Jobs */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Active Jobs</h2>
              <p className="text-[11px] text-text-muted mt-0.5">Open positions</p>
            </div>
            <Link to="/jobs" className="text-[12px] text-accent hover:text-accent-hover flex items-center gap-0.5">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {jobs?.map(j => {
              const jobCandidates = candidates?.filter(c => c.jobId === j.id) ?? [];
              const goldCount = jobCandidates.filter(c => c.score?.classification === 'gold').length;
              return (
                <Link key={j.id} to={`/jobs/${j.id}`} className="block p-3 rounded-lg border border-border-subtle hover:border-accent/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-text-primary">{j.title}</span>
                    <div className="flex items-center gap-1 text-[11px] text-text-muted">
                      <Clock size={11} />
                      {j.deadline?.slice(5, 10)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {j.requiredSkills.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-text-tertiary">{j.candidateCount} CVs</span>
                      {goldCount > 0 && <span className="text-amber-600 font-medium">{goldCount} gold</span>}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2.5 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                    {goldCount > 0 && <div className="h-full bg-amber-400" style={{ width: `${(goldCount / Math.max(j.candidateCount, 1)) * 100}%` }} />}
                    <div className="h-full bg-slate-300" style={{ width: `${((jobCandidates.length - goldCount) / Math.max(j.candidateCount, 1)) * 100}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
