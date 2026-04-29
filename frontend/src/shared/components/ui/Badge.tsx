import { cn } from '@/shared/utils/cn';
import type { Classification } from '@/domain/models/candidate';

const variants = {
  gold: 'bg-amber-100 text-amber-800',
  silver: 'bg-slate-100 text-slate-700',
  talent_pool: 'bg-indigo-100 text-indigo-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-700',
  neutral: 'bg-gray-100 text-gray-600',
} as const;

type Variant = Classification | 'success' | 'warning' | 'error' | 'neutral';

export function Badge({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', variants[variant])}>
      {children}
    </span>
  );
}
