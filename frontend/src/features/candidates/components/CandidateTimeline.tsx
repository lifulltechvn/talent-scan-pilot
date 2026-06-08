import { useEffect, useState } from 'react';
import { FileText, Star, ClipboardCheck, CalendarCheck, Mail, MessageSquare } from 'lucide-react';
import { apiClient } from '@/data/api/client';

interface TimelineEvent {
  type: string;
  title: string;
  detail: string | null;
  timestamp: string;
}

const iconMap: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  scanned: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  scored: { icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
  quiz_sent: { icon: ClipboardCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
  quiz_submitted: { icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  interview_booked: { icon: CalendarCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
  email_sent: { icon: Mail, color: 'text-accent', bg: 'bg-orange-50' },
  feedback: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export function CandidateTimeline({ candidateId }: { candidateId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/candidates/${candidateId}/timeline`)
      .then(({ data }) => setEvents(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) return <div className="text-[12px] text-text-muted py-4 text-center">Loading timeline...</div>;
  if (events.length === 0) return <div className="text-[12px] text-text-muted py-4 text-center">No events yet</div>;

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border-subtle" />
      {events.map((ev, i) => {
        const cfg = iconMap[ev.type] || iconMap.scanned;
        const Icon = cfg.icon;
        const date = new Date(ev.timestamp);
        return (
          <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
            <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center ${cfg.bg}`}>
              <Icon size={12} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-text-primary">{ev.title}</span>
                <span className="text-[11px] text-text-muted shrink-0">{date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
              </div>
              {ev.detail && <p className="text-[12px] text-text-tertiary mt-0.5">{ev.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
