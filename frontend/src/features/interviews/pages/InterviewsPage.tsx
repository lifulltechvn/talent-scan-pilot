import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Star, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/data/api/client';

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
function fmtDay(d: Date) { return d.toLocaleDateString('vi', { weekday: 'short', day: 'numeric', month: 'numeric' }); }

export function InterviewsPage() {
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
          <h1 className="text-xl font-semibold text-text-primary">Interviews</h1>
          <button onClick={() => setShowCreate({ date: new Date().toISOString().slice(0, 10), time: '09:00' })} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover">
            <Plus size={14} /> Tạo lịch
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={prevWeek} className="p-1.5 hover:bg-bg-surface rounded-lg"><ChevronLeft size={16} /></button>
          <button onClick={goToday} className="text-[12px] font-medium text-accent px-2 py-1 hover:bg-accent/5 rounded-md">Hôm nay</button>
          <button onClick={nextWeek} className="p-1.5 hover:bg-bg-surface rounded-lg"><ChevronRight size={16} /></button>
          <span className="text-sm font-medium text-text-primary">
            {weekDates[0].toLocaleDateString('vi', { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString('vi', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                    {fmtDay(d)}
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
          <h2 className="text-sm font-medium text-text-primary mb-3">📋 Hôm nay ({todayInterviews.length})</h2>
          {todayInterviews.length === 0 ? (
            <p className="text-xs text-text-muted">Không có lịch</p>
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
                  <div className="text-[10px] text-text-muted">{new Date(i.start_time).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })} — {i.job_title || i.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {needFeedback.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-amber-800 mb-3">⚠️ Cần feedback ({needFeedback.length})</h2>
            <div className="space-y-2">
              {needFeedback.map(i => (
                <div key={i.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                  <div>
                    <div className="text-[12px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[10px] text-text-muted">{new Date(i.start_time).toLocaleDateString('vi')}</div>
                  </div>
                  <button onClick={() => setShowFeedback(i)} className="text-[11px] text-accent hover:underline">Feedback</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Need next round scheduling */}
        {interviews.filter(i => i.feedback_decision === 'next_round' && !interviews.some(j => j.candidate_id === i.candidate_id && j.round > i.round)).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-blue-800 mb-3">🔄 Cần đặt lịch vòng tiếp</h2>
            <div className="space-y-2">
              {interviews.filter(i => i.feedback_decision === 'next_round' && !interviews.some(j => j.candidate_id === i.candidate_id && j.round > i.round)).map(i => (
                <div key={i.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-100">
                  <div>
                    <div className="text-[12px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[10px] text-text-muted">Round {i.round || 1} passed — {i.job_title}</div>
                  </div>
                  <button onClick={() => setBookNextRound(i)} className="text-[11px] text-blue-600 font-medium hover:underline">Đặt lịch Round {(i.round || 1) + 1}</button>
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
  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('Interview');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(defaultTime || '09:00');
  const endHour = Math.min(parseInt(defaultTime || '09') + 1, 23);
  const [endTime, setEndTime] = useState(`${String(endHour).padStart(2, '0')}:00`);
  const [notes, setNotes] = useState('');
  const [interviewerEmails, setInterviewerEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [emailPreview, setEmailPreview] = useState<any>(null);

  const [validationError, setValidationError] = useState('');

  const handleSave = async () => {
    if (!candidateId) return;
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (start < new Date()) { setValidationError('Không thể đặt lịch trong quá khứ'); return; }
    if (end <= start) { setValidationError('Giờ kết thúc phải sau giờ bắt đầu'); return; }
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
      });
      // Get email preview
      const { data } = await apiClient.post('/interviews/email-preview', {
        candidate_id: candidateId, round: 1, start_time: startIso, end_time: endIso, title,
      });
      setEmailPreview({ ...data, bcc: interviewerEmails });
    } catch { onCreated(); }
    setSaving(false);
  };

  const handleSendEmail = async () => {
    if (!emailPreview) return;
    try {
      await apiClient.post('/interviews/send-invitation', emailPreview);
    } catch { }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={emailPreview ? onCreated : onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">{emailPreview ? 'Gửi email mời phỏng vấn' : 'Tạo lịch phỏng vấn'}</h2>
          <button onClick={emailPreview ? onCreated : onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {emailPreview ? (
          <div className="p-5 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[13px] text-emerald-700">✅ Lịch phỏng vấn đã tạo thành công!</div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">To</label>
              <input value={emailPreview.to_email} onChange={e => setEmailPreview({...emailPreview, to_email: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Subject</label>
              <input value={emailPreview.subject} onChange={e => setEmailPreview({...emailPreview, subject: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Nội dung</label>
              <textarea value={emailPreview.body} onChange={e => setEmailPreview({...emailPreview, body: e.target.value})} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" />
            </div>
            <div className="bg-bg-surface rounded-lg p-3 text-[12px] text-text-secondary">
              <p>📅 {emailPreview.date}</p>
              <p>🕐 {emailPreview.time}</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Kết</label>
              <input value={emailPreview.closing} onChange={e => setEmailPreview({...emailPreview, closing: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSendEmail} disabled={!emailPreview.to_email} className="flex-1 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">Gửi email</button>
              <button onClick={onCreated} className="flex-1 py-2.5 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg hover:bg-bg-surface/80">Bỏ qua</button>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Job</label>
            <select value={jobId} onChange={e => { setJobId(e.target.value); setCandidateId(''); }} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20">
              <option value="">Tất cả jobs</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Ứng viên</label>
            <select value={candidateId} onChange={e => setCandidateId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20">
              <option value="">Chọn ứng viên...</option>
              {candidates.filter(c => !jobId || c.job_id === jobId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Tiêu đề</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase">Bắt đầu</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-muted uppercase">Kết thúc</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Interviewer Emails</label>
            <EmailTagInput value={interviewerEmails} onChange={setInterviewerEmails} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Ghi chú</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder="Link meeting, interviewer..." />
          </div>
          <button onClick={handleSave} disabled={saving || !candidateId} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? 'Đang tạo...' : 'Tạo lịch'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

function DetailModal({ interview, onClose, onFeedback, onDeleted }: { interview: Interview; onClose: () => void; onFeedback: () => void; onDeleted: () => void }) {
  const handleDelete = async () => {
    if (!confirm('Xoá lịch phỏng vấn này?')) return;
    await apiClient.delete(`/interviews/${interview.id}`);
    onDeleted();
  };

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
            <strong>Thời gian:</strong> {new Date(interview.start_time).toLocaleString('vi')} — {new Date(interview.end_time).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {interview.meeting_link && <div className="text-[13px] text-text-secondary"><strong>Meeting:</strong> <a href={interview.meeting_link} target="_blank" className="text-accent hover:underline">{interview.meeting_link}</a></div>}
          {interview.interviewer_emails && interview.interviewer_emails.length > 0 && (
            <div className="text-[13px] text-text-secondary">
              <strong>Interviewers:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {interview.interviewer_emails.map((e: string) => (
                  <span key={e} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md">{e}</span>
                ))}
              </div>
            </div>
          )}
          {interview.proposed_salary && <div className="text-[13px] text-text-secondary"><strong>Lương đề xuất:</strong> {interview.proposed_salary}</div>}
          {interview.notes && <div className="text-[13px] text-text-secondary"><strong>Ghi chú:</strong> {interview.notes}</div>}
          {interview.feedback_score && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-1 mb-1">
                <Star size={12} className="text-amber-500" />
                <span className="text-[12px] font-medium text-emerald-800">{interview.feedback_score}/5 — {interview.feedback_decision}</span>
              </div>
              {interview.feedback_notes && <p className="text-[11px] text-emerald-700">{interview.feedback_notes}</p>}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {!interview.feedback_score && (
              <button onClick={onFeedback} className="flex-1 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover flex items-center justify-center gap-1">
                <MessageSquare size={13} /> Feedback
              </button>
            )}
            <button onClick={handleDelete} className="px-4 py-2 text-[13px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              Xoá
            </button>
            <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-surface">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ interview, onClose, onSaved }: { interview: Interview; onClose: () => void; onSaved: (decision: string) => void }) {
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
          <h2 className="text-[15px] font-semibold text-white">{emailStep ? 'Gửi email thông báo' : `Feedback — ${interview.candidate_name}`}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>

        {emailStep ? (
          <div className="p-5 space-y-3">
            <div className={`rounded-lg p-3 text-[13px] ${decision === 'pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {decision === 'pass' ? '✅ Ứng viên đã Pass!' : '❌ Ứng viên không đạt'}
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Email ứng viên</label>
              <input value={emailStep.to_email} onChange={e => setEmailStep({...emailStep, to_email: e.target.value})} placeholder="candidate@email.com" className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Subject</label>
              <input value={emailStep.subject} onChange={e => setEmailStep({...emailStep, subject: e.target.value})} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Nội dung</label>
              <textarea value={emailStep.body} onChange={e => setEmailStep({...emailStep, body: e.target.value})} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSendEmail} disabled={!emailStep.to_email} className="flex-1 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">Gửi email</button>
              <button onClick={() => onSaved(decision)} className="flex-1 py-2.5 bg-bg-surface text-text-secondary text-[13px] font-medium rounded-lg">Bỏ qua</button>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Đánh giá (1-5)</label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setScore(n)} className={`w-9 h-9 rounded-lg text-sm font-bold ${score >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-text-muted'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Quyết định</label>
            <div className="flex gap-2 mt-1.5">
              {[{ v: 'pass', l: '✅ Pass' }, { v: 'next_round', l: '🔄 Vòng tiếp' }, { v: 'fail', l: '❌ Fail' }].map(o => (
                <button key={o.v} onClick={() => setDecision(o.v)} className={`flex-1 py-2 text-[12px] font-medium rounded-lg border ${decision === o.v ? 'border-accent bg-accent/10 text-accent' : 'border-border-subtle text-text-secondary'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Nhận xét</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder="Ghi nhận xét về ứng viên..." />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? 'Đang lưu...' : 'Lưu feedback'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}


function BookNextRoundModal({ interview, onClose, onCreated }: { interview: Interview; onClose: () => void; onCreated: () => void }) {
  const nextRound = (interview.round || 1) + 1;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [meetingLink, setMeetingLink] = useState(interview.meeting_link || '');
  const [interviewType, setInterviewType] = useState(interview.interview_type || 'online');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post('/interviews', {
        candidate_id: interview.candidate_id,
        job_id: interview.job_id,
        title: `Round ${nextRound}: ${interview.job_title || 'Interview'}`,
        start_time: new Date(`${date}T${startTime}`).toISOString(),
        end_time: new Date(`${date}T${endTime}`).toISOString(),
        notes: notes || null,
        round: nextRound,
        meeting_link: meetingLink || null,
        interview_type: interviewType,
        proposed_salary: interview.proposed_salary,
      });
      onCreated();
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-600 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-white">🔄 Đặt lịch Round {nextRound}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-[13px] text-text-primary font-medium">{interview.candidate_name} — {interview.job_title}</div>
          <div className="text-[11px] text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">✅ Round {interview.round || 1} passed — scheduling Round {nextRound}</div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Hình thức</label>
              <select value={interviewType} onChange={e => setInterviewType(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px] bg-white">
                <option value="online">Online</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Từ</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Đến</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full px-2 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase">Meeting Link</label>
            <input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted uppercase">Ghi chú</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Focus vòng này: technical deep-dive..." className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-emerald-600 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40">
            {saving ? 'Đang tạo...' : `Đặt lịch Round ${nextRound}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
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
        placeholder={value.length === 0 ? 'Nhập email interviewer rồi Enter...' : ''}
        className="flex-1 min-w-[150px] text-[13px] outline-none bg-transparent"
      />
    </div>
  );
}
