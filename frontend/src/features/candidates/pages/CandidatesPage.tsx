import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, Trophy, Medal, DatabaseZap, LayoutList, Columns3, GitCompareArrows, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useCandidates } from '../hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import { KanbanBoard } from '../components/KanbanBoard';
import { useI18n } from '@/shared/i18n';

type Filter = 'all' | 'new' | 'reviewed' | 'approved' | 'rejected';
type ViewMode = 'list' | 'kanban';

export function CandidatesPage() {
  const { data: candidates, isLoading } = useCandidates();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('kanban');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { t } = useI18n();

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 4) next.add(id);
      return next;
    });
  };

  if (isLoading) return <LoadingSkeleton rows={5} />;

  const filtered = (candidates ?? [])
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => !search || c.structuredData.skills.some(s => s.toLowerCase().includes(search.toLowerCase())) || c.structuredData.name.toLowerCase().includes(search.toLowerCase()));

  const newCount = candidates?.filter(c => c.status === 'new').length ?? 0;
  const reviewedCount = candidates?.filter(c => c.status === 'reviewed').length ?? 0;
  const approvedCount = candidates?.filter(c => c.status === 'approved').length ?? 0;
  const rejectedCount = candidates?.filter(c => c.status === 'rejected').length ?? 0;

  const filters: { value: Filter; label: string; count: number; icon: typeof Trophy }[] = [
    { value: 'all', label: t('all'), count: candidates?.length ?? 0, icon: Users },
    { value: 'new', label: 'New', count: newCount, icon: Users },
    { value: 'reviewed', label: 'Reviewed', count: reviewedCount, icon: Users },
    { value: 'approved', label: 'Approved', count: approvedCount, icon: CheckCircle as any },
    { value: 'rejected', label: 'Rejected', count: rejectedCount, icon: XCircle as any },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('candidatesTitle')}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{candidates?.length ?? 0} total · {newCount} new · {approvedCount} approved</p>
        </div>
        {/* View toggle + Compare button */}
        <div className="flex items-center gap-2">
          {selected.size >= 2 && (
            <button
              onClick={() => navigate(`/candidates/compare?ids=${[...selected].join(',')}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-[12px] font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              <GitCompareArrows size={13} /> {t('compare')} ({selected.size})
            </button>
          )}
          {selected.size > 0 && selected.size < 2 && (
            <span className="text-[11px] text-text-muted">{t('selectMoreToCompare', { count: 2 - selected.size })}</span>
          )}
          <div className="flex items-center gap-1 bg-bg-surface border border-border-subtle rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                view === 'list' ? 'bg-bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}
            >
              <LayoutList size={13} /> {t('list')}
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                view === 'kanban' ? 'bg-bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}
            >
              <Columns3 size={13} /> {t('pipeline')}
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchByNameOrSkill')}
            className="w-full pl-9 pr-3 py-2 bg-bg-panel border border-border-subtle rounded-lg text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40"
          />
        </div>
        {view === 'list' && (
          <div className="flex gap-1.5">
            {filters.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg transition-colors',
                  filter === f.value ? 'bg-accent text-white' : 'bg-bg-panel border border-border-subtle text-text-secondary hover:text-text-primary'
                )}
              >
                <f.icon size={13} />
                {f.label}
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', filter === f.value ? 'bg-white/20' : 'bg-bg-surface')}>{f.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kanban view */}
      {view === 'kanban' && <KanbanBoard candidates={filtered} />}

      {/* List view */}
      {view === 'list' && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface/50">
                  <th className="w-10 px-3 py-3" />
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-3">Candidate</th>
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-3">Skills</th>
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-3">Exp</th>
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-3">Score</th>
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-3">Class</th>
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={cn('border-b border-border-subtle last:border-0 hover:bg-bg-surface/30 transition-colors', selected.has(c.id) && 'bg-accent/5')}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="w-3.5 h-3.5 rounded border-border-subtle text-accent focus:ring-accent/30 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/candidates/${c.id}`} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-bold shrink-0">
                          {c.structuredData.name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
                        </div>
                        <div>
                          <span className="text-[13px] font-medium text-accent hover:underline">{c.structuredData.name}</span>
                          <div className="text-[11px] text-text-muted">{c.structuredData.totalYearsExperience}y · {c.structuredData.languages.map(l => l.language).join(', ')}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.structuredData.skills.slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {c.structuredData.skills.length > 3 && <span className="text-[10px] text-text-muted">+{c.structuredData.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">{c.structuredData.totalYearsExperience}y</td>
                    <td className="px-4 py-3"><ScoreBar score={c.score?.finalScore ?? 0} /></td>
                    <td className="px-4 py-3"><Badge variant={c.score?.classification ?? 'neutral'}>{c.score?.classification ?? '—'}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-text-tertiary capitalize">{c.status}</span>
                        {c.quizStatus === 'pending' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Quiz Pending</span>}
                        {c.quizStatus === 'submitted' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Quiz Submitted</span>}
                        {c.quizStatus === 'evaluated' && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Quiz Evaluated</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <EmptyState icon={Users} title="No candidates found" description="Try adjusting your search or filters" />}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(c => (
              <Link key={c.id} to={`/candidates/${c.id}`} className="block bg-bg-panel border border-border-subtle rounded-xl p-3 hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-bold shrink-0">
                    {c.structuredData.name.replace(/[\[\]NAME-]/g, '').trim().charAt(0) || 'C'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-accent truncate block">{c.structuredData.name}</span>
                    <span className="text-[11px] text-text-muted">{c.structuredData.totalYearsExperience}y exp</span>
                  </div>
                  <Badge variant={c.score?.classification ?? 'neutral'}>{c.score?.classification ?? '—'}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {c.structuredData.skills.slice(0, 4).map(s => (
                    <span key={s} className="text-[10px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-text-muted capitalize">{c.status}</span>
                    {c.quizStatus === 'pending' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Quiz</span>}
                    {c.quizStatus === 'evaluated' && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">✓ Quiz</span>}
                  </div>
                  <ScoreBar score={c.score?.finalScore ?? 0} />
                </div>
              </Link>
            ))}
            {filtered.length === 0 && <EmptyState icon={Users} title="No candidates found" description="Try adjusting your search or filters" />}
          </div>
        </>
      )}
    </div>
  );
}
