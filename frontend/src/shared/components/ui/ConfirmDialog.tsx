import { useState, createContext, useContext, useCallback, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: () => Promise.resolve(false) });

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40" onClick={() => handleClose(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm m-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${state.variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle size={18} className={state.variant === 'danger' ? 'text-red-600' : 'text-amber-600'} />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold text-gray-900">{state.title}</h3>
                <p className="text-[13px] text-gray-600 mt-1">{state.message}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => handleClose(false)} className="flex-1 py-2 text-[13px] font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                {state.cancelLabel || 'Cancel'}
              </button>
              <button onClick={() => handleClose(true)} className={`flex-1 py-2 text-[13px] font-medium text-white rounded-lg ${state.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {state.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
