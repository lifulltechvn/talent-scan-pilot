import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, Trophy, Medal, DatabaseZap } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useCandidates } from '../hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import type { Classification } from '@/domain/models/candidate';

type Filter = 'all' | Classification;

export function CandidatesPage() {
  const { data: candidates, isLoading } = useCandidates();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  if (isLoading) return <LoadingSkeleton rows={5} />;

  const filtered = (candidates ?? [])
    .filter(c => filter === 'all' || c.score?.classification === filter)
    .filter(c => !search || c.structuredData.skills.some(s => s.toLowerCase().includes(search.toLowerCase())) || c.structuredData.name.toLowerCase().includes(search.toLowerCase()));

  const gold = candidates?.filter(c => c.score?.classification === 'gold').length ?? 0;
  const silver = candidates?.filter(c => c.score?.classification === 'silver').length ?? 0;
  const pool = candidates?.filter(c => c.score?.classification === 'talent_pool').length ?? 0;

  const filters: { value: Filter; label: string; count: number; icon: typeof Trophy }[] = [
    { value: 'all', label: 'All', count: candidates?.length ?? 0, icon: Users },
    { value: 'gold', label: 'Gold', count: gold, icon: Trophy },
    { value: 'silver', label: 'Silver', count: silver, icon: Medal },
    { value: 'talent_pool', label: 'Pool', count: pool, icon: DatabaseZap },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Candidates</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{candidates?.length ?? 0} total · {gold} gold · {silver} silver</p>
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
            placeholder="Search by name or skill..."
            className="w-full pl-9 pr-3 py-2 bg-bg-panel border border-border-subtle rounded-lg text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40"
          />
        </div>
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
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-surface/50">
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
              <tr key={c.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface/30 transition-colors">
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
                <td className="px-4 py-3"><span className="text-[12px] text-text-tertiary capitalize">{c.status}</span></td>
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
              <span className="text-[11px] text-text-muted capitalize">{c.status}</span>
              <ScoreBar score={c.score?.finalScore ?? 0} />
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <EmptyState icon={Users} title="No candidates found" description="Try adjusting your search or filters" />}
      </div>
    </div>
  );
}
