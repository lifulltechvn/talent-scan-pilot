import { useState, useEffect } from 'react';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

const PURPOSES = [
  { value: 'interview_invite', labelKey: 'purposeInterviewInvite' as const },
  { value: 'outreach', labelKey: 'purposeOutreach' as const },
  { value: 'follow_up', labelKey: 'purposeFollowUp' as const },
  { value: 'rejection', labelKey: 'purposeRejection' as const },
  { value: 'offer', labelKey: 'purposeOffer' as const },
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
];

interface Props {
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobTitle?: string;
  onClose: () => void;
  onSent?: () => void;
}

export function AIEmailComposer({ candidateId, candidateName, candidateEmail, jobTitle, onClose, onSent }: Props) {
  const { t, locale } = useI18n();
  const [purpose, setPurpose] = useState('outreach');
  const [tone, setTone] = useState('professional');
  const [extraContext, setExtraContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Generated email
  const [subject, setSubject] = useState('');
  const [greeting, setGreeting] = useState('');
  const [body, setBody] = useState('');
  const [closing, setClosing] = useState('');
  const [signature, setSignature] = useState<any>(null);
  const [generated, setGenerated] = useState(false);
  const [toEmail, setToEmail] = useState(candidateEmail || '');

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const { data } = await apiClient.post('/outreach/ai-generate', {
        candidate_id: candidateId,
        purpose, tone,
        job_title: jobTitle,
        extra_context: extraContext || null, locale,
      });
      setSubject(data.subject);
      setGreeting(data.greeting);
      setBody(data.body);
      setClosing(data.closing);
      setSignature(data.signature);
      setGenerated(true);
    } catch (e: any) { setError(e.response?.data?.detail || t('cannotGenerateEmail')); }
    setGenerating(false);
  };

  const handleSend = async () => {
    if (!toEmail) { setError(t('recipientRequired')); return; }
    setSending(true); setError('');
    try {
      await apiClient.post('/outreach/send', {
        candidate_id: candidateId,
        to_email: toEmail,
        template_type: purpose,
        subject, greeting, body,
        closing,
        job_title: jobTitle,
      });
      onSent?.();
      onClose();
    } catch (e: any) { setError(e.response?.data?.detail || t('sendFailed')); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-white" />
            <h2 className="text-[15px] font-semibold text-white">{t('aiEmailWriter')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!generated ? (
            <>
              {/* Step 1: Choose purpose + tone */}
              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase">{t('emailPurpose')}</label>
                <div className="mt-1.5 space-y-1.5">
                  {PURPOSES.map(p => (
                    <button key={p.value} onClick={() => setPurpose(p.value)} className={`w-full text-left px-3 py-2 text-[13px] rounded-lg border transition-colors ${purpose === p.value ? 'border-accent bg-accent/5 text-accent font-medium' : 'border-border-subtle text-text-secondary hover:bg-bg-surface'}`}>
                      {t(p.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase">{t('tone')}</label>
                <div className="flex gap-2 mt-1.5">
                  {TONES.map(tn => (
                    <button key={tn.value} onClick={() => setTone(tn.value)} className={`flex-1 py-2 text-[12px] font-medium rounded-lg border ${tone === tn.value ? 'border-accent bg-accent/10 text-accent' : 'border-border-subtle text-text-muted'}`}>
                      {tn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase">{t('extraNotesForAI')}</label>
                <input value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder={t('extraNotesPlaceholder')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
              </div>

              {error && <p className="text-[12px] text-red-600">{error}</p>}

              <button onClick={generate} disabled={generating} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 flex items-center justify-center gap-2">
                {generating ? <><Loader2 size={14} className="animate-spin" /> {t('aiWriting')}</> : <><Sparkles size={14} /> {t('generateEmailFor', { name: candidateName })}</>}
              </button>
            </>
          ) : (
            <>
              {/* Step 2: Review + Edit + Send */}
              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase">{t('sendToLabel')}</label>
                <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="candidate@email.com" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
              </div>

              <div>
                <label className="text-[12px] font-medium text-text-muted uppercase">{t('subject')}</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
              </div>

              {/* Email Preview */}
              <div className="border border-border-subtle rounded-lg overflow-hidden">
                <div className="bg-bg-surface px-4 py-2 text-[10px] text-text-muted uppercase font-medium">{t('preview')}</div>
                <div className="p-4 space-y-3">
                  <input value={greeting} onChange={e => setGreeting(e.target.value)} className="w-full text-[13px] text-text-primary font-medium border-0 border-b border-dashed border-border-subtle pb-1 focus:outline-none focus:border-accent" />
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className="w-full text-[13px] text-text-secondary border-0 border-b border-dashed border-border-subtle pb-2 focus:outline-none focus:border-accent resize-y" />
                  <input value={closing} onChange={e => setClosing(e.target.value)} className="w-full text-[13px] text-text-secondary border-0 border-b border-dashed border-border-subtle pb-1 focus:outline-none focus:border-accent" />
                  {/* Signature */}
                  {signature && (
                    <div className="pt-2 border-t border-border-subtle text-[11px] text-text-muted">
                      <div className="font-medium text-text-secondary">{signature.name}</div>
                      {signature.title && <div>{signature.title}</div>}
                      <div>{signature.company}</div>
                      {signature.email && <div>{signature.email}</div>}
                      {signature.phone && <div>{signature.phone}</div>}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-[12px] text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button onClick={() => setGenerated(false)} className="flex-1 py-2.5 text-[13px] font-medium text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-surface">
                  {t('regenerate')}
                </button>
                <button onClick={handleSend} disabled={sending} className="flex-1 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? t('sending') : t('sendEmail')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
