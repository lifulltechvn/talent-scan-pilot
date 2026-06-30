import { useState } from 'react';
import { X, Star, Send } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

interface Props {
  candidateId: string;
  candidateName: string;
  jobId?: string;
  jobTitle: string;
  round: number;
  onClose: () => void;
  onSaved: () => void;
}

export function FeedbackModal({ candidateId, candidateName, jobId, jobTitle, round, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [decision, setDecision] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!rating || !decision || !interviewer.trim()) { setError(t('feedbackRequired')); return; }
    setSending(true);
    try {
      await apiClient.post('/interviews/feedback', {
        candidate_id: candidateId, job_id: jobId, interviewer, round, rating, decision,
        strengths: strengths || null, weaknesses: weaknesses || null, notes: notes || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.detail || t('failedToSave'));
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{t('interviewFeedback')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-[13px] text-text-secondary">
            <span className="font-medium text-text-primary">{candidateName}</span> · {jobTitle} · {t('round', { round })}
          </div>

          {/* Interviewer */}
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('interviewer')}</label>
            <input value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder={t('yourName')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
          </div>

          {/* Rating */}
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('rating')}</label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)} className={`p-1.5 rounded-lg transition-colors ${rating >= n ? 'text-amber-500' : 'text-border-subtle hover:text-amber-300'}`}>
                  <Star size={22} fill={rating >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('decision')}</label>
            <div className="flex gap-2 mt-1.5">
              {[{ v: 'pass', l: t('pass'), c: 'bg-emerald-50 text-emerald-700 border-emerald-200' }, { v: 'next_round', l: t('nextRound'), c: 'bg-blue-50 text-blue-700 border-blue-200' }, { v: 'fail', l: t('fail'), c: 'bg-red-50 text-red-700 border-red-200' }].map(d => (
                <button key={d.v} type="button" onClick={() => setDecision(d.v)} className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${decision === d.v ? d.c : 'border-border-subtle text-text-muted hover:border-border-default'}`}>
                  {d.l}
                </button>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('strengthsLabel')}</label>
            <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={2} placeholder={t('strengthsPlaceholder')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
          </div>

          {/* Weaknesses */}
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('weaknessesLabel')}</label>
            <textarea value={weaknesses} onChange={e => setWeaknesses(e.target.value)} rows={2} placeholder={t('weaknessesPlaceholder')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase tracking-wider">{t('notesLabel')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
          </div>

          {error && <p className="text-[13px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end pt-2">
            <button onClick={handleSubmit} disabled={sending} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors">
              <Send size={14} /> {sending ? t('saving') : t('saveFeedback')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
