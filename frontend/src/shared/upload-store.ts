/**
 * Global CV upload store - persists across page navigation.
 * Uses useSyncExternalStore for React integration without extra deps.
 */
import { useSyncExternalStore } from 'react';
import { apiClient } from '@/data/api/client';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'duplicate';
  candidateId?: string;
  candidateName?: string;
  error?: string;
  duplicate?: { type: string; existingId: string; existingName: string; uploadedAt: string };
}

const MAX_CONCURRENT = 5;

let items: UploadItem[] = [];
let listeners: Array<() => void> = [];
let uploadingCount = 0;
let queue: UploadItem[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;

function emit() {
  items = [...items];
  listeners.forEach(l => l());
}

function updateItem(id: string, patch: Partial<UploadItem>) {
  items = items.map(i => i.id === id ? { ...i, ...patch } : i);
  listeners.forEach(l => l());
}

function processQueue() {
  while (uploadingCount < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!;
    uploadingCount++;
    uploadFile(item);
  }
}

async function uploadFile(item: UploadItem) {
  updateItem(item.id, { status: 'uploading' });
  const form = new FormData();
  form.append('file', item.file);
  try {
    const { data } = await apiClient.post('/cv/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      onUploadProgress: (e) => {
        const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
        updateItem(item.id, { progress: pct });
      },
    });
    updateItem(item.id, {
      status: data.status === 'processing' ? 'processing' : data.duplicate ? 'duplicate' : 'done',
      candidateId: data.candidate_id,
      progress: 100,
      duplicate: data.duplicate ? { type: data.duplicate_type, existingId: data.existing_candidate.id, existingName: data.existing_candidate.name, uploadedAt: data.existing_candidate.uploaded_at } : undefined,
    });
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Upload failed';
    updateItem(item.id, { status: 'error', error: msg });
  } finally {
    uploadingCount--;
    processQueue();
  }
  startPollingIfNeeded();
}

function startPollingIfNeeded() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    const processing = items.filter(i => i.status === 'processing' && i.candidateId);
    if (!processing.length) {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      return;
    }
    try {
      const ids = processing.map(i => i.candidateId).join(',');
      const { data } = await apiClient.get(`/cv/upload/status?ids=${ids}`);
      for (const d of data) {
        if (d.status !== 'processing') {
          updateItem(
            items.find(i => i.candidateId === d.candidate_id)!.id,
            { status: 'done', candidateName: d.structured_data?.name },
          );
        }
      }
    } catch { /* ignore */ }
    // Stop polling if none left
    if (!items.some(i => i.status === 'processing')) {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }
  }, 3000);
}

// Public API
export function addFiles(files: File[]) {
  const valid = files.filter(f => /\.(pdf|docx)$/i.test(f.name));
  const newItems: UploadItem[] = valid.map(f => ({
    id: crypto.randomUUID(),
    file: f,
    progress: 0,
    status: 'queued',
  }));
  items = [...items, ...newItems];
  queue.push(...newItems);
  emit();
  processQueue();
}

export function clearCompleted() {
  items = items.filter(i => i.status !== 'done' && i.status !== 'error');
  emit();
}

export async function retryAsUpdate(itemId: string) {
  const item = items.find(i => i.id === itemId);
  if (!item || !item.duplicate) return;
  updateItem(itemId, { status: 'uploading', progress: 0 });
  uploadingCount++;
  const form = new FormData();
  form.append('file', item.file);
  form.append('update_candidate_id', item.duplicate.existingId);
  try {
    const { data } = await apiClient.post('/cv/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
    updateItem(itemId, { status: data.status === 'processing' ? 'processing' : 'done', candidateId: data.candidate_id, progress: 100, duplicate: undefined });
  } catch { updateItem(itemId, { status: 'error', error: 'Update failed' }); }
  finally { uploadingCount--; processQueue(); }
  startPollingIfNeeded();
}

export async function retryAsNew(itemId: string) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  updateItem(itemId, { status: 'uploading', progress: 0 });
  uploadingCount++;
  const form = new FormData();
  form.append('file', item.file);
  form.append('force', 'true');
  try {
    const { data } = await apiClient.post('/cv/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
    updateItem(itemId, { status: data.status === 'processing' ? 'processing' : 'done', candidateId: data.candidate_id, progress: 100, duplicate: undefined });
  } catch { updateItem(itemId, { status: 'error', error: 'Upload failed' }); }
  finally { uploadingCount--; processQueue(); }
  startPollingIfNeeded();
}

export function useUploadStore(): UploadItem[] {
  return useSyncExternalStore(
    (cb) => { listeners.push(cb); return () => { listeners = listeners.filter(l => l !== cb); }; },
    () => items,
  );
}
