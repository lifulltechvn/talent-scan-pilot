/**
 * Global batch upload store - tracks active batch processing across pages.
 */
import { useSyncExternalStore } from 'react';
import { apiClient } from '@/data/api/client';

export interface BatchState {
  batchId: string;
  totalFiles: number;
  processed: number;
  duplicates: number;
  errors: number;
  status: string;
}

let currentBatch: BatchState | null = null;
let listeners: Array<() => void> = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  listeners.forEach(l => l());
}

export function startBatchTracking(batchId: string, totalFiles: number) {
  currentBatch = { batchId, totalFiles, processed: 0, duplicates: 0, errors: 0, status: 'processing' };
  localStorage.setItem('active_batch', JSON.stringify(currentBatch));
  emit();
  startPolling(batchId);
}

export function clearBatch() {
  currentBatch = null;
  localStorage.removeItem('active_batch');
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  emit();
}

function startPolling(batchId: string) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const { data } = await apiClient.get(`/cv/batch/${batchId}`);
      currentBatch = {
        batchId: data.batch_id,
        totalFiles: data.total_files,
        processed: data.processed,
        duplicates: data.duplicates,
        errors: data.errors,
        status: data.status,
      };
      localStorage.setItem('active_batch', JSON.stringify(currentBatch));
      emit();
      if (data.status === 'done') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      }
    } catch { /* ignore */ }
  }, 3000);
}

// Restore from localStorage on load
function restore() {
  try {
    const saved = localStorage.getItem('active_batch');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed || parsed.status === 'done') {
        localStorage.removeItem('active_batch');
        return;
      }
      currentBatch = null; // Don't show until verified
      // Verify batch still exists on server
      apiClient.get(`/cv/batch/${parsed.batchId}`).then(({ data }) => {
        if (data && data.status !== 'done') {
          currentBatch = { batchId: data.batch_id, totalFiles: data.total_files, processed: data.processed, duplicates: data.duplicates, errors: data.errors, status: data.status };
          localStorage.setItem('active_batch', JSON.stringify(currentBatch));
          emit();
          startPolling(parsed.batchId);
        } else {
          clearBatch();
        }
      }).catch(() => {
        clearBatch();
      });
    }
  } catch { /* ignore */ }
}
restore();

export function useBatchStore(): BatchState | null {
  return useSyncExternalStore(
    (cb) => { listeners.push(cb); return () => { listeners = listeners.filter(l => l !== cb); }; },
    () => currentBatch,
  );
}
