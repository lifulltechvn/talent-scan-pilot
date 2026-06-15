import { useEffect } from 'react';
import { useUploadStore, clearCompleted } from '@/shared/upload-store';
import { useBatchStore, clearBatch } from '@/shared/batch-store';
import { CheckCircle, AlertCircle, Loader2, Clock, X, FileText } from 'lucide-react';

export function UploadProgressWidget() {
  const items = useUploadStore();
  const batch = useBatchStore();

  // Auto-dismiss after 5s when done
  useEffect(() => {
    if (batch?.status === 'done') {
      const t = setTimeout(clearBatch, 5000);
      return () => clearTimeout(t);
    }
  }, [batch?.status]);

  if (items.length === 0 && !batch) return null;

  const done = items.filter(i => i.status === 'done').length;
  const active = items.length - done - items.filter(i => i.status === 'error').length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-bg-panel border border-border-subtle rounded-xl shadow-lg overflow-hidden">
      {/* Batch progress */}
      {batch && (
        <div className="px-3 py-2.5 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-accent" />
              <span className="text-xs font-medium text-text-primary">
                {batch.status === 'done' ? 'Xử lý xong' : 'Đang xử lý CV...'}
              </span>
            </div>
            {batch.status === 'done' && (
              <button onClick={clearBatch} className="text-text-muted hover:text-text-primary">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${batch.status === 'done' ? 'bg-emerald-500' : 'bg-accent'}`}
              style={{ width: `${Math.round((batch.processed / batch.totalFiles) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-text-muted">{batch.processed}/{batch.totalFiles} file</span>
            <div className="flex gap-2 text-[10px]">
              {batch.duplicates > 0 && <span className="text-amber-600">{batch.duplicates} trùng</span>}
              {batch.errors > 0 && <span className="text-red-600">{batch.errors} lỗi</span>}
            </div>
          </div>
        </div>
      )}

      {/* Single file uploads (legacy) */}
      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between px-3 py-2 bg-bg-surface border-b border-border-subtle">
            <span className="text-xs font-medium text-text-primary">
              Upload {active > 0 ? `(${active} active)` : `(${done} done)`}
            </span>
            {active === 0 && (
              <button onClick={clearCompleted} className="text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-bg-primary">
                {item.status === 'done' && <CheckCircle size={12} className="text-green-600 shrink-0" />}
                {item.status === 'error' && <AlertCircle size={12} className="text-red-500 shrink-0" />}
                {item.status === 'uploading' && <Loader2 size={12} className="text-blue-500 animate-spin shrink-0" />}
                {item.status === 'processing' && <Clock size={12} className="text-yellow-600 animate-pulse shrink-0" />}
                {item.status === 'queued' && <Clock size={12} className="text-text-muted shrink-0" />}
                <span className="flex-1 truncate text-text-secondary">
                  {item.status === 'done' && item.candidateName ? item.candidateName : item.file.name}
                </span>
                {item.status === 'uploading' && <span className="text-text-muted">{item.progress}%</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
