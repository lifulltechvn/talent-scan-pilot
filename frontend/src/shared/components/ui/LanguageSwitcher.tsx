import { useI18n, LOCALE_LABELS, type Locale } from '@/shared/i18n';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/shared/utils/cn';

const LOCALES: Locale[] = ['en', 'vi', 'ja'];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:bg-bg-surface transition-colors"
      >
        <Globe size={13} className="shrink-0" />
        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-bg-panel border border-border-subtle rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
          {LOCALES.map(l => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-[12px] transition-colors',
                l === locale ? 'text-accent font-medium bg-accent/5' : 'text-text-secondary hover:bg-bg-surface'
              )}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
