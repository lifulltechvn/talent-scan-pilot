import { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface ToastContextValue {
  toast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle };
  const colors = { success: 'bg-emerald-50 border-emerald-200 text-emerald-800', error: 'bg-red-50 border-red-200 text-red-800', warning: 'bg-amber-50 border-amber-200 text-amber-800' };
  const iconColors = { success: 'text-emerald-500', error: 'text-red-500', warning: 'text-amber-500' };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-[slideIn_0.2s_ease-out] ${colors[t.type]}`}>
              <Icon size={16} className={iconColors[t.type]} />
              <span className="text-sm flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="opacity-50 hover:opacity-100"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
