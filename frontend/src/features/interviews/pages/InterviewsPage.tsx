import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Star, MessageSquare, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

interface Interview {
  id: string;
  candidate_id: string;
  candidate_name: string;
  job_id: string | null;
  job_title: string | null;
  title: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  interviewer_emails: string[];
  status: string;
  round: number;
  proposed_salary: string | null;
  meeting_link: string | null;
  interview_type: string;
  feedback_score: number | null;
  feedback_notes: string | null;
  feedback_decision: string | null;
}

interface Candidate {
  id: string;
  name: string;
  job_id: string | null;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function fmtDay(d: Date, locale: string) { return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }); }

export function InterviewsPage() {
  const { t, locale } = useI18n();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showCreate, setShowCreate] = useState<{ date: string; time: string } | false>(false);
  const [showDetail, setShowDetail] = useState<Interview | null>(null);
  const [showFeedback, setShowFeedback] = useState<Interview | null>(null);
  const [bookNextRound, setBookNextRound] = useState<Interview | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchInterviews = () => {
    apiClient.get('/interviews').then(({ data }) => setInterviews(data)).catch(() => {});
  };

  useEffect(() => {
    fetchInterviews();
    apiClient.get('/candidates').then(({ data }) => {
      setCandidates(data.filter((c: any) => c.status === 'assigned' || c.status === 'pending').map((c: any) => ({
        id: c.id, name: c.structured_data?.name || 'Unknown', job_id: c.job_id,
      })));
    }).catch(() => {});
    apiClient.get('/jobs').then(({ data }) => setJobs(data.map((j: any) => ({ id: j.id, title: j.title })))).catch(() => {});
  }, []);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const goToday = () => setCurrentDate(new Date());

  const getEventsForSlot = (date: Date, hour: number) => {
    return interviews.filter(i => {
      const start = new Date(i.start_time);
      return fmt(start) === fmt(date) && start.getHours() === hour;
    });
  };

  const today = new Date();
  const todayInterviews = interviews.filter(i => fmt(new Date(i.start_time)) === fmt(today));
  const needFeedback = interviews.filter(i => i.status === 'scheduled' && new Date(i.end_time) < today);

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-80px)]">
      {/* Calendar */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-text-primary">{t('interviewsTitle')}</h1>
          <button onClick={() => setShowCreate({ date: new Date().toISOString().slice(0, 10), time: '09:00' })} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover">
            <Plus size={14} /> {t('createSchedule')}
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={prevWeek} className="p-1.5 hover:bg-bg-surface rounded-lg"><ChevronLeft size={16} /></button>
          <button onClick={goToday} className="text-[12px] font-medium text-accent px-2 py-1 hover:bg-accent/5 rounded-md">{t('todayLabel')}</button>
          <button onClick={nextWeek} className="p-1.5 hover:bg-bg-surface rounded-lg"><ChevronRight size={16} /></button>
          <span className="text-sm font-medium text-text-primary">
            {weekDates[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Week grid */}
        <div className="flex-1 bg-bg-panel border border-border-subtle rounded-xl overflow-auto min-w-0">
          <div className="min-w-[600px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-bg-panel">
              <tr>
                <th className="w-14 text-[10px] text-text-muted font-medium p-2 border-b border-border-subtle"></th>
                {weekDates.map(d => (
                  <th key={fmt(d)} className={`text-[11px] font-medium p-2 border-b border-border-subtle ${fmt(d) === fmt(today) ? 'text-accent' : 'text-text-secondary'}`}>
                    {fmtDay(d, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(hour => (
                <tr key={hour} className="h-14" id={`hour-${hour}`}>
                  <td className="text-[10px] text-text-muted text-right pr-2 align-top pt-1 border-r border-border-subtle">
                    {String(hour).padStart(2, '0')}:00
                  </td>
                  {weekDates.map(d => {
                    const events = getEventsForSlot(d, hour);
                    return (
                      <td key={fmt(d) + hour} onClick={() => setShowCreate({ date: fmt(d), time: `${String(hour).padStart(2, '0')}:00` })} className="border-b border-r border-border-subtle/50 p-0.5 align-top relative cursor-pointer hover:bg-accent/5">
                        {events.map(ev => (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setShowDetail(ev); }}
                            className={`text-[10px] px-1.5 py-1 rounded cursor-pointer truncate ${
                              ev.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-accent/10 text-accent'
                            }`}
                          >
                            <div className="font-medium truncate">{ev.candidate_name}</div>
                            <div className="truncate opacity-70">R{ev.round || 1} · {ev.interview_type || 'online'} · {ev.job_title || ev.title}</div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-64 shrink-0 space-y-4 order-first lg:order-last">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <h2 className="text-sm font-medium text-text-primary mb-3">{t('todaySchedule', { count: todayInterviews.length })}</h2>
          {todayInterviews.length === 0 ? (
            <p className="text-xs text-text-muted">{t('noScheduleToday')}</p>
          ) : (
            <div className="space-y-2">
              {todayInterviews.map(i => (
                <div key={i.id} className="p-2 bg-bg-surface rounded-lg cursor-pointer hover:bg-accent/5" onClick={() => {
                  setCurrentDate(new Date(i.start_time));
                  const hour = new Date(i.start_time).getHours();
                  setTimeout(() => document.getElementById(`hour-${hour}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                  setShowDetail(i);
                }}>
                  <div className="text-[12px] font-medium text-text-primary">{i.candidate_name}</div>
                  <div className="text-[10px] text-text-muted">{new Date(i.start_time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} — {i.job_title || i.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {needFeedback.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-amber-800 mb-3">{t('needFeedbackTitle', { count: needFeedback.length })}</h2>
            <div className="space-y-2">
              {needFeedback.map(i => (
                <div key={i.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                  <div>
                    <div className="text-[12px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[10px] text-text-muted">{new Date(i.start_time).toLocaleDateString(locale)}</div>
                  </div>
                  <button onClick={() => setShowFeedback(i)} className="text-[11px] text-accent hover:underline">{t('feedbackBtn')}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Need next round scheduling */}
        {interviews.filter(i => i.feedback_decision === 'next_round' && !interviews.some(j => j.candidate_id === i.candidate_id && j.round > i.round)).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-blue-800 mb-3">{t('needNextRoundTitle')}</h2>
            <div className="space-y-2">
              {interviews.filter(i => i.feedback_decision === 'next_round' && !interviews.some(j => j.candidate_id === i.candidate_id && j.round > i.round)).map(i => (
                <div key={i.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-100">
                  <div>
                    <div className="text-[12px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[10px] text-text-muted">{t('roundPassedNote', { round: i.round || 1, job: i.job_title })}</div>
                  </div>
                  <button onClick={() => setBookNextRound(i)} className="text-[11px] text-blue-600 font-medium hover:underline">{t('scheduleRoundBtn', { round: (i.round || 1) + 1 })}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateModal candidates={candidates} jobs={jobs} defaultDate={showCreate.date} defaultTime={showCreate.time} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchInterviews(); }} />}
      {showDetail && <DetailModal interview={showDetail} onClose={() => setShowDetail(null)} onFeedback={() => { setShowFeedback(showDetail); setShowDetail(null); }} onDeleted={() => { setShowDetail(null); fetchInterviews(); }} />}
      {showFeedback && <FeedbackModal interview={showFeedback} onClose={() => setShowFeedback(null)} onSaved={(decision) => { setShowFeedback(null); fetchInterviews(); if (decision === 'next_round') setBookNextRound(showFeedback); }} />}
      {bookNextRound && <BookNextRoundModal interview={bookNextRound} onClose={() => setBookNextRound(null)} onCreated={() => { setBookNextRound(null); fetchInterviews(); }} />}
    </div>
  );
}

function CreateModal({ candidates, jobs, defaultDate, defaultTime, onClose, onCreated }: { candidates: Candidate[]; jobs: { id: string; title: string }[]; defaultDate: string; defaultTime: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('Interview');
  const [date, setDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (defaultDate && defaultDate >= today) {
      const d = new Date(defaultDate);
      if (d.getDay() !== 0 && d.getDay() !== 6) return defaultDate;
    }
    let d = new Date(today);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState(defaultTime || '09:00');
  const endHour = Math.min(parseInt(defaultTime || '09') + 1, 23);
  const [endTime, setEndTime] = useState(`${String(endHour).padStart(2, '0')}:00`);
  const [notes, setNotes] = useState('');
  const [interviewerEmails, setInterviewerEmails] = useState<string[]>([]);
  const [selectedInterviewers, setSelectedInterviewers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [availableInterviewers, setAvailableInterviewers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [emailPreview, setEmailPreview] = useState<any>(null);

  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    apiClient.get('/users/interviewers').then(({ data }) => setAvailableInterviewers(data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!candidateId) return;
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const day = start.getDay();
    if (day === 0 || day === 6) { setValidationError(t('cannotScheduleWeekend')); return; }
    if (start < new Date()) { setValidationError(t('cannotSchedulePast')); return; }
    if (end <= start) { setValidationError(t('endAfterStart')); return; }
    if (interviewerEmails.length === 0 && selectedInterviewers.length === 0) { setValidationError(t('selectInterviewerRequired')); return; }
    setValidationError('');
    setSaving(true);
    try {
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      await apiClient.post('/interviews', {
        candidate_id: candidateId,
        job_id: jobId || null,
        title,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
        interviewer_emails: interviewerEmails,
        interviewer_ids: selectedInterviewers.map(i => i.id),
      });
      // Get email preview
      const { data } = await apiClient.post('/interviews/email-preview', {
        candidate_id: candidateId, round: 1, start_time: startIso, end_time: endIso, title,
      });
      setEmailPreview({ ...data, bcc: [...interviewerEmails, ...selectedInterviewers.map(i => i.email)] });
    } catch (err: any) {
      setValidationError(err?.response?.data?.detail || t('cannotCreateInterview'));
    }
    setSaving(false);
  };

  const handleSendEmail = async () => {
    if (!emailPreview) return;
    try {
      await apiClient.post('/interviews/send-invitation', { ...emailPreview, candidate_id: candidateId });
    } catch { }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={emailPreview ? onCreated : onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{emailPreview ? t('sendInvitationTitle') : t('createInterviewTitle')}</h2>
          <button onClick={emailPreview ? onCreated : onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {emailPreview ? (
          <div className="p-5 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[13px] text-emerald-700">{t('interviewCreated')}</div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('toLabel')}</label>
              <input value={emailPreview.to_email} onChange={e => setEmailPreview({...emailPreview, to_email: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('subjectLabel')}</label>
              <input value={emailPreview.subject} onChange={e => setEmailPreview({...emailPreview, subject: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('emailContentLabel')}</label>
              <textarea value={emailPreview.body} onChange={e => setEmailPreview({...emailPreview, body: e.target.value})} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" />
            </div>
            <div className="bg-bg-surface rounded-lg p-3 text-[12px] text-text-secondary">
              <p>📅 {emailPreview.date}</p>
              <p>🕐 {emailPreview.time}</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('closingLabel')}</label>
              <input value={emailPreview.closing} onChange={e => setEmailPreview({...emailPreview, closing: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSendEmail} disabled={!emailPreview.to_email} className="flex-1 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">{t('sendEmailBtn')}</button>
              <button onClick={onCreated} className="flex-1 py-2.5 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-bg-surface/80">{t('skipBtn')}</button>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Job</label>
            <select value={jobId} onChange={e => { setJobId(e.target.value); setCandidateId(''); }} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20">
              <option value="">{t('allJobs')}</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('candidateLabel')}</label>
            <select value={candidateId} onChange={e => setCandidateId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20">
              <option value="">{t('selectCandidate')}</option>
              {candidates.filter(c => !jobId || c.job_id === jobId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('interviewTitleLabel')}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase">{t('dateLabel')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div className="col-span-2">
              <label className="text-[12px] font-medium text-text-muted uppercase">{t('timeLabel')}</label>
              <div className="mt-1 flex items-center gap-2">
                <TimeSelect value={startTime} onChange={v => { setStartTime(v); const [h] = v.split(':'); setEndTime(`${String(Math.min(+h+1,23)).padStart(2,'0')}:00`); }} />
                <span className="text-text-muted text-[12px]">→</span>
                <TimeSelect value={endTime} onChange={setEndTime} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('interviewersLabel')}</label>
            {availableInterviewers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5 p-2 border border-border-default rounded-lg bg-white min-h-[38px]">
                {selectedInterviewers.map(i => (
                  <span key={i.id} className="flex items-center gap-1 text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-medium">
                    {i.full_name}
                    <button type="button" onClick={() => setSelectedInterviewers(prev => prev.filter(x => x.id !== i.id))} className="hover:text-red-500">×</button>
                  </span>
                ))}
                <select
                  value=""
                  onChange={e => {
                    const found = availableInterviewers.find(x => x.id === e.target.value);
                    if (found && !selectedInterviewers.some(x => x.id === found.id)) setSelectedInterviewers(prev => [...prev, found]);
                  }}
                  className="flex-1 min-w-[120px] text-[13px] outline-none bg-transparent border-0"
                >
                  <option value="">{t('selectInterviewerOption')}</option>
                  {availableInterviewers.filter(a => !selectedInterviewers.some(s => s.id === a.id)).map(a => (
                    <option key={a.id} value={a.id}>{a.full_name} ({a.email})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('notesFieldLabel')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder="Link meeting, interviewer..." />
          </div>
          {validationError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{validationError}</p>}
          <button onClick={handleSave} disabled={saving || !candidateId} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? t('creating') : t('createScheduleBtn')}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

function DetailModal({ interview, onClose, onFeedback, onDeleted }: { interview: Interview; onClose: () => void; onFeedback: () => void; onDeleted: () => void }) {
  const { t, locale } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await apiClient.delete(`/interviews/${interview.id}`);
    onDeleted();
  };

  if (confirmDelete) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm m-4 p-6" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={22} className="text-red-500" />
          </div>
          <h3 className="text-[15px] font-semibold text-text-primary text-center mb-1">{t('deleteInterviewTitle')}</h3>
          <p className="text-[13px] text-text-tertiary text-center mb-6">
            {t('deleteInterviewDesc', { name: interview.candidate_name })}
          </p>
          <div className="space-y-2">
            <button onClick={handleDelete} disabled={deleting} className="w-full py-2.5 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40">{deleting ? t('deleting') : t('delete')}</button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="w-full py-2.5 text-[13px] font-medium text-text-secondary bg-bg-surface rounded-lg hover:bg-bg-surface/80 transition-colors disabled:opacity-40">{t('cancel')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-[15px] font-semibold text-text-primary">{interview.title}</h2>
          <p className="text-[12px] text-text-muted mt-0.5">{interview.candidate_name} · {interview.job_title || ''}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <span className="px-2 py-0.5 bg-accent/10 text-accent rounded font-medium">Round {interview.round || 1}</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{interview.interview_type || 'online'}</span>
            <span className={`px-2 py-0.5 rounded ${interview.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{interview.status}</span>
          </div>
          <div className="text-[13px] text-text-secondary">
            <strong>{t('timeLabelDetail')}</strong> {new Date(interview.start_time).toLocaleString(locale)} — {new Date(interview.end_time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </div>
          {interview.meeting_link && <div className="text-[13px] text-text-secondary"><strong>{t('meetingLabelDetail')}</strong> <a href={interview.meeting_link} target="_blank" className="text-accent hover:underline">{interview.meeting_link}</a></div>}
          {interview.interviewer_emails && interview.interviewer_emails.length > 0 && (
            <div className="text-[13px] text-text-secondary">
              <strong>{t('interviewersLabel')}:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {interview.interviewer_emails.map((e: string) => (
                  <span key={e} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md">{e}</span>
                ))}
              </div>
            </div>
          )}
          {interview.proposed_salary && <div className="text-[13px] text-text-secondary"><strong>{t('proposedSalaryDetail')}</strong> {interview.proposed_salary}</div>}
          {interview.notes && <div className="text-[13px] text-text-secondary"><strong>{t('notesLabelDetail')}</strong> {interview.notes}</div>}
          {interview.feedback_score && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              {(interview.interviewer_feedback || []).length > 0 ? (
                <div className="space-y-2">
                  {interview.interviewer_feedback.map((fb: any, i: number) => (
                    <div key={i} className="flex items-start justify-between">
                      <div>
                        <span className="text-[12px] font-medium text-emerald-800">{fb.name}</span>
                        {fb.notes && <p className="text-[11px] text-emerald-700 mt-0.5">{fb.notes}</p>}
                      </div>
                      <span className="text-[12px] font-bold text-amber-600 shrink-0 ml-2">{fb.score}/10</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-amber-500" />
                    <span className="text-[12px] font-medium text-emerald-800">{interview.feedback_score}/10</span>
                  </div>
                  {interview.feedback_by && <span className="text-[11px] text-emerald-600">— {interview.feedback_by}</span>}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2 pt-2">
            {/* HR Decision */}
            {(interview.interviewer_feedback || []).length > 0 && !interview.feedback_decision && (
              <div>
                <span className="text-[11px] text-text-muted uppercase font-medium">{t('decisionLabel')}</span>
                <div className="flex gap-2 mt-1.5">
                  <HRDecisionButtons interviewId={interview.id} onDecided={onDeleted} />
                </div>
              </div>
            )}
            {interview.feedback_decision && (
              <div className={`py-2.5 text-[13px] font-medium text-center rounded-lg ${interview.feedback_decision === 'pass' ? 'bg-emerald-50 text-emerald-700' : interview.feedback_decision === 'next_round' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                {interview.feedback_decision === 'pass' ? t('passedResult') : interview.feedback_decision === 'next_round' ? t('nextRoundResult') : t('failedResult')}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!interview.feedback_score && new Date(interview.end_time) < new Date() && (
                <button onClick={onFeedback} className="flex-1 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover flex items-center justify-center gap-1">
                  <MessageSquare size={13} /> {t('feedbackBtn')}
                </button>
              )}
              {!interview.feedback_score && new Date(interview.end_time) >= new Date() && (
                <span className="flex-1 py-2 text-[12px] text-text-muted text-center">{t('waitingForEnd')}</span>
              )}
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 text-[13px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                {t('deleteBtn')}
              </button>
              <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-surface">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ interview, onClose, onSaved }: { interview: Interview; onClose: () => void; onSaved: (decision: string) => void }) {
  const { t } = useI18n();
  const [score, setScore] = useState(3);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState('pass');
  const [saving, setSaving] = useState(false);
  const [emailStep, setEmailStep] = useState<any>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/interviews/${interview.id}/feedback`, { score, notes: notes || null, decision });
      // Generate email preview for pass/fail
      if (decision === 'pass' || decision === 'fail') {
        const { data } = await apiClient.post('/outreach/preview', {
          candidate_id: interview.candidate_id,
          template_type: decision === 'pass' ? 'reminder' : 'rejection',
        });
        setEmailStep({ ...data, decision, to_email: '' });
      } else {
        // next_round → handled by BookNextRound modal
        onSaved(decision);
      }
    } catch { onSaved(decision); }
    setSaving(false);
  };

  const handleSendEmail = async () => {
    if (!emailStep?.to_email) { onSaved(decision); return; }
    try {
      await apiClient.post('/outreach/send', {
        candidate_id: interview.candidate_id,
        to_email: emailStep.to_email,
        template_type: decision === 'pass' ? 'reminder' : 'rejection',
        subject: emailStep.subject,
        greeting: emailStep.greeting,
        body: emailStep.body,
        closing: emailStep.closing,
        highlights: emailStep.highlights || [],
        tips: emailStep.tips || [],
        feedback: emailStep.feedback || '',
        job_title: interview.job_title || 'Position',
      });
    } catch { }
    onSaved(decision);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{emailStep ? t('sendNotificationEmail') : t('feedbackModalTitle', { name: interview.candidate_name })}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {emailStep ? (
          <div className="p-5 space-y-3">
            <div className={`rounded-lg p-3 text-[13px] ${decision === 'pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {decision === 'pass' ? t('candidatePassed') : t('candidateNotPassed')}
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('candidateEmailLabel')}</label>
              <input value={emailStep.to_email} onChange={e => setEmailStep({...emailStep, to_email: e.target.value})} placeholder="candidate@email.com" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('subjectLabel')}</label>
              <input value={emailStep.subject} onChange={e => setEmailStep({...emailStep, subject: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('emailContentLabel')}</label>
              <textarea value={emailStep.body} onChange={e => setEmailStep({...emailStep, body: e.target.value})} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSendEmail} disabled={!emailStep.to_email} className="flex-1 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">{t('sendEmailBtn')}</button>
              <button onClick={() => onSaved(decision)} className="flex-1 py-2.5 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg">{t('skipBtn')}</button>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('ratingLabel')}</label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setScore(n)} className={`w-9 h-9 rounded-lg text-sm font-bold ${score >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-text-muted'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('decisionLabel')}</label>
            <div className="flex gap-2 mt-1.5">
              {[{ v: 'pass', l: t('passOption') }, { v: 'next_round', l: t('nextRoundOption') }, { v: 'fail', l: t('failOption') }].map(o => (
                <button key={o.v} onClick={() => setDecision(o.v)} className={`flex-1 py-2 text-[12px] font-medium rounded-lg border ${decision === o.v ? 'border-accent bg-accent/10 text-accent' : 'border-border-subtle text-text-secondary'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">{t('commentLabel')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder={t('commentPlaceholder')} />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? t('saving') : t('saveFeedback')}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}


function BookNextRoundModal({ interview, onClose, onCreated }: { interview: Interview; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const nextRound = (interview.round || 1) + 1;
  const [date, setDate] = useState(() => {
    let d = new Date(); d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [meetingLink, setMeetingLink] = useState(interview.meeting_link || '');
  const [interviewType, setInterviewType] = useState(interview.interview_type || 'online');
  const [notes, setNotes] = useState('');
  const [selectedInterviewers, setSelectedInterviewers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [availableInterviewers, setAvailableInterviewers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    apiClient.get('/users/interviewers').then(({ data }) => setAvailableInterviewers(data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const day = start.getDay();
    if (day === 0 || day === 6) { setValidationError(t('cannotScheduleWeekend')); return; }
    if (start < new Date()) { setValidationError(t('cannotSchedulePast')); return; }
    if (end <= start) { setValidationError(t('endAfterStart')); return; }
    setValidationError('');
    setSaving(true);
    try {
      await apiClient.post('/interviews', {
        candidate_id: interview.candidate_id,
        job_id: interview.job_id,
        title: `Round ${nextRound}: ${interview.job_title || 'Interview'}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: notes || null,
        round: nextRound,
        meeting_link: meetingLink || null,
        interview_type: interviewType,
        proposed_salary: interview.proposed_salary,
        interviewer_ids: selectedInterviewers.map(i => i.id),
        interviewer_emails: [],
      });
      onCreated();
    } catch (err: any) {
      setValidationError(err?.response?.data?.detail || t('cannotCreateInterview'));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-600 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{t('bookNextRoundTitle', { round: nextRound })}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-[13px] text-text-primary font-medium">{interview.candidate_name} — {interview.job_title}</div>
          <div className="text-[11px] text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">{t('roundPassedScheduling', { prev: interview.round || 1, next: nextRound })}</div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('interviewFormat')}</label>
              <select value={interviewType} onChange={e => setInterviewType(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px] bg-white">
                <option value="online">Online</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">{t('dateLabel')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase">{t('timeLabel')}</label>
            <div className="mt-1 flex items-center gap-2">
              <TimeSelect value={startTime} onChange={v => { setStartTime(v); const [h] = v.split(':'); setEndTime(`${String(Math.min(+h+1,23)).padStart(2,'0')}:00`); }} />
              <span className="text-text-muted text-[12px]">→</span>
              <TimeSelect value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase">{t('meetingLinkLabel')}</label>
            <input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase">{t('interviewersLabel')}</label>
            {availableInterviewers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5 p-2 border border-border-default rounded-lg bg-white min-h-[36px]">
                {selectedInterviewers.map(i => (
                  <span key={i.id} className="flex items-center gap-1 text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-medium">
                    {i.full_name}
                    <button type="button" onClick={() => setSelectedInterviewers(prev => prev.filter(x => x.id !== i.id))} className="hover:text-red-500">×</button>
                  </span>
                ))}
                <select value="" onChange={e => { const f = availableInterviewers.find(x => x.id === e.target.value); if (f && !selectedInterviewers.some(x => x.id === f.id)) setSelectedInterviewers(prev => [...prev, f]); }} className="flex-1 min-w-[120px] text-[12px] outline-none bg-transparent border-0">
                  <option value="">{t('selectInterviewerOption')}</option>
                  {availableInterviewers.filter(a => !selectedInterviewers.some(s => s.id === a.id)).map(a => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase">{t('notesFieldLabel')}</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('focusPlaceholder')} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
          </div>

          {validationError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{validationError}</p>}
          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-emerald-600 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40">
            {saving ? t('creating') : t('scheduleRound', { round: nextRound })}
          </button>
        </div>
      </div>
    </div>
  );
}


function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const slots = Array.from({ length: 26 }, (_, i) => {
    const h = Math.floor(i / 2) + 7;
    const m = i % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
  });
  return (
    <div className="relative flex-1">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] text-left bg-white hover:border-accent/40 transition-colors flex items-center justify-between">
        <span className="font-medium">{value}</span>
        <span className="text-text-muted text-[10px]">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 bg-white border border-border-subtle rounded-xl shadow-lg p-2 w-[200px] max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-3 gap-1">
              {slots.map(t => (
                <button key={t} type="button" onClick={() => { onChange(t); setOpen(false); }} className={`px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors ${value === t ? 'bg-accent text-white' : 'text-text-secondary hover:bg-accent/10 hover:text-accent'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmailTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const add = () => {
    const email = input.trim();
    if (email && isValidEmail(email) && !value.includes(email)) {
      onChange([...value, email]);
    }
    setInput('');
  };

  return (
    <div className="mt-1 flex flex-wrap gap-1.5 p-2 border border-border-default rounded-lg bg-white min-h-[38px] focus-within:ring-2 focus-within:ring-accent/20">
      {value.map(email => (
        <span key={email} className="flex items-center gap-1 text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">
          {email}
          <button type="button" onClick={() => onChange(value.filter(e => e !== email))} className="hover:text-red-500">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={value.length === 0 ? t('emailInputPlaceholder') : ''}
        className="flex-1 min-w-[150px] text-[13px] outline-none bg-transparent"
      />
    </div>
  );
}

function HRDecisionButtons({ interviewId, onDecided }: { interviewId: string; onDecided: () => void }) {
  const { t } = useI18n();
  const [deciding, setDeciding] = useState(false);

  const decide = async (decision: string) => {
    setDeciding(true);
    try {
      await apiClient.post(`/interviews/${interviewId}/decision`, { decision });
      onDecided();
    } catch { /* ignore */ }
    setDeciding(false);
  };

  return (
    <div className="flex gap-1 flex-1">
      <button onClick={() => decide('pass')} disabled={deciding} className="flex-1 py-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40">{t('passOption')}</button>
      <button onClick={() => decide('next_round')} disabled={deciding} className="flex-1 py-2 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40">{t('continueLabel')}</button>
      <button onClick={() => decide('fail')} disabled={deciding} className="flex-1 py-2 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40">{t('failOption')}</button>
    </div>
  );
}
