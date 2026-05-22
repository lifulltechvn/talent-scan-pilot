import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, Clock, CheckCircle, AlertTriangle, Briefcase, User } from 'lucide-react';
import { apiClient } from '@/data/api/client';

interface Slot {
  id: string;
  slot_start: string;
  slot_end: string;
  available: boolean;
}

interface ScheduleData {
  job_title: string;
  candidate_name: string;
  slots: Slot[];
}

type Status = 'loading' | 'ready' | 'booking' | 'booked' | 'error';

export function SchedulePublicPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [bookedSlot, setBookedSlot] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    apiClient.get(`/schedule/public/${token}`)
      .then(({ data }) => { setData(data); setStatus('ready'); })
      .catch((e) => { setStatus('error'); setError(e.response?.data?.detail || 'Failed to load schedule'); });
  }, [token]);

  const handleBook = async () => {
    if (!selected) return;
    setStatus('booking');
    setError('');
    try {
      const { data: result } = await apiClient.post(`/schedule/public/${token}/book`, { slot_id: selected });
      setBookedSlot({ start: result.slot_start, end: result.slot_end });
      setStatus('booked');
    } catch (e: any) {
      setStatus('ready');
      setError(e.response?.data?.detail || 'Booking failed. Please try again.');
    }
  };

  if (status === 'loading') return <PageShell><LoadingState /></PageShell>;

  if (status === 'error' && !data) {
    return (
      <PageShell>
        <Card>
          <div className="text-center py-10">
            <AlertTriangle size={36} className="mx-auto mb-3 text-red-400" />
            <h2 className="text-lg font-semibold text-text-primary mb-1">Something went wrong</h2>
            <p className="text-[13px] text-text-tertiary">{error}</p>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (status === 'booked' && bookedSlot) {
    return (
      <PageShell>
        <Card>
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Interview Scheduled!</h2>
            <p className="text-[13px] text-text-tertiary mb-5">Your interview has been confirmed.</p>
            <div className="inline-block bg-bg-surface border border-border-subtle rounded-xl p-5">
              <p className="text-[15px] font-semibold text-text-primary">{formatDate(bookedSlot.start)}</p>
              <p className="text-[13px] text-text-secondary mt-1 flex items-center justify-center gap-1.5">
                <Clock size={13} className="text-accent" />
                {formatTime(bookedSlot.start)} — {formatTime(bookedSlot.end)}
              </p>
            </div>
            <p className="text-[12px] text-text-muted mt-5">You will receive a reminder email before the interview.</p>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card>
        {/* Info header */}
        <div className="flex items-start gap-3 mb-6 pb-5 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <CalendarCheck size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Schedule Your Interview</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[13px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Briefcase size={12} className="text-accent/70" /> {data?.job_title}
              </span>
              {data?.candidate_name && (
                <span className="flex items-center gap-1.5">
                  <User size={12} className="text-accent/70" /> {data.candidate_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">{error}</div>}

        {data?.slots.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mx-auto mb-3">
              <Clock size={22} className="text-text-muted" />
            </div>
            <p className="text-[14px] font-medium text-text-primary mb-1">No available time slots</p>
            <p className="text-[13px] text-text-tertiary">Please contact HR to arrange an alternative time.</p>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-text-muted mb-3">Select a time slot that works for you:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {data?.slots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => setSelected(slot.id)}
                  disabled={!slot.available}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selected === slot.id
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                      : slot.available
                        ? 'border-border-subtle bg-bg-surface hover:border-accent/40 hover:bg-accent/[0.02]'
                        : 'border-border-subtle bg-bg-surface opacity-50 cursor-not-allowed line-through'
                  }`}
                >
                  <p className="text-[14px] font-medium text-text-primary">{formatDate(slot.slot_start)}</p>
                  <p className="text-[13px] text-text-tertiary flex items-center gap-1.5 mt-1">
                    <Clock size={12} className="text-accent/60" />
                    {formatTime(slot.slot_start)} — {formatTime(slot.slot_end)}
                  </p>
                  {!slot.available && <p className="text-[11px] text-red-500 mt-1">Fully booked</p>}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-border-subtle">
              <button
                onClick={handleBook}
                disabled={!selected || status === 'booking'}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <CalendarCheck size={14} />
                {status === 'booking' ? 'Booking...' : 'Confirm Slot'}
              </button>
            </div>
          </>
        )}
      </Card>
    </PageShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border-subtle rounded-2xl p-6 shadow-sm">
      {children}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-primary to-bg-surface/50">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          <span className="relative w-7 h-7 rounded-md flex items-center justify-center">
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-accent" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-accent" />
            <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-accent" />
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-accent" />
            <CalendarCheck size={14} className="text-accent" />
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
        <p className="text-[13px] text-text-muted">Loading available slots...</p>
      </div>
    </Card>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}
