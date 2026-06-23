import { useState, useEffect } from 'react';
import { Calendar, Star, MessageSquare, Clock, CheckCircle, X, User, Briefcase, GraduationCap, Languages, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { QuestionBankModal } from '../components/QuestionBankModal';

interface CandidateProfile {
  skills: string[];
  experience: { company: string; role: string; years: number; description?: string }[];
  education: { school: string; major: string; degree: string; year?: number }[];
  experience_years: number;
  languages: { language: string; level: string }[];
  insight?: { strengths?: string; weaknesses?: string; recommendation?: string } | null;
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
  question_score: { total: number; max: number; percentage: number; g_level?: string } | null;
  cv_file_path: string | null;
}

export function InterviewerDashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<MyInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState<MyInterview | null>(null);
  const [profileModal, setProfileModal] = useState<MyInterview | null>(null);
  const [questionsModal, setQuestionsModal] = useState<MyInterview | null>(null);

  const fetchData = () => {
    apiClient.get('/interviews/my').then(({ data }) => setInterviews(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const now = new Date();
  const upcoming = interviews.filter(i => i.status === 'scheduled' && new Date(i.start_time) > now);
  const inProgress = interviews.filter(i => i.status === 'scheduled' && new Date(i.start_time) <= now && new Date(i.end_time) >= now);
  const needFeedback = interviews.filter(i => (i.status === 'scheduled' && new Date(i.end_time) < now && !i.feedback_score) || (i.status === 'completed' && !i.feedback_score));
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

      {/* In progress */}
      {inProgress.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <Clock size={15} /> Đang diễn ra ({inProgress.length})
          </h2>
          <div className="space-y-2">
            {inProgress.map(i => (
              <div key={i.id} className="bg-white rounded-lg px-4 py-3 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{i.candidate_name}</div>
                    <div className="text-[11px] text-text-muted">{i.job_title} · Round {i.round}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setProfileModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">Profile</button>
                    <button onClick={() => setQuestionsModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Câu hỏi</button>
                    <button onClick={() => setFeedbackModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover">Nhận xét</button>
                  </div>
                </div>
                {i.meeting_link && (
                  <a href={i.meeting_link} target="_blank" className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-[12px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20">
                    🔗 Join meeting
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <button onClick={() => setQuestionsModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Câu hỏi</button>
                    <button onClick={() => setFeedbackModal(i)} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover">Nhận xét</button>
                  </div>
                </div>
                {i.question_score && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">📊 Smart Score:</span>
                    {i.question_score.g_level && <span className="text-[12px] font-bold text-accent">{i.question_score.g_level}</span>}
                    <span className={`text-[12px] font-semibold ${i.question_score.percentage >= 70 ? 'text-emerald-600' : i.question_score.percentage >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(i.question_score.percentage)}%</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                      <div className={`h-full rounded-full ${i.question_score.percentage >= 70 ? 'bg-emerald-500' : i.question_score.percentage >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.round(i.question_score.percentage)}%` }} />
                    </div>
                  </div>
                )}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setProfileModal(i)} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">
                    <User size={12} /> Xem profile
                  </button>
                  <button onClick={() => setQuestionsModal(i)} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                    <GraduationCap size={12} /> Câu hỏi PV
                  </button>
                  {i.meeting_link && (
                    <a href={i.meeting_link} target="_blank" className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20">
                      🔗 Join meeting
                    </a>
                  )}
                  <button onClick={() => setFeedbackModal(i)} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100">
                    <MessageSquare size={12} /> Nhận xét
                  </button>
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
                    <button onClick={() => setFeedbackModal(i)} className="text-[11px] text-accent hover:underline">Sửa</button>
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
                {i.question_score && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">📊 Smart Score:</span>
                    {i.question_score.g_level && <span className="text-[11px] font-bold text-accent">{i.question_score.g_level}</span>}
                    <span className={`text-[11px] font-semibold ${i.question_score.percentage >= 70 ? 'text-emerald-600' : i.question_score.percentage >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(i.question_score.percentage)}%</span>
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                      <div className={`h-full rounded-full ${i.question_score.percentage >= 70 ? 'bg-emerald-500' : i.question_score.percentage >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.round(i.question_score.percentage)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileModal && <ProfileModal interview={profileModal} onClose={() => setProfileModal(null)} />}

      {/* Feedback Modal */}
      {feedbackModal && (
        <FeedbackModal interview={feedbackModal} onClose={() => setFeedbackModal(null)} onSaved={() => { setFeedbackModal(null); fetchData(); }} />
      )}

      {/* Questions Modal */}
      {questionsModal && (
        <QuestionBankModal key={questionsModal.candidate_id} candidateId={questionsModal.candidate_id} candidateName={questionsModal.candidate_name} onClose={() => setQuestionsModal(null)} />
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

          {/* AI Insight */}
          {p.insight && (p.insight.strengths || p.insight.weaknesses) && (
            <div className="border-t border-border-subtle pt-4">
              <span className="text-[11px] font-medium text-text-muted uppercase flex items-center gap-1">✨ AI Nhận xét</span>
              <div className="mt-2 space-y-2">
                {p.insight.strengths && (
                  <div className="p-2.5 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] font-medium text-emerald-700 uppercase">Điểm mạnh</span>
                    <p className="text-[12px] text-emerald-800 mt-0.5">{p.insight.strengths}</p>
                  </div>
                )}
                {p.insight.weaknesses && (
                  <div className="p-2.5 bg-amber-50 rounded-lg">
                    <span className="text-[10px] font-medium text-amber-700 uppercase">Cần lưu ý</span>
                    <p className="text-[12px] text-amber-800 mt-0.5">{p.insight.weaknesses}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View CV */}
          {interview.cv_file_path && (
            <div className="border-t border-border-subtle pt-4">
              <button onClick={() => {
                const token = localStorage.getItem('token');
                fetch(`/api/v1/candidates/${interview.candidate_id}/cv?inline=true`, { headers: { Authorization: `Bearer ${token}` } })
                  .then(r => r.blob())
                  .then(blob => { const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })); window.open(url, '_blank'); });
              }} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors">
                📄 Xem CV gốc
              </button>
            </div>
          )}

          {/* Previous feedback */}
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ interview, onClose, onSaved }: { interview: MyInterview; onClose: () => void; onSaved: () => void }) {
  const [score, setScore] = useState(interview.feedback_score || 5);
  const [notes, setNotes] = useState(interview.feedback_notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/interviews/${interview.id}/feedback`, { score, notes: notes || null, decision: 'pending' });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-accent rounded-t-2xl">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Đánh giá ứng viên</h2>
            <p className="text-[12px] text-white/70">{interview.candidate_name} · Round {interview.round}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} className="text-white/80" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Điểm đánh giá: <span className="text-accent text-[14px]">{score}/10</span></label>
            <div className="flex gap-1 mt-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setScore(n)} className={`w-7 h-7 rounded-lg text-sm font-bold ${score >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-text-muted'}`}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-text-muted uppercase">Nhận xét</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-y" placeholder="Nhận xét về kỹ năng, thái độ, communication..." autoFocus />
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
            {saving ? 'Đang lưu...' : 'Gửi đánh giá'}
          </button>
        </div>
      </div>
    </div>
  );
}


interface QuestionCriteria { id: string; description: string; point: number }
interface Question { id: number; category: string; skill: string; question: string; criteria: QuestionCriteria[]; max_score: number; red_flags: string; follow_up: string }

function QuestionsModal({ interview, onClose }: { interview: MyInterview; onClose: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<number, boolean[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    apiClient.get(`/interviews/${interview.id}/questions?locale=vi`).then(({ data }) => {
      setQuestions(data.questions || []);
      // Load existing scores
      apiClient.get(`/interviews/${interview.id}/questions/score`).then(({ data: s }) => {
        if (s?.scores) {
          const map: Record<number, boolean[]> = {};
          for (const item of s.scores) map[item.question_id] = item.checked;
          setScores(map);
          setSubmitted(true);
        }
      }).catch(() => {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, [interview.id]);

  const toggleCriteria = (qId: number, idx: number) => {
    setScores(prev => {
      const arr = [...(prev[qId] || new Array(5).fill(false))];
      arr[idx] = !arr[idx];
      return { ...prev, [qId]: arr };
    });
    setSubmitted(false);
  };

  const totalScore = Object.values(scores).reduce((sum, arr) => sum + arr.filter(Boolean).length, 0);
  const maxScore = questions.length * 5;

  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = questions.map(q => ({
      question_id: q.id,
      checked: scores[q.id] || new Array(5).fill(false),
      score: (scores[q.id] || []).filter(Boolean).length,
    }));
    await apiClient.post(`/interviews/${interview.id}/questions/score`, { scores: payload });
    setSubmitted(true);
    setSubmitting(false);
  };

  const categoryLabels: Record<string, string> = { technical_core: '💻 Technical', problem_solving: '🧩 Problem Solving', experience_validation: '📋 Experience', culture_fit: '🤝 Culture Fit' };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary">📋 Smart Interview Questions</h2>
            <p className="text-[11px] text-text-muted mt-0.5">{interview.candidate_name} · {interview.job_title} · Round {interview.round}</p>
          </div>
          <div className="flex items-center gap-3">
            {questions.length > 0 && <span className="text-[12px] font-medium text-accent">{totalScore}/{maxScore} ({maxScore > 0 ? Math.round(totalScore/maxScore*100) : 0}%)</span>}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-text-muted text-[13px]">Đang tải câu hỏi...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[13px]">Không có câu hỏi (job chưa có skills)</div>
          ) : (
            questions.map(q => (
              <div key={q.id} className="border border-border-subtle rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{categoryLabels[q.category] || q.category}</span>
                    <span className="text-[10px] ml-2 text-text-muted">{q.skill}</span>
                  </div>
                  <span className="text-[11px] font-medium text-text-muted">
                    {(scores[q.id] || []).filter(Boolean).length}/5
                  </span>
                </div>
                <p className="text-[13px] text-text-primary font-medium mb-3">{q.question}</p>
                <div className="space-y-1.5">
                  {q.criteria.map((c, idx) => (
                    <label key={c.id} className="flex items-start gap-2 cursor-pointer group">
                      <input type="checkbox" checked={scores[q.id]?.[idx] || false} onChange={() => toggleCriteria(q.id, idx)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent" />
                      <span className={`text-[12px] ${scores[q.id]?.[idx] ? 'text-text-primary' : 'text-text-tertiary'} group-hover:text-text-primary`}>
                        <span className="font-medium">{c.point}đ</span> — {c.description}
                      </span>
                    </label>
                  ))}
                </div>
                {q.red_flags && <p className="mt-2 text-[11px] text-red-500 bg-red-50 px-3 py-1.5 rounded">🚫 {q.red_flags}</p>}
                {q.follow_up && <p className="mt-1 text-[11px] text-purple-600 bg-purple-50 px-3 py-1.5 rounded">💬 Follow-up: {q.follow_up}</p>}
              </div>
            ))
          )}
        </div>

        {questions.length > 0 && (
          <div className="px-5 py-4 border-t border-border-subtle shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold text-text-primary">📊 Tổng điểm: {totalScore}/{maxScore} <span className="text-accent">({maxScore > 0 ? Math.round(totalScore/maxScore*100) : 0}%)</span></div>
                <div className="text-[11px] text-text-muted mt-0.5">⚠️ Điểm Smart Question chỉ mang tính tham khảo, không phải cơ sở quyết định chính.</div>
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 text-[13px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-40 shrink-0">
                {submitting ? 'Đang lưu...' : submitted ? '✓ Đã lưu' : 'Lưu đánh giá'}
              </button>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${maxScore > 0 && totalScore/maxScore >= 0.7 ? 'bg-emerald-500' : maxScore > 0 && totalScore/maxScore >= 0.4 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${maxScore > 0 ? Math.round(totalScore/maxScore*100) : 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
