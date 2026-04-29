import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center pt-20 pb-12">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 bg-accent/5 rounded-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={28} className="text-accent/40" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-[13px] text-text-muted max-w-xs text-center">{description}</p>
      {action && (
        <button onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-lg hover:bg-accent-hover transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}
