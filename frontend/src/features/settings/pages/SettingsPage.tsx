import { Settings as SettingsIcon, Mail, Bell, Shield } from 'lucide-react';

export function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Settings</h1>
      <p className="text-[13px] text-text-tertiary mb-6">System configuration</p>

      <div className="space-y-4">
        <Section icon={Mail} title="Email" description="SMTP configuration for outreach emails">
          <Row label="Provider" value="SMTP (Mailtrap)" />
          <Row label="Server" value="sandbox.smtp.mailtrap.io" />
          <Row label="From" value="hr@lftalentscan.com" />
        </Section>

        <Section icon={Bell} title="Reminders" description="Automatic interview reminder settings">
          <Row label="Send before" value="24 hours" />
          <Row label="Check interval" value="Every 1 hour" />
        </Section>

        <Section icon={Shield} title="Security" description="Authentication and access">
          <Row label="Token expiry" value="30 minutes" />
          <Row label="Quiz deadline" value="48 hours" />
        </Section>
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
