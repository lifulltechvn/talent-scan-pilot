import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, Eye, Briefcase, Calendar, CheckCircle, XCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCandidates, useUpdateCandidateStatus } from '../hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useI18n } from '@/shared/i18n';
import type { Candidate, CandidateStatus } from '@/domain/models/candidate';

const PAGE_SIZE = 20;

const STATUS_TABS: { key: CandidateStatus | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'tabAll' },
  { key: 'new', labelKey: 'tabNew' },
  { key: 'reviewed', labelKey: 'tabReviewed' },
  { key: 'assigned', labelKey: 'tabAssigned' },
  { key: 'pending', labelKey: 'tabInterviewing' },
  { key: 'approved', labelKey: 'tabApproved' },
  { key: 'rejected', labelKey: 'tabRejected' },
];

const STATUS_BADGE: Record<string, { labelKey: string; cls: string }> = {
  processing: { labelKey: 'statusProcessing', cls: 'bg-gray-100 text-gray-600' },
  new: { labelKey: 'tabNew', cls: 'bg-blue-100 text-blue-700' },
  reviewed: { labelKey: 'tabReviewed', cls: 'bg-amber-100 text-amber-700' },
  assigned: { labelKey: 'tabAssigned', cls: 'bg-purple-100 text-purple-700' },
  pending: { labelKey: 'statusInterviewing', cls: 'bg-cyan-100 text-cyan-700' },
  pending_feedback: { labelKey: 'statusPendingFeedback', cls: 'bg-orange-100 text-orange-700' },
  approved: { labelKey: 'tabApproved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { labelKey: 'tabRejected', cls: 'bg-red-100 text-red-700' },
};

function getCandidateBadge(c: Candidate) {
  if (c.status === 'pending' && c.interviewEndTime && new Date(c.interviewEndTime) < new Date()) {
    return STATUS_BADGE.pending_feedback;
  }
  return STATUS_BADGE[c.status] || STATUS_BADGE.new;
}

type SortKey = 'name' | 'score' | 'date';

export function CandidatesPage() {
  const { t, locale } = useI18n();
  const { data: candidates, isLoading } = useCandidates();
  const [enrichWait, setEnrichWait] = useState(true);

  // Wait up to 3s for G-level data if any candidate is missing it
  useEffect(() => {
    if (!candidates || candidates.length === 0) { setEnrichWait(false); return; }
    const allHaveG = candidates.every((c: any) => c.structuredData?.skill_level || c.structured_data?.skill_level);
    if (allHaveG) { setEnrichWait(false); return; }
    const timer = setTimeout(() => setEnrichWait(false), 3000);
    return () => clearTimeout(timer);
  }, [candidates]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<CandidateStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const all = useMemo(() => (candidates ?? []).filter(c => c.status !== 'processing'), [candidates]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of all) m[c.status] = (m[c.status] || 0) + 1;
    return m;
  }, [all]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? all : all.filter(c => c.status === tab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.structuredData.name?.toLowerCase().includes(q) ||
        c.structuredData.skills?.some(s => s.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = (a.structuredData.name || '').localeCompare(b.structuredData.name || '');
      else if (sortBy === 'score') cmp = (a.score?.finalScore ?? 0) - (b.score?.finalScore ?? 0);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [all, tab, search, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const changeTab = (t: CandidateStatus | 'all') => { setTab(t); setPage(1); };
  const changeSearch = (v: string) => { setSearch(v); setPage(1); };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
    setPage(1);
  };

  if (isLoading || enrichWait) return <LoadingSkeleton rows={8} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('candidates')}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{t('candidateCount', { count: all.length })}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(st => {
          const count = st.key === 'all' ? all.length : (counts[st.key] || 0);
          const active = tab === st.key;
          return (
            <button
              key={st.key}
              onClick={() => changeTab(st.key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-accent text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface/80'
              }`}
            >
              {t(st.labelKey as any)} <span className={`ml-1 ${active ? 'text-white/80' : 'text-text-muted'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search + Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => changeSearch(e.target.value)}
            placeholder={t('searchNameOrSkill')}
            className="w-full pl-9 pr-3 py-2 bg-bg-panel border border-border-subtle rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <SortButton label={t('sortDate')} active={sortBy === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
          <SortButton label={t('score')} active={sortBy === 'score'} dir={sortDir} onClick={() => toggleSort('score')} />
          <SortButton label={t('sortName')} active={sortBy === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('noCandidates')} description={search ? t('tryOtherKeywords') : t('uploadCvToStart')} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1fr_100px_100px_100px_140px] gap-3 px-4 py-2.5 border-b border-border-subtle text-[11px] font-medium text-text-muted uppercase tracking-wide">
              <span>{t('candidateCol')}</span>
              <span>{t('jobCol')}</span>
              <span>{t('createdCol')}</span>
              <span>{t('updatedCol')}</span>
              <span>{t('statusCol')}</span>
              <span>{t('actionCol')}</span>
            </div>
            <div className="divide-y divide-border-subtle">
              {paged.map(c => <CandidateRowDesktop key={c.id} candidate={c} />)}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paged.map(c => <CandidateRowMobile key={c.id} candidate={c} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-[12px] text-text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-[12px] font-medium ${
                        page === p ? 'bg-accent text-white' : 'hover:bg-bg-surface text-text-secondary'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Desktop row */
function CandidateRowDesktop({ candidate: c }: { candidate: Candidate }) {
  const { t, locale } = useI18n();
  const badge = getCandidateBadge(c);
  const navigate = useNavigate();
  const updateStatus = useUpdateCandidateStatus();

  return (
    <div className="grid grid-cols-[1.2fr_1fr_100px_100px_100px_140px] gap-3 px-4 py-3 hover:bg-bg-surface/50 transition-colors items-center">
      <Link to={`/candidates/${c.id}`} className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[12px] font-bold shrink-0">
          {c.structuredData.name?.charAt(0) || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-text-primary truncate">{c.structuredData.name}</p>
          <p className="text-[11px] text-text-muted">
            {c.structuredData.skill_level && <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-md mr-1.5">{c.structuredData.skill_level.level} <span className="font-normal text-purple-400 border-l border-purple-200 pl-1.5">{c.structuredData.skill_level.category_title?.[locale] || c.structuredData.skill_level.category_title?.en}</span></span>}{c.sourceJobTitle && <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-md mr-1.5">📌 {c.sourceJobTitle}</span>}
            {c.structuredData.totalYearsExperience ? t('yearsExpShort', { years: c.structuredData.totalYearsExperience }) : ''}
          </p>
        </div>
      </Link>
      <div className="text-[12px] text-text-secondary truncate">{c.jobTitle || '—'}</div>
      <div className="text-[12px] text-text-muted">{fmtDate(c.createdAt)}</div>
      <div className="text-[12px] text-text-muted">{fmtDate(c.updatedAt)}</div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${badge.cls}`}>{t(badge.labelKey as any)}</span>
      <StatusAction status={c.status} candidateId={c.id} navigate={navigate} updateStatus={updateStatus} />
    </div>
  );
}

/* Mobile card */
function CandidateRowMobile({ candidate: c }: { candidate: Candidate }) {
  const { t, locale } = useI18n();
  const badge = getCandidateBadge(c);
  const navigate = useNavigate();
  const updateStatus = useUpdateCandidateStatus();

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Link to={`/candidates/${c.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[13px] font-bold shrink-0">
            {c.structuredData.name?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-text-primary truncate">{c.structuredData.name}</p>
            <p className="text-[12px] text-text-muted">
              {c.structuredData.skill_level && <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-md mr-1.5">{c.structuredData.skill_level.level} <span className="font-normal text-purple-400 border-l border-purple-200 pl-1.5">{c.structuredData.skill_level.category_title?.[locale] || c.structuredData.skill_level.category_title?.en}</span></span>}
              {c.structuredData.totalYearsExperience ? t('yearsExpShort', { years: c.structuredData.totalYearsExperience }) : ''}
            </p>
          </div>
        </Link>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${badge.cls}`}>{t(badge.labelKey as any)}</span>
      </div>
      <div className="flex items-center justify-between text-[12px] text-text-muted mt-2">
        <div className="flex items-center gap-3">
          {c.jobTitle && <span className="text-text-secondary">{c.jobTitle}</span>}
          <span>{fmtDate(c.createdAt)}</span>
        </div>
        <StatusAction status={c.status} candidateId={c.id} navigate={navigate} updateStatus={updateStatus} />
      </div>
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function StatusAction({ status, candidateId, navigate, updateStatus }: {
  status: string;
  candidateId: string;
  navigate: (path: string) => void;
  updateStatus: ReturnType<typeof useUpdateCandidateStatus>;
}) {
  const { t, locale } = useI18n();
  const base = 'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors';

  switch (status) {
    case 'new':
      return (
        <button onClick={() => navigate(`/candidates/${candidateId}`)} className={`${base} bg-blue-50 text-blue-700 hover:bg-blue-100`}>
          <Eye size={12} /> {t('review')}
        </button>
      );
    case 'reviewed':
      return (
        <button onClick={() => navigate(`/jobs`)} className={`${base} bg-purple-50 text-purple-700 hover:bg-purple-100`}>
          <Briefcase size={12} /> {t('assignJob')}
        </button>
      );
    case 'assigned':
      return (
        <button onClick={() => navigate(`/interviews`)} className={`${base} bg-cyan-50 text-cyan-700 hover:bg-cyan-100`}>
          <Calendar size={12} /> {t('bookInterview')}
        </button>
      );
    case 'pending':
      return (
        <span className={`${base} bg-cyan-50 text-cyan-600`}>
          <Calendar size={12} /> {t('waitingInterview')}
        </span>
      );
    case 'approved':
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700`}>
          <CheckCircle size={12} /> {t('done')}
        </span>
      );
    case 'rejected':
      return (
        <span className={`${base} bg-red-50 text-red-600`}>
          <XCircle size={12} /> {t('rejected')}
        </span>
      );
    default:
      return <span className="text-[11px] text-text-muted">—</span>;
  }
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
        active ? 'bg-accent/10 text-accent' : 'bg-bg-surface text-text-secondary hover:bg-bg-surface/80'
      }`}
    >
      {label}
      <ArrowUpDown size={12} className={active ? (dir === 'asc' ? 'rotate-180' : '') : 'opacity-40'} />
    </button>
  );
}
