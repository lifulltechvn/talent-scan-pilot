import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, Lightbulb, Brain } from 'lucide-react';
import { apiClient } from '@/data/api/client';

interface ScoreBreakdownItem {
  score: number;
  weight: number;
  matched?: string[];
  missing?: string[];
  note?: string;
}

interface ScoreExplanationData {
  candidate_name: string;
  final_score: number;
  rule_score: number;
  llm_score: number | null;
  classification: string;
  breakdown: {
    skills: ScoreBreakdownItem;
    cosine_similarity: ScoreBreakdownItem;
    experience: ScoreBreakdownItem;
    education: ScoreBreakdownItem;
    language: ScoreBreakdownItem;
  };
  ai_assessment: {
    score: number | null;
    summary: string;
    strengths: string[];
    concerns: string[];
    suggestion: string;
  };
  formula: string;
}

function BreakdownBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-gray-600 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-medium w-10 text-right">{score}</span>
      <span className="text-xs text-gray-400 w-10">×{(weight * 100).toFixed(0)}%</span>
    </div>
  );
}

export function ScoreExplanation({ candidateId }: { candidateId: string }) {
  const { data, isLoading, error } = useQuery<ScoreExplanationData>({
    queryKey: ['score-explanation', candidateId],
    queryFn: () => apiClient.get(`/scoring/candidates/${candidateId}/explanation`).then(r => r.data),
    enabled: !!candidateId,
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />;
  if (error || !data) return null;

  const { breakdown, ai_assessment } = data;

  return (
    <div className="space-y-4">
      {/* Score Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold">{data.final_score}</span>
          <span className="text-sm text-gray-500 ml-1">/ 100</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          data.classification === 'gold' ? 'bg-amber-100 text-amber-700' :
          data.classification === 'silver' ? 'bg-gray-100 text-gray-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {data.classification?.toUpperCase()}
        </span>
      </div>

      {/* Rule Breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Score Breakdown</h4>
        <BreakdownBar label="Skills" score={breakdown.skills.score} weight={breakdown.skills.weight} />
        <BreakdownBar label="Similarity" score={breakdown.cosine_similarity.score} weight={breakdown.cosine_similarity.weight} />
        <BreakdownBar label="Experience" score={breakdown.experience.score} weight={breakdown.experience.weight} />
        <BreakdownBar label="Education" score={breakdown.education.score} weight={breakdown.education.weight} />
        <BreakdownBar label="Language" score={breakdown.language.score} weight={breakdown.language.weight} />
      </div>

      {/* Skills Detail */}
      {(breakdown.skills.matched?.length || breakdown.skills.missing?.length) && (
        <div className="space-y-1">
          {breakdown.skills.matched?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {breakdown.skills.matched.map(s => (
                <span key={s} className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-full">{s}</span>
              ))}
            </div>
          )}
          {breakdown.skills.missing?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {breakdown.skills.missing.map(s => (
                <span key={s} className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded-full line-through">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Assessment */}
      {ai_assessment.summary && (
        <div className="bg-blue-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Brain size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">AI Assessment</span>
            {ai_assessment.score && <span className="text-xs text-blue-500 ml-auto">{ai_assessment.score}/100</span>}
          </div>
          <p className="text-sm text-blue-900">{ai_assessment.summary}</p>

          {ai_assessment.strengths.length > 0 && (
            <div className="flex items-start gap-1.5">
              <CheckCircle size={13} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-700">{ai_assessment.strengths.join(' • ')}</p>
            </div>
          )}
          {ai_assessment.concerns.length > 0 && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-700">{ai_assessment.concerns.join(' • ')}</p>
            </div>
          )}
          {ai_assessment.suggestion && (
            <div className="flex items-start gap-1.5">
              <Lightbulb size={13} className="text-purple-600 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-700 italic">{ai_assessment.suggestion}</p>
            </div>
          )}
        </div>
      )}

      {/* Formula */}
      <p className="text-xs text-gray-400 text-center">{data.formula}</p>
    </div>
  );
}
