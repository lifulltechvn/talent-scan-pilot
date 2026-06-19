import { useState, useEffect } from 'react';
import { Calendar, Star, MessageSquare, Clock, CheckCircle, X, User, Briefcase, GraduationCap, Languages, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface CandidateProfile {
  skills: string[];
  experience: { company: string; role: string; years: number; description?: string }[];
  education: { school: string; major: string; degree: string; year?: number }[];
  experience_years: number;
  languages: { language: string; level: string }[];
}

interface PreviousFeedback {
  round: number;
  score: number;
  notes: string | null;
  decision: string;
}

interface MyInterview {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_profile: CandidateProfile;
  job_title: string | null;
  job_skills: string[];
  title: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: string;
  round: number;
  meeting_link: string | null;
  interview_type: string;
  feedback_notes: string | null;
  feedback_score: number | null;
  feedback_decision: string | null;
  previous_feedback: PreviousFeedback[];
}

export function InterviewerDashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<MyInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState<MyInterview | null>(null);
  const [decisionModal, setDecisionModal] = useState<MyInterview | null>(null);
  const [profileModal, setProfileModal] = useState<MyInterview | null>(null);

  const fetchData = () => {
    apiClient.get('/interviews/my').then(({ data }) => setInterviews(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const upcoming = interviews.filter(i => i.status === 'scheduled' && new Date(i.start_time) >= new Date());
  const needFeedback = interviews.filter(i => i.status === 'scheduled' && new Date(i.end_time) < new Date() && !i.feedback_score);
  const completed = interviews.filter(i => i.feedback_score != null);

  if (loading) return <div className="text-center py-8 text-text-muted">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Xin chào, {user?.fullName || user?.full_name}</h1>
        <p className="text-[13px] text-text-tertiary mt-0.5">Interviewer Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-blue-500" /><span className="text-[11px] text-text-muted">Sắp tới</span></div>
          <span className="text-2xl font-bold text-text-primary">{upcoming.length}</span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><MessageSquare size={14} className="text-amber-500" /><span className="text-[11px] text-amber-700">Cần feedback</span></div>
          <span className="text-2xl font-bold text-amber-700">{needFeedback.length}</span>
        </div>
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle size={14} className="text-emerald-500" /><span className="text-[11px] text-text-muted">Hoàn thành</span></div>
          <span className="text-2xl font-bold text-text-primary">{completed.length}</span>
        </div>
      </div>

      {/* Need feedback */}
      {needFeedback.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <MessageSquare size={15} /> Cần đánh giá ({needFeedback.length})
          </h2>
          <div className="space-y-2">
            {needFeedback.map(i => (
              <div key={i.id} className="bg-white rounded-lg px-4 py-3 border border-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[11px] text-text-muted">{i.job_title} · Round {i.round} · {new Date(i.start_time).toLocaleDateString('vi')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setProfileModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">Profile</button>
                    <button onClick={() => setDecisionModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover">Đánh giá</button>
                  </div>
                </div>
                {i.feedback_notes && (
                  <div className="mt-2 bg-amber-50 px-3 py-1.5 rounded cursor-pointer hover:bg-amber-100/70" onClick={() => setFeedbackModal(i)}>
                    <span className="text-[10px] font-medium text-amber-700">Nhận xét đã ghi · click để sửa</span>
                    <p className="text-[12px] text-amber-900 mt-0.5">{i.feedback_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-primary flex items-center gap-2"><Calendar size={14} className="text-accent" /> Lịch phỏng vấn sắp tới</h2>
        </div>
        {upcoming.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-text-muted">Không có lịch phỏng vấn sắp tới</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {upcoming.map(i => (
              <div key={i.id} className="px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[14px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[12px] text-text-muted">{i.job_title} · Round {i.round} · {i.interview_type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-medium text-text-primary">{new Date(i.start_time).toLocaleDateString('vi')}</div>
                    <div className="text-[12px] text-text-muted">{new Date(i.start_time).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })} — {new Date(i.end_time).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setProfileModal(i)} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">
                    <User size={12} /> Xem profile
                  </button>
                  {i.meeting_link && (
                    <a href={i.meeting_link} target="_blank" className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20">
                      🔗 Join meeting
                    </a>
                  )}
                  <button onClick={() => setFeedbackModal(i)} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100">
                    <MessageSquare size={12} /> Ghi nhận xét
                  </button>
                  <button onClick={() => setDecisionModal(i)} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                    <CheckCircle size={12} /> Đánh giá
                  </button>
                  {i.previous_feedback.length > 0 && (
                    <span className="text-[11px] text-text-muted">📋 {i.previous_feedback.length} feedback trước</span>
                  )}
                </div>
                {i.notes && <p className="text-[11px] text-text-muted mt-2 bg-bg-surface px-3 py-1.5 rounded">{i.notes}</p>}
                {i.feedback_notes && (
                  <div className="mt-2 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg cursor-pointer hover:bg-amber-100/70 transition-colors" onClick={() => setFeedbackModal(i)}>
                    <span className="text-[10px] font-medium text-amber-700 uppercase">Nhận xét đã ghi <span className="normal-case font-normal">· click để sửa</span></span>
                    <p className="text-[12px] text-amber-900 mt-0.5">{i.feedback_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Đã feedback ({completed.length})</h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {completed.map(i => (
              <div key={i.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[11px] text-text-muted">{i.job_title} · Round {i.round} · {new Date(i.start_time).toLocaleDateString('vi')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setProfileModal(i)} className="text-[11px] text-purple-600 hover:underline">Profile</button>
                    <button onClick={() => setDecisionModal(i)} className="text-[11px] text-accent hover:underline">Sửa</button>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-500" />
                      <span className="text-[12px] font-medium">{i.feedback_score}/5</span>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${i.feedback_decision === 'pass' ? 'bg-emerald-100 text-emerald-700' : i.feedback_decision === 'fail' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {i.feedback_decision}
                    </span>
                  </div>
                </div>
                {i.feedback_notes && <p className="text-[11px] text-text-secondary mt-1 bg-bg-surface px-3 py-1.5 rounded">{i.feedback_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileModal && <ProfileModal interview={profileModal} onClose={() => setProfileModal(null)} />}

      {/* Notes Modal (during interview) */}
      {feedbackModal && (
        <NotesModal interview={feedbackModal} onClose={() => setFeedbackModal(null)} onSaved={() => { setFeedbackModal(null); fetchData(); }} />
      )}

      {/* Decision Modal (after interview) */}
      {decisionModal && (
        <DecisionModal interview={decisionModal} onClose={() => setDecisionModal(null)} onSaved={() => { setDecisionModal(null); fetchData(); }} />
      )}
    </div>
  );
}

function ProfileModal({ interview, onClose }: { interview: MyInterview; onClose: () => void }) {
  const p = interview.candidate_profile;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <div>
            <h2 className="text-[15px] font-semibold text-white">{interview.candidate_name}</h2>
            <p className="text-[12px] text-white/70">{interview.job_title} · Round {interview.round}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Experience summary */}
          <div className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Briefcase size={14} className="text-text-muted" />
            <span>{p.experience_years} năm kinh nghiệm</span>
          </div>

          {/* Skills */}
          <div>
            <span className="text-[11px] font-medium text-text-muted uppercase">Skills</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {p.skills.map(s => (
                <span key={s} className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${interview.job_skills.map(j => j.toLowerCase()).includes(s.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{s}</span>
              ))}
            </div>
            {interview.job_skills.length > 0 && <p className="text-[10px] text-text-muted mt-1">🟢 = khớp yêu cầu job</p>}
          </div>

          {/* Experience */}
          {p.experience.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase flex items-center gap-1"><Briefcase size={12} /> Kinh nghiệm</span>
              <div className="mt-2 space-y-2">
                {p.experience.map((exp, i) => (
                  <div key={i} className="border-l-2 border-border-subtle pl-3">
                    <div className="text-[13px] font-medium text-text-primary">{exp.role}</div>
                    <div className="text-[12px] text-text-muted">{exp.company}{exp.years ? ` · ${exp.years}y` : ''}</div>
                    {exp.description && <div className="text-[11px] text-text-secondary mt-0.5">{exp.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {p.education.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase flex items-center gap-1"><GraduationCap size={12} /> Học vấn</span>
              <div className="mt-2 space-y-1">
                {p.education.map((edu, i) => (
                  <div key={i} className="text-[13px] text-text-primary">
                    {edu.degree}{edu.major ? ` — ${edu.major}` : ''} <span className="text-text-muted">· {edu.school}{edu.year ? ` (${edu.year})` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {p.languages.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase flex items-center gap-1"><Languages size={12} /> Ngôn ngữ</span>
              <div className="flex gap-2 mt-1.5">
                {p.languages.map(l => (
                  <span key={l.language} className="text-[12px] bg-bg-surface text-text-secondary px-2 py-0.5 rounded">{l.language}{l.level && l.level !== '<UNKNOWN>' ? ` (${l.level})` : ''}</span>
                ))}
              </div>
            </div>
          )}

          {/* Previous feedback */}
          {interview.previous_feedback.length > 0 && (
            <div className="border-t border-border-subtle pt-4">
              <span className="text-[11px] font-medium text-text-muted uppercase">Feedback vòng trước</span>
              <div className="mt-2 space-y-2">
                {interview.previous_feedback.map(fb => (
                  <div key={fb.round} className="p-3 bg-bg-surface rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-text-primary">Round {fb.round}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]">⭐ {fb.score}/5</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${fb.decision === 'pass' ? 'bg-emerald-100 text-emerald-700' : fb.decision === 'fail' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{fb.decision}</span>
                      </div>
                    </div>
                    {fb.notes && <p className="text-[11px] text-text-secondary">{fb.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotesModal({ interview, onClose, onSaved }: { interview: MyInterview; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(interview.feedback_notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      await apiClient.post(`/interviews/${interview.id}/notes`, { notes });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Ghi nhận xét</h2>
            <p className="text-[12px] text-white/70">{interview.candidate_name} · Round {interview.round}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-text-muted">Ghi chú trong hoặc sau buổi phỏng vấn. Đánh giá & quyết định sẽ làm riêng.</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder="Nhận xét về ứng viên: kỹ năng, thái độ, communication..." autoFocus />
          <button onClick={handleSave} disabled={saving || !notes.trim()} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? 'Đang lưu...' : 'Lưu nhận xét'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionModal({ interview, onClose, onSaved }: { interview: MyInterview; onClose: () => void; onSaved: () => void }) {
  const [score, setScore] = useState(3);
  const [decision, setDecision] = useState('pass');
  const [notes, setNotes] = useState(interview.feedback_notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/interviews/${interview.id}/feedback`, { score, notes: notes || null, decision });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Đánh giá & Quyết định</h2>
            <p className="text-[12px] text-white/70">{interview.candidate_name} · Round {interview.round}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Previous feedback reference */}
          {interview.previous_feedback.length > 0 && (
            <div className="bg-bg-surface rounded-lg p-3">
              <span className="text-[10px] font-medium text-text-muted uppercase">Vòng trước</span>
              {interview.previous_feedback.map(fb => (
                <div key={fb.round} className="text-[11px] text-text-secondary mt-1">
                  Round {fb.round}: ⭐{fb.score}/5 — {fb.decision}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Đánh giá (1-5)</label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setScore(n)} className={`w-9 h-9 rounded-lg text-sm font-bold ${score >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-text-muted'}`}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Quyết định</label>
            <div className="flex gap-2 mt-1.5">
              {[{ v: 'pass', l: '✅ Pass' }, { v: 'next_round', l: '🔄 Vòng tiếp' }, { v: 'fail', l: '❌ Fail' }].map(o => (
                <button key={o.v} onClick={() => setDecision(o.v)} className={`flex-1 py-2 text-[12px] font-medium rounded-lg border ${decision === o.v ? 'border-accent bg-accent/10 text-accent' : 'border-border-subtle text-text-secondary'}`}>{o.l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Ghi chú thêm (tùy chọn)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder="Bổ sung nhận xét..." />
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? 'Đang lưu...' : 'Xác nhận đánh giá'}
          </button>
        </div>
      </div>
    </div>
  );
}
