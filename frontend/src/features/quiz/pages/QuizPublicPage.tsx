import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardCheck, Send, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/data/api/client';

interface Question {
  id: string;
  question_type: string; // text | radio | checkbox
  question: string;
  options?: string[];
  sort_order: number;
}

interface QuizData {
  quiz_id: string;
  job_title: string;
  questions: Question[];
  deadline: string;
}

type Status = 'loading' | 'ready' | 'submitting' | 'submitted' | 'expired' | 'error';

export function QuizPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    apiClient.get(`/quiz/public/${token}`)
      .then(({ data }) => { setQuiz(data); setStatus('ready'); })
      .catch((e) => {
        const code = e.response?.status;
        if (code === 410) setStatus('expired');
        else { setStatus('error'); setError(e.response?.data?.detail || 'Failed to load quiz'); }
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!quiz) return;
    const unanswered = quiz.questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) { setError('Please answer all questions before submitting.'); return; }

    setStatus('submitting');
    setError('');
    try {
      await apiClient.post(`/quiz/public/${token}/submit`, {
        answers: quiz.questions.map(q => ({ question_id: q.id, answer: answers[q.id] })),
      });
      setStatus('submitted');
    } catch (e: any) {
      setStatus('ready');
      setError(e.response?.data?.detail || 'Submission failed. Please try again.');
    }
  };

  const timeLeft = quiz ? Math.max(0, new Date(quiz.deadline).getTime() - Date.now()) : 0;
  const hoursLeft = Math.floor(timeLeft / 3600000);

  if (status === 'loading') return <PageShell><LoadingState /></PageShell>;

  if (status === 'expired') {
    return (
      <PageShell><Card>
        <div className="text-center py-10">
          <Clock size={36} className="mx-auto mb-3 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-primary mb-1">Quiz Expired</h2>
          <p className="text-[13px] text-text-tertiary">The deadline for this quiz has passed. Please contact HR.</p>
        </div>
      </Card></PageShell>
    );
  }

  if (status === 'error') {
    return (
      <PageShell><Card>
        <div className="text-center py-10">
          <AlertTriangle size={36} className="mx-auto mb-3 text-red-400" />
          <h2 className="text-lg font-semibold text-text-primary mb-1">Something went wrong</h2>
          <p className="text-[13px] text-text-tertiary">{error}</p>
        </div>
      </Card></PageShell>
    );
  }

  if (status === 'submitted') {
    return (
      <PageShell><Card>
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-1">Quiz Submitted!</h2>
          <p className="text-[13px] text-text-tertiary">Thank you for completing the quiz. Our team will review your answers shortly.</p>
        </div>
      </Card></PageShell>
    );
  }

  return (
    <PageShell>
      <Card>
        {/* Header */}
        <div className="flex items-start gap-3 mb-6 pb-5 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Verification Quiz</h1>
            <p className="text-[13px] text-text-secondary mt-0.5">
              Position: <span className="font-medium">{quiz?.job_title}</span>
            </p>
            {hoursLeft > 0 && (
              <p className="text-[12px] text-text-muted mt-1 flex items-center gap-1">
                <Clock size={11} /> {hoursLeft}h remaining
              </p>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">{error}</div>}

        {/* Questions */}
        <div className="space-y-5">
          {quiz?.questions.map((q, i) => (
            <QuestionBlock
              key={q.id}
              index={i}
              question={q}
              value={answers[q.id] || ''}
              onChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
            />
          ))}
        </div>

        {/* Submit */}
        <div className="mt-6 pt-5 border-t border-border-subtle flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={status === 'submitting'}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
            {status === 'submitting' ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </Card>
    </PageShell>
  );
}

function QuestionBlock({ index, question, value, onChange }: {
  index: number;
  question: Question;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="bg-bg-surface/50 border border-border-subtle rounded-xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-[12px] font-bold flex items-center justify-center shrink-0">{index + 1}</span>
        <p className="text-[14px] text-text-primary leading-relaxed">{question.question}</p>
      </div>

      <div className="ml-9">
        {question.question_type === 'text' && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer here..."
            rows={4}
            className="w-full px-3 py-2.5 bg-white border border-border-default rounded-lg text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y"
          />
        )}

        {question.question_type === 'radio' && question.options && (
          <div className="space-y-2">
            {question.options.map((opt) => (
              <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                value === opt ? 'border-accent bg-accent/5' : 'border-border-subtle bg-white hover:border-accent/30'
              }`}>
                <input
                  type="radio"
                  name={question.id}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="w-4 h-4 text-accent accent-[var(--color-accent)]"
                />
                <span className="text-[13px] text-text-primary">{opt}</span>
              </label>
            ))}
          </div>
        )}

        {question.question_type === 'checkbox' && question.options && (
          <CheckboxGroup
            options={question.options}
            value={value}
            onChange={onChange}
            questionId={question.id}
          />
        )}
      </div>
    </div>
  );
}

function CheckboxGroup({ options, value, onChange, questionId }: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  questionId: string;
}) {
  const selected = value ? value.split('||') : [];

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt];
    onChange(next.join('||'));
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
          selected.includes(opt) ? 'border-accent bg-accent/5' : 'border-border-subtle bg-white hover:border-accent/30'
        }`}>
          <input
            type="checkbox"
            name={questionId}
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="w-4 h-4 rounded accent-[var(--color-accent)]"
          />
          <span className="text-[13px] text-text-primary">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-border-subtle rounded-2xl p-6 shadow-sm">{children}</div>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-primary to-bg-surface/50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          <span className="relative w-7 h-7 rounded-md flex items-center justify-center">
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-accent" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-accent" />
            <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-accent" />
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-accent" />
            <ClipboardCheck size={14} className="text-accent" />
          </span>
          <span className="text-sm font-semibold text-accent">LF Talent Scan</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-14">
        <div className="relative w-12 h-12 mb-3">
          <div className="absolute inset-0 border-[3px] border-accent/10 border-t-accent rounded-full animate-spin" />
        </div>
        <p className="text-[13px] text-text-muted">Loading quiz...</p>
      </div>
    </Card>
  );
}
