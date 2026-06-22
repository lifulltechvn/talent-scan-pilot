import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Bell, Shield, Save, Check, Activity } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';
import { TagInput } from '@/shared/components/ui/TagInput';
import { RichTextEditor } from '@/shared/components/ui/RichTextEditor';

interface Template {
  template_type: string;
  greeting: string;
  body: string;
  closing: string;
  highlights: string[] | null;
  tips: string[] | null;
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw !== confirm) { setMsg({ type: 'err', text: 'New passwords do not match' }); return; }
    if (newPw.length < 6) { setMsg({ type: 'err', text: 'Password must be at least 6 characters' }); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/change-password', { current_password: current, new_password: newPw });
      setMsg({ type: 'ok', text: 'Password changed successfully!' });
      setCurrent(''); setNewPw(''); setConfirm('');
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to change password' });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 max-w-sm">
      <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Current password" required className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
      <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" required className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password" required className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
      <button type="submit" disabled={loading} className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50">
        {loading ? 'Changing...' : 'Change Password'}
      </button>
      {msg && <p className={`text-xs ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}
    </form>
  );
}

export function SettingsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'general' | 'templates' | 'master' | 'users' | 'ai-monitor'>('general');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.get('/email-templates').then(({ data }) => setTemplates(data)).catch(() => {});
  }, []);

  const startEdit = (t: Template) => { setEditing(t.template_type); setForm({ ...t }); setSaved(false); };

  const handleSave = async () => {
    if (!form || !editing) return;
    setSaving(true);
    try {
      const { data } = await apiClient.put(`/email-templates/${editing}`, {
        greeting: form.greeting, body: form.body, closing: form.closing,
        highlights: form.highlights, tips: form.tips,
      });
      setTemplates(prev => prev.map(t => t.template_type === editing ? data : t));
      setSaved(true);
      setTimeout(() => { setEditing(null); setForm(null); setSaved(false); }, 1000);
    } catch { }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">{t('settings')}</h1>
      <p className="text-[13px] text-text-tertiary mb-6">System configuration</p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bg-surface rounded-lg mb-6 w-fit">
        <button onClick={() => setTab('general')} className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${tab === 'general' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>General</button>
        <button onClick={() => setTab('templates')} className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${tab === 'templates' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>Email Templates</button>
        <button onClick={() => setTab('master')} className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${tab === 'master' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>Master Data</button>
        <button onClick={() => setTab('users')} className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${tab === 'users' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>Users</button>
        <button onClick={() => setTab('ai-monitor')} className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${tab === 'ai-monitor' ? 'bg-white text-accent shadow-sm' : 'text-text-muted'}`}>AI Monitor</button>
      </div>

      {tab === 'general' && (
        <div className="space-y-4">
          <Section icon={Shield} title="Change Password" description="Update your account password">
            <ChangePasswordForm />
          </Section>
          <Section icon={Mail} title="Email" description="SMTP configuration">
            <Row label="Provider" value="SMTP (Mailtrap)" />
            <Row label="From" value="hr@lftalentscan.com" />
          </Section>
          <Section icon={Mail} title="Email Signature" description="Chữ ký hiển thị cuối mỗi email gửi đi">
            <EmailSignatureEditor />
          </Section>
          <Section icon={Bell} title="Reminders" description="Automatic interview reminders">
            <Row label="Send before" value="24 hours" />
            <Row label="Check interval" value="Every 1 hour" />
          </Section>
          <Section icon={Shield} title="Security" description="Authentication settings">
            <Row label="Token expiry" value="30 minutes" />
          </Section>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-3">
          {templates.map(tmpl => (
            <div key={tmpl.template_type} className="bg-bg-panel border border-border-subtle rounded-xl p-5">
              {editing === tmpl.template_type && form ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[14px] font-medium text-text-primary capitalize">{tmpl.template_type}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(null); setForm(null); }} className="text-[12px] text-text-muted hover:text-text-secondary">Cancel</button>
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white text-[12px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">
                        {saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> {saving ? 'Saving...' : 'Save'}</>}
                      </button>
                    </div>
                  </div>
                  <Field label="Greeting" value={form.greeting} onChange={v => setForm({ ...form, greeting: v })} />
                  <div>
                    <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Body</label>
                    <RichTextEditor content={form.body} onChange={v => setForm({ ...form, body: v })} placeholder="Nội dung email..." />
                  </div>
                  <Field label="Closing" value={form.closing} onChange={v => setForm({ ...form, closing: v })} />
                  {tmpl.template_type === 'outreach' && (
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Highlights (one per line)</label>
                      <textarea value={(form.highlights || []).join('\n')} onChange={e => setForm({ ...form, highlights: e.target.value.split('\n').filter(Boolean) })} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
                    </div>
                  )}
                  {tmpl.template_type === 'reminder' && (
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Tips (one per line)</label>
                      <textarea value={(form.tips || []).join('\n')} onChange={e => setForm({ ...form, tips: e.target.value.split('\n').filter(Boolean) })} rows={2} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
                    </div>
                  )}
                  <p className="text-[11px] text-text-muted">Variables: {'{name}'}, {'{job_title}'}, {'{company}'}</p>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[14px] font-medium text-text-primary capitalize">{tmpl.template_type}</h3>
                    <p className="text-[12px] text-text-tertiary mt-1 line-clamp-2">{tmpl.greeting} — {tmpl.body.slice(0, 80)}...</p>
                  </div>
                  <button onClick={() => startEdit(tmpl)} className="text-[12px] text-accent hover:underline shrink-0">Edit</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'master' && (
        <MasterDataEditor />
      )}
      {tab === 'users' && (
        <UserManagement />
      )}
      {tab === 'ai-monitor' && (
        <AIMonitor />
      )}
    </div>
  );
}


function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'interviewer' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/users').then(({ data }) => setUsers(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) { setError('Vui lòng điền đầy đủ'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await apiClient.post('/users', form);
      setUsers(prev => [data, ...prev]);
      setShowCreate(false);
      setForm({ email: '', password: '', full_name: '', role: 'interviewer' });
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    setSaving(true); setError('');
    try {
      const { data } = await apiClient.put(`/users/${editingUser.id}`, { full_name: editingUser.full_name, role: editingUser.role });
      setUsers(prev => prev.map(x => x.id === editingUser.id ? { ...x, ...data } : x));
      setEditingUser(null);
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleDelete = async (u: any) => {
    if (u.is_active) {
      if (!confirm(`Vô hiệu hoá user "${u.full_name}" (${u.email})? User sẽ không thể đăng nhập nhưng lịch sử phỏng vấn vẫn được giữ.`)) return;
      const { data } = await apiClient.put(`/users/${u.id}`, { is_active: false });
      setUsers(prev => prev.map(x => x.id === u.id ? data : x));
    } else {
      const { data } = await apiClient.put(`/users/${u.id}`, { is_active: true });
      setUsers(prev => prev.map(x => x.id === u.id ? data : x));
    }
  };

  const toggleActive = async (u: any) => {
    const { data } = await apiClient.put(`/users/${u.id}`, { is_active: !u.is_active });
    setUsers(prev => prev.map(x => x.id === u.id ? data : x));
  };

  const changeRole = async (u: any, role: string) => {
    const { data } = await apiClient.put(`/users/${u.id}`, { role });
    setUsers(prev => prev.map(x => x.id === u.id ? data : x));
  };

  if (loading) return <div className="text-[13px] text-text-muted py-4">Loading...</div>;

  const ROLE_BADGE: Record<string, string> = { admin: 'bg-red-100 text-red-700', hr: 'bg-blue-100 text-blue-700', interviewer: 'bg-purple-100 text-purple-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">{users.length} users</h3>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover">+ Tạo user</button>
      </div>

      {showCreate && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" placeholder="user@company.com" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Họ tên</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] bg-white">
                <option value="interviewer">Interviewer</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">{saving ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-[13px] text-text-muted border border-border-subtle rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_100px_80px_70px] gap-3 px-4 py-2.5 border-b border-border-subtle text-[11px] font-medium text-text-muted uppercase">
          <span>Email</span><span>Họ tên</span><span>Role</span><span>Status</span><span></span>
        </div>
        <div className="divide-y divide-border-subtle">
          {users.map(u => (
            <div key={u.id} className="grid grid-cols-[1fr_1fr_100px_80px_70px] gap-3 px-4 py-3 items-center">
              <span className="text-[13px] text-text-primary truncate">{u.email}</span>
              <span className="text-[13px] text-text-secondary truncate">{u.full_name}</span>
              <select value={u.role} onChange={e => changeRole(u, e.target.value)} className={`text-[11px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${ROLE_BADGE[u.role] || ''}`}>
                <option value="interviewer">interviewer</option>
                <option value="hr">hr</option>
                <option value="admin">admin</option>
              </select>
              <button onClick={() => toggleActive(u)} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {u.is_active ? 'Active' : 'Inactive'}
              </button>
              <div className="flex gap-1">
                <button onClick={() => setEditingUser({ ...u })} className="text-[11px] text-accent hover:underline">Sửa</button>
                <button onClick={() => handleDelete(u)} className="text-[11px] text-red-500 hover:underline">{u.is_active ? 'Xoá' : 'Kích hoạt'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm m-4 p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary">Sửa user</h3>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Họ tên</label>
              <input value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase">Role</label>
              <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] bg-white">
                <option value="interviewer">Interviewer</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleEdit} disabled={saving} className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40">{saving ? 'Saving...' : 'Lưu'}</button>
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-[13px] text-text-muted border border-border-subtle rounded-lg">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function MasterDataEditor() {
  const [locations, setLocations] = useState<string[]>([]);
  const [salaries, setSalaries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/master-data').then(({ data }) => {
      setLocations(data.locations || []);
      setSalaries(data.salary_ranges || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = (locs: string[], sals: string[]) => {
    apiClient.put('/master-data', { locations: locs, salary_ranges: sals }).catch(() => {});
  };

  const updateLocations = (v: string[]) => { setLocations(v); save(v, salaries); };
  const updateSalaries = (v: string[]) => { setSalaries(v); save(locations, v); };

  if (loading) return <div className="text-[13px] text-text-muted py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-text-primary">Locations</h3>
          <p className="text-[12px] text-text-tertiary">Danh sách địa điểm hiện trong dropdown khi tạo/edit job</p>
        </div>
        <TagInput value={locations} onChange={updateLocations} suggestions={[]} placeholder="Nhập location rồi Enter..." />
      </div>

      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-text-primary">Salary Ranges</h3>
          <p className="text-[12px] text-text-tertiary">Danh sách mức lương hiện trong dropdown</p>
        </div>
        <TagInput value={salaries} onChange={updateSalaries} suggestions={[]} placeholder="Nhập salary range rồi Enter..." />
      </div>
    </div>
  );
}

function AIMonitor() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [perCandidate, setPerCandidate] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/ai-usage/summary?days=${days}`),
      apiClient.get(`/ai-usage/daily?days=${Math.min(days, 90)}`),
      apiClient.get(`/ai-usage/per-candidate?days=${days}`),
      apiClient.get(`/ai-usage/logs?days=${days}`),
    ]).then(([s, d, c, l]) => { setSummary(s.data); setDaily(d.data); setPerCandidate(c.data); setLogs(l.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="text-[13px] text-text-muted py-4">Loading...</div>;
  if (!summary) return <div className="text-[13px] text-text-muted py-4">No data</div>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-muted">Period:</span>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 text-[12px] font-medium rounded-md ${days === d ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted hover:text-text-secondary'}`}>{d}d</button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Total Calls" value={summary.total.calls.toLocaleString()} />
        <SummaryCard label="Input Tokens" value={formatTokens(summary.total.input_tokens)} />
        <SummaryCard label="Output Tokens" value={formatTokens(summary.total.output_tokens)} />
        <SummaryCard label="Total Cost" value={`$${summary.total.cost_usd.toFixed(4)}`} />
      </div>

      {/* Full Activity Log */}
      {logs.length > 0 && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">AI Activity Log ({logs.length} calls)</h3>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-bg-panel">
                <tr className="border-b border-border-subtle text-left text-text-muted uppercase">
                  <th className="pb-2 pr-3">Thời gian</th>
                  <th className="pb-2 pr-3">Feature</th>
                  <th className="pb-2 pr-3">Model</th>
                  <th className="pb-2 pr-3">Candidate</th>
                  <th className="pb-2 pr-3 text-right">Input</th>
                  <th className="pb-2 pr-3 text-right">Output</th>
                  <th className="pb-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface/50">
                    <td className="py-1.5 pr-3 text-text-muted whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</td>
                    <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${featureColor(l.feature)}`}>{l.feature}</span></td>
                    <td className="py-1.5 pr-3 text-text-secondary">{l.model.replace(/-v\d.*/, '')}</td>
                    <td className="py-1.5 pr-3 text-text-primary">{l.candidate_name || <span className="text-text-muted">—</span>}</td>
                    <td className="py-1.5 pr-3 text-right text-text-secondary">{l.input_tokens.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right text-text-secondary">{l.output_tokens.toLocaleString()}</td>
                    <td className="py-1.5 text-right font-medium text-text-primary">${l.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily breakdown table */}
      {daily.length > 0 && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Daily Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-muted uppercase">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Calls</th>
                  <th className="pb-2 pr-4">Input Tokens</th>
                  <th className="pb-2 pr-4">Output Tokens</th>
                  <th className="pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {daily.slice().reverse().map(d => (
                  <tr key={d.date} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-4 text-text-secondary">{d.date}</td>
                    <td className="py-2 pr-4 text-text-primary font-medium">{d.calls}</td>
                    <td className="py-2 pr-4 text-text-secondary">{formatTokens(d.input_tokens)}</td>
                    <td className="py-2 pr-4 text-text-secondary">{formatTokens(d.output_tokens)}</td>
                    <td className="py-2 font-medium text-text-primary">${d.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per Candidate cost */}
      {perCandidate.length > 0 && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Cost per Candidate</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-muted uppercase">
                  <th className="pb-2 pr-4">Candidate</th>
                  <th className="pb-2 pr-4">AI Calls</th>
                  <th className="pb-2 pr-4">Tokens</th>
                  <th className="pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {perCandidate.map(c => (
                  <tr key={c.candidate_id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-4 text-text-primary font-medium">{c.candidate_name}</td>
                    <td className="py-2 pr-4 text-text-secondary">{c.calls}</td>
                    <td className="py-2 pr-4 text-text-secondary">{formatTokens(c.input_tokens + c.output_tokens)}</td>
                    <td className="py-2 font-medium text-text-primary">${c.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Feature */}
      {summary.by_feature.length > 0 && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Cost by Feature</h3>
          <div className="space-y-2">
            {summary.by_feature.sort((a: any, b: any) => b.cost_usd - a.cost_usd).map((f: any) => (
              <div key={f.feature} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-[13px] text-text-secondary capitalize">{f.feature.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="text-text-muted">{f.calls} calls</span>
                  <span className="text-text-muted">{formatTokens(f.input_tokens + f.output_tokens)} tok</span>
                  <span className="font-medium text-text-primary">${f.cost_usd.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Model */}
      {summary.by_model.length > 0 && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Cost by Model</h3>
          <div className="space-y-2">
            {summary.by_model.sort((a: any, b: any) => b.cost_usd - a.cost_usd).map((m: any) => (
              <div key={m.model_id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-[13px] text-text-secondary">{m.model_id.split('.').pop() || m.model_id}</span>
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="text-text-muted">{m.calls} calls</span>
                  <span className="text-text-muted">{formatTokens(m.input_tokens + m.output_tokens)} tok</span>
                  <span className="font-medium text-text-primary">${m.cost_usd.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function featureColor(feature: string): string {
  const map: Record<string, string> = {
    cv_parsing: 'bg-blue-100 text-blue-700',
    embedding: 'bg-purple-100 text-purple-700',
    scoring: 'bg-amber-100 text-amber-700',
    ocr: 'bg-rose-100 text-rose-700',
    outreach: 'bg-cyan-100 text-cyan-700',
    jd_import: 'bg-indigo-100 text-indigo-700',
    jd_generate: 'bg-indigo-100 text-indigo-700',
    recommendation: 'bg-orange-100 text-orange-700',
  };
  return map[feature] || 'bg-gray-100 text-gray-700';
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-4 text-center">
      <div className="text-[11px] font-medium text-text-muted uppercase">{label}</div>
      <div className="text-lg font-semibold text-text-primary mt-1">{value}</div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function Section({ icon: Icon, title, description, children }: { icon: typeof SettingsIcon; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-accent" />
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
      </div>
      <p className="text-[12px] text-text-tertiary mb-4">{description}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span className="text-[13px] text-text-primary font-medium">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40" />
    </div>
  );
}

function EmailSignatureEditor() {
  const [sig, setSig] = useState({ name: '', title: '', company: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.get('/outreach/signature').then(({ data }) => setSig(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await apiClient.put('/outreach/signature', sig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="text-[12px] text-text-muted">Loading...</div>;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={sig.name} onChange={e => setSig({ ...sig, name: e.target.value })} placeholder="Họ tên" className="px-3 py-1.5 border border-border-subtle rounded-lg text-[13px]" />
        <input value={sig.title} onChange={e => setSig({ ...sig, title: e.target.value })} placeholder="Chức vụ" className="px-3 py-1.5 border border-border-subtle rounded-lg text-[13px]" />
      </div>
      <input value={sig.company} onChange={e => setSig({ ...sig, company: e.target.value })} placeholder="Tên công ty" className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-[13px]" />
      <div className="grid grid-cols-2 gap-2">
        <input value={sig.email} onChange={e => setSig({ ...sig, email: e.target.value })} placeholder="Email" className="px-3 py-1.5 border border-border-subtle rounded-lg text-[13px]" />
        <input value={sig.phone} onChange={e => setSig({ ...sig, phone: e.target.value })} placeholder="Số điện thoại" className="px-3 py-1.5 border border-border-subtle rounded-lg text-[13px]" />
      </div>
      <button onClick={handleSave} className="px-4 py-1.5 bg-accent text-white text-[12px] font-medium rounded-lg hover:bg-accent-hover">
        {saved ? '✓ Đã lưu' : 'Lưu chữ ký'}
      </button>
    </div>
  );
}
