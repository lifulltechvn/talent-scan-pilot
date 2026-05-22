import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, XCircle, Bell, Search } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { apiClient } from '@/data/api/client';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';

interface OutreachLog {
  id: string;
  candidate_id: string;
  candidate_name: string;
  template_type: string;
  subject: string | null;
  content: string;
  status: string;
  sent_at: string;
}

const typeConfig: Record<string, { label: string; icon: typeof Send; color: string; bg: string }> = {
  outreach: { label: 'Outreach', icon: Send, color: 'text-accent', bg: 'bg-orange-50' },
  rejection: { label: 'Rejection', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  reminder: { label: 'Reminder', icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' },
};

type Filter = 'all' | 'outreach' | 'rejection' | 'reminder';

export function OutreachPage() {
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/outreach/logs')
      .then(({ data }) => setLogs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={5} />;

  const filtered = logs
    .filter(l => filter === 'all' || l.template_type === filter)
    .filter(l => !search || l.candidate_name.toLowerCase().includes(search.toLowerCase()) || l.subject?.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all: logs.length,
    outreach: logs.filter(l => l.template_type === 'outreach').length,
    rejection: logs.filter(l => l.template_type === 'rejection').length,
    reminder: logs.filter(l => l.template_type === 'reminder').length,
  };

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'outreach', label: `Outreach (${counts.outreach})` },
    { value: 'rejection', label: `Rejection (${counts.rejection})` },
    { value: 'reminder', label: `Reminder (${counts.reminder})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Email Outreach</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{logs.length} emails sent</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by candidate or subject..."
            className="w-full pl-9 pr-3 py-2 bg-bg-panel border border-border-subtle rounded-lg text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40"
          />
        </div>
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'text-[12px] font-medium px-3 py-2 rounded-lg transition-colors',
                filter === f.value ? 'bg-accent text-white' : 'bg-bg-panel border border-border-subtle text-text-secondary hover:text-text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email list */}
      {filtered.length === 0 ? (
        <EmptyState icon={Mail} title="No emails found" description="Outreach emails will appear here when candidates are approved or rejected" />
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const tc = typeConfig[log.template_type] || typeConfig.outreach;
            const TypeIcon = tc.icon;
            const isExpanded = expanded === log.id;

            return (
              <div key={log.id} className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-bg-surface/30 transition-colors"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tc.bg)}>
                    <TypeIcon size={14} className={tc.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/candidates/${log.candidate_id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-[13px] font-medium text-accent hover:underline truncate"
                      >
                        {log.candidate_name}
                      </Link>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', tc.bg, tc.color)}>
                        {tc.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-tertiary truncate mt-0.5">{log.subject || '(no subject)'}</p>
                  </div>
                  <div className="text-[11px] text-text-muted shrink-0">
                    {new Date(log.sent_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border-subtle">
                    <pre className="text-[12px] text-text-secondary whitespace-pre-wrap bg-bg-surface rounded-lg p-3 mt-3 max-h-48 overflow-y-auto">
                      {log.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
