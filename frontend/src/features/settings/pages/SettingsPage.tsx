import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Bell, Shield, Save, Check } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useI18n } from '@/shared/i18n';

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
  const [tab, setTab] = useState<'general' | 'templates' | 'master'>('general');
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
          <Section icon={Bell} title="Reminders" description="Automatic interview reminders">
            <Row label="Send before" value="24 hours" />
            <Row label="Check interval" value="Every 1 hour" />
          </Section>
          <Section icon={Shield} title="Security" description="Authentication settings">
            <Row label="Token expiry" value="30 minutes" />
            <Row label="Quiz deadline" value="48 hours" />
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
                    <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y" />
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
    </div>
  );
}

function MasterDataEditor() {
  const [locations, setLocations] = useState('');
  const [salaries, setSalaries] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.get('/master-data').then(({ data }) => {
      setLocations(data.locations.join('\n'));
      setSalaries(data.salary_ranges.join('\n'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await apiClient.put('/master-data', {
      locations: locations.split('\n').map((s: string) => s.trim()).filter(Boolean),
      salary_ranges: salaries.split('\n').map((s: string) => s.trim()).filter(Boolean),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="text-[13px] text-text-muted py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Locations</h3>
            <p className="text-[12px] text-text-tertiary">Danh sách địa điểm hiện trong dropdown khi tạo/edit job (mỗi dòng 1 location)</p>
          </div>
        </div>
        <textarea value={locations} onChange={e => setLocations(e.target.value)} rows={6} className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y font-mono" />
      </div>

      <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Salary Ranges</h3>
            <p className="text-[12px] text-text-tertiary">Danh sách mức lương hiện trong dropdown (mỗi dòng 1 range)</p>
          </div>
        </div>
        <textarea value={salaries} onChange={e => setSalaries(e.target.value)} rows={6} className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-y font-mono" />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors">
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
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
