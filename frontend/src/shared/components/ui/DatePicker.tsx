import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Select date' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({ top: 0, left: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 320;
    setPos({
      top: above ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 288),
      above,
    });
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const selectedDate = value ? new Date(value) : null;

  const select = (day: number) => {
    const d = new Date(year, month, day);
    onChange(d.toISOString().slice(0, 10));
    setOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const displayValue = value
    ? new Date(value).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 border border-border-default rounded-lg text-[13px] text-left focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 bg-white"
      >
        <Calendar size={14} className="text-accent/60 shrink-0" />
        <span className={displayValue ? 'text-text-primary' : 'text-text-muted'}>{displayValue || placeholder}</span>
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-white border border-border-subtle rounded-xl shadow-lg p-3 w-[280px]"
            style={{ top: pos.above ? undefined : pos.top, bottom: pos.above ? window.innerHeight - pos.top : undefined, left: pos.left }}
          >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 hover:bg-bg-surface rounded-md"><ChevronLeft size={16} className="text-text-secondary" /></button>
            <span className="text-[13px] font-medium text-text-primary">
              {viewDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 hover:bg-bg-surface rounded-md"><ChevronRight size={16} className="text-text-secondary" /></button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-[10px] font-medium text-text-muted text-center py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              if (!day) return <div key={i} />;
              const date = new Date(year, month, day);
              const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
              const isToday = date.getTime() === today.getTime();
              const isPast = date < today;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => select(day)}
                  disabled={isPast}
                  className={`w-8 h-8 mx-auto rounded-lg text-[12px] font-medium transition-colors ${
                    isSelected
                      ? 'bg-accent text-white'
                      : isToday
                        ? 'bg-accent/10 text-accent'
                        : isPast
                          ? 'text-text-muted/40 cursor-not-allowed'
                          : 'text-text-primary hover:bg-bg-surface'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="mt-2 w-full text-[11px] text-text-muted hover:text-red-500 text-center py-1">
              Clear date
            </button>
          )}
        </div>
        </>,
        document.body,
      )}
    </div>
  );
}
