import { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}

export function TagInput({ value, onChange, suggestions, placeholder = 'Type to add...' }: Props) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const filtered = input.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)).slice(0, 8)
    : [];

  const add = (tag: string) => {
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput('');
    setOpen(false);
    ref.current?.focus();
  };

  const remove = (tag: string) => onChange(value.filter(t => t !== tag));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      add(input.trim());
    } else if (e.key === 'Backspace' && !input && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 border border-border-default rounded-lg bg-white min-h-[38px] focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent/40">
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-red-500"><X size={10} /></button>
          </span>
        ))}
        <input
          ref={ref}
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] text-[13px] outline-none bg-transparent"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border-subtle rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <button key={s} type="button" onMouseDown={() => add(s)} className="w-full text-left px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent/5 hover:text-accent">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
