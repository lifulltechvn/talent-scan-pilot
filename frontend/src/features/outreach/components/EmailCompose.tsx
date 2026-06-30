import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Undo, Redo, Send, Sparkles, Loader2, X, Minus, Maximize2 } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

interface Props {
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobTitle?: string;
  onClose: () => void;
  onSent?: () => void;
}

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

export function EmailCompose({ candidateId, candidateName, candidateEmail, jobTitle, onClose, onSent }: Props) {
  const { t, locale } = useI18n();
  const [toEmail, setToEmail] = useState(candidateEmail || '');
  const [subject, setSubject] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [purpose, setPurpose] = useState('outreach');
  const [tone, setTone] = useState('professional');
  const [signature, setSignature] = useState<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: t('composePlaceholder') }),
    ],
    content: '',
  });

  const generateAI = async () => {
    setGenerating(true); setError('');
    try {
      const { data } = await apiClient.post('/outreach/ai-generate', {
        candidate_id: candidateId, purpose, tone, job_title: jobTitle, locale,
      });
      setSubject(data.subject);
      const html = `<p>${data.greeting}</p><p>${data.body.replace(/\n/g, '</p><p>')}</p><p>${data.closing}</p>`;
      editor?.commands.setContent(html);
      setSignature(data.signature);
      setShowAI(false);
    } catch (e: any) { setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : t('aiGenerationFailed')); }
    setGenerating(false);
  };

  const handleSend = async () => {
    if (!toEmail) { setError(t('recipientRequired')); return; }
    if (!editor?.getText().trim()) { setError(t('emailEmpty')); return; }
    setSending(true); setError('');
    try {
      const bodyHtml = editor?.getHTML() || '';
      const sigHtml = signature ? `<br/><div style="border-top:1px solid #eee;padding-top:8px;margin-top:16px;font-size:12px;color:#666"><strong>${signature.name}</strong><br/>${signature.title || ''}<br/>${signature.company}<br/>${signature.email || ''}${signature.phone ? ' | ' + signature.phone : ''}</div>` : '';
      await apiClient.post('/outreach/send', {
        candidate_id: candidateId,
        to_email: toEmail,
        template_type: purpose,
        subject,
        greeting: '',
        body: bodyHtml + sigHtml,
        closing: '',
        job_title: jobTitle,
      });
      onSent?.();
      onClose();
    } catch (e: any) { setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : Array.isArray(e.response?.data?.detail) ? e.response.data.detail.map((d: any) => d.msg).join(', ') : t('sendFailed')); }
    setSending(false);
  };

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-4 w-72 bg-white rounded-t-lg shadow-xl border border-border-subtle z-50 cursor-pointer" onClick={() => setMinimized(false)}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-accent rounded-t-lg">
          <span className="text-[13px] font-medium text-white truncate">Email → {candidateName}</span>
          <div className="flex gap-1">
            <button onClick={e => { e.stopPropagation(); setMinimized(false); }} className="p-0.5 hover:bg-white/20 rounded"><Maximize2 size={12} className="text-white" /></button>
            <button onClick={e => { e.stopPropagation(); onClose(); }} className="p-0.5 hover:bg-white/20 rounded"><X size={12} className="text-white" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-4 w-[520px] bg-white rounded-t-xl shadow-2xl border border-border-subtle z-50 flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-accent rounded-t-xl shrink-0">
        <span className="text-[13px] font-medium text-white">{t('composeEmail')}</span>
        <div className="flex gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-white/20 rounded"><Minus size={14} className="text-white" /></button>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X size={14} className="text-white" /></button>
        </div>
      </div>

      {/* To + Subject */}
      <div className="shrink-0 border-b border-border-subtle">
        <div className="flex items-center px-4 py-1.5 border-b border-border-subtle">
          <span className="text-[12px] text-text-muted w-14">{t('sendTo')}</span>
          <input value={toEmail} onChange={e => setToEmail(e.target.value)} className="flex-1 text-[13px] border-0 focus:outline-none" placeholder="email@example.com" />
        </div>
        <div className="flex items-center px-4 py-1.5">
          <span className="text-[12px] text-text-muted w-14">{t('subject')}</span>
          <input value={subject} onChange={e => setSubject(e.target.value)} className="flex-1 text-[13px] border-0 focus:outline-none" placeholder={t('subjectPlaceholder')} />
        </div>
      </div>

      {/* AI Helper */}
      {showAI && (
        <div className="shrink-0 p-3 bg-accent/5 border-b border-accent/20 space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {PURPOSES.map(p => (
              <button key={p.value} onClick={() => setPurpose(p.value)} className={`px-2 py-1 text-[11px] rounded-md ${purpose === p.value ? 'bg-accent text-white' : 'bg-white border border-border-subtle text-text-muted'}`}>{t(p.labelKey)}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {TONES.map(t => (
              <button key={t.value} onClick={() => setTone(t.value)} className={`px-2 py-1 text-[11px] rounded-md ${tone === t.value ? 'bg-accent text-white' : 'bg-white border border-border-subtle text-text-muted'}`}>{t.value}</button>
            ))}
            <button onClick={generateAI} disabled={generating} className="ml-auto px-3 py-1 bg-accent text-white text-[11px] font-medium rounded-md hover:bg-accent-hover disabled:opacity-40 flex items-center gap-1">
              {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {generating ? t('generating') : t('generate')}
            </button>
          </div>
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="px-4 py-3 min-h-[200px] text-[13px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror_p.is-editor-empty]:text-text-muted" />
        {/* Signature preview */}
        {signature && (
          <div className="px-4 pb-3 text-[11px] text-text-muted border-t border-border-subtle mx-4 pt-2">
            <div className="font-medium text-text-secondary">{signature.name}</div>
            {signature.title && <div>{signature.title}</div>}
            <div>{signature.company}</div>
          </div>
        )}
      </div>

      {/* Bottom toolbar (Gmail style) */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-border-subtle bg-bg-surface">
        <div className="flex items-center gap-1">
          <button onClick={handleSend} disabled={sending} className="px-4 py-1.5 bg-accent text-white text-[13px] font-medium rounded-md hover:bg-accent-hover disabled:opacity-40 flex items-center gap-1.5">
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {t('send')}
          </button>
          {/* Formatting buttons */}
          <div className="flex items-center gap-0.5 ml-2">
            <TBtn active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={13} /></TBtn>
            <TBtn active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={13} /></TBtn>
            <TBtn active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={13} /></TBtn>
            <TBtn active={editor?.isActive('link')} onClick={() => { const u = prompt('URL:'); if (u) editor?.chain().focus().setLink({ href: u }).run(); }}><LinkIcon size={13} /></TBtn>
            <TBtn active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenter size={13} /></TBtn>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowAI(!showAI)} className={`px-2 py-1 text-[11px] rounded-md flex items-center gap-1 ${showAI ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-bg-surface'}`}>
            <Sparkles size={12} /> AI
          </button>
        </div>
      </div>

      {error && <div className="shrink-0 px-4 py-1.5 bg-red-50 text-[11px] text-red-600">{error}</div>}
    </div>
  );
}

function TBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`p-1.5 rounded ${active ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary'}`}>{children}</button>;
}
