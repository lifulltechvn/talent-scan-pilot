import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Briefcase, GraduationCap, Languages, DollarSign, Lightbulb, AlertTriangle, ThumbsUp } from 'lucide-react';
import { useCandidates } from '../hooks/useCandidates';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { Badge } from '@/shared/components/ui/Badge';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/shared/i18n';

function ScoreCell({ score, best }: { score: number | null; best: boolean }) {
  const val = score ?? 0;
  const color = val >= 80 ? 'text-emerald-600' : val >= 50 ? 'text-amber-600' : 'text-red-500';
  return (
    <span className={cn('text-lg font-bold', color, best && 'underline decoration-emerald-400 decoration-2 underline-offset-4')}>
      {val}
    </span>
  );
}

export function CandidateComparePage() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  const { data: allCandidates, isLoading } = useCandidates();
  const { t } = useI18n();

  if (isLoading) return <LoadingSkeleton rows={8} />;

  const candidates = (allCandidates ?? []).filter(c => ids.includes(c.id));

  if (candidates.length < 2) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted text-sm">{t('selectAtLeast2')}</p>
        <Link to="/candidates" className="text-accent text-sm mt-2 inline-block">{t('backToList')}</Link>
      </div>
    );
  }

  const bestScore = Math.max(...candidates.map(c => c.score?.finalScore ?? 0));
  const bestExp = Math.max(...candidates.map(c => c.structuredData.totalYearsExperience));

  const colStyle = { gridTemplateColumns: `repeat(${candidates.length}, 1fr)` };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => window.history.back()} className="w-8 h-8 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center hover:bg-bg-panel transition-colors">
          <ArrowLeft size={16} className="text-text-muted" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('compareTitle')}</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{t('compareCandidatesSelected', { count: candidates.length })}</p>
        </div>
      </div>

      <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden overflow-x-auto">
        {/* Header row — candidate names */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="px-4 py-4 bg-bg-surface/50 border-r border-border-subtle" />
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className={cn('px-4 py-4 border-r border-border-subtle last:border-0 text-center',
                (c.score?.finalScore ?? 0) === bestScore && 'bg-emerald-50/30')}>
                <Link to={`/candidates/${c.id}`} className="text-[13px] font-semibold text-accent hover:underline">
                  {c.structuredData.name}
                </Link>
                <div className="mt-1">
                  <Badge variant={c.score?.classification ?? 'neutral'}>{c.score?.classification ?? '—'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final Score */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <Trophy size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t('finalScore')}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className={cn('px-4 py-3 border-r border-border-subtle last:border-0 text-center',
                (c.score?.finalScore ?? 0) === bestScore && 'bg-emerald-50/30')}>
                <ScoreCell score={c.score?.finalScore ?? null} best={(c.score?.finalScore ?? 0) === bestScore} />
                <div className="text-[10px] text-text-muted mt-0.5">
                  Rule: {c.score?.ruleScore ?? '—'} · LLM: {c.score?.llmScore ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <Briefcase size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t('experience')}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className={cn('px-4 py-3 border-r border-border-subtle last:border-0',
                c.structuredData.totalYearsExperience === bestExp && 'bg-emerald-50/30')}>
                <span className={cn('text-sm font-semibold', c.structuredData.totalYearsExperience === bestExp && 'text-emerald-600')}>
                  {c.structuredData.totalYearsExperience} {t('yearsUnit')}
                </span>
                <div className="mt-1 space-y-0.5">
                  {c.structuredData.experience.slice(0, 2).map((e, i) => (
                    <div key={i} className="text-[11px] text-text-muted">{e.role} @ {e.company}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <Trophy size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("skills")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                <div className="flex flex-wrap gap-1">
                  {c.structuredData.skills.map(s => (
                    <span key={s} className="text-[10px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Education */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <GraduationCap size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("education")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                {c.structuredData.education.slice(0, 2).map((e, i) => (
                  <div key={i} className="text-[11px] text-text-secondary">
                    <span className="font-medium">{e.degree}</span> — {e.major}
                    <div className="text-text-muted">{e.school} ({e.year})</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <Languages size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("languages")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                {c.structuredData.languages.map((l, i) => (
                  <span key={i} className="text-[11px] text-text-secondary">{l.language} ({l.level}){i < c.structuredData.languages.length - 1 ? ', ' : ''}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <DollarSign size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("expectedSalary")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                <span className="text-[12px] font-medium text-text-primary">{c.structuredData.expectedSalary ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight — Strengths */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <Lightbulb size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("strengths")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                <p className="text-[11px] text-emerald-700 leading-relaxed">{c.structuredData.insight.strengths || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight — Weaknesses */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <AlertTriangle size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("weaknesses")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                <p className="text-[11px] text-red-600 leading-relaxed">{c.structuredData.insight.weaknesses || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight — Recommendation */}
        <div className="grid grid-cols-[180px_1fr]">
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-surface/50 border-r border-border-subtle">
            <ThumbsUp size={14} className="text-text-muted" />
            <span className="text-[12px] font-medium text-text-secondary">{t("recommendation")}</span>
          </div>
          <div className="grid" style={colStyle}>
            {candidates.map(c => (
              <div key={c.id} className="px-4 py-3 border-r border-border-subtle last:border-0">
                <p className="text-[11px] text-text-primary leading-relaxed">{c.structuredData.insight.recommendation || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
