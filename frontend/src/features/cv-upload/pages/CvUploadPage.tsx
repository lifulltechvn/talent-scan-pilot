import { useCallback, useEffect, useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw, UserPlus, SkipForward, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/data/api/client';
import { startBatchTracking } from '@/shared/batch-store';

interface BatchItem {
  id: string;
  file_name: string;
  status: string;
  candidate_id: string | null;
  candidate_name: string | null;
  duplicate_of: string | null;
  duplicate_name: string | null;
  error: string | null;
}

interface BatchStatus {
  batch_id: string;
  total_files: number;
  processed: number;
  duplicates: number;
  errors: number;
  status: string;
  items: BatchItem[];
}

export function CvUploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batch, setBatch] = useState<BatchStatus | null>(null);
  const [error, setError] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('duplicates');

  // Restore active batch on mount — fetch latest from server
  useEffect(() => {
    apiClient.get('/cv/batch/latest').then(({ data }) => {
      if (data && data.status !== 'done') {
        setBatch(data);
        startBatchTracking(data.batch_id, data.total_files);
        pollBatch(data.batch_id);
      } else if (data && data.status === 'done' && data.duplicates > 0) {
        // Show completed batch with unresolved duplicates
        setBatch(data);
      }
    }).catch(() => {});
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const all = Array.from(files);
    const valid = all.filter(f => /\.(pdf|docx)$/i.test(f.name));
    const skipped = all.length - valid.length;
    if (skipped > 0) {
      setError(`${skipped} file(s) skipped — only PDF and DOCX are supported.`);
    }
    if (!valid.length) return;

    setUploading(true);
    if (!skipped) setError('');
    setUploadProgress(0);

    const form = new FormData();
    valid.forEach(f => form.append('files', f));

    try {
      const { data } = await apiClient.post('/cv/batch/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000,
        onUploadProgress: (e) => {
          setUploadProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0);
        },
      });
      setBatch({ ...data, items: [] });
      setUploading(false);
      startBatchTracking(data.batch_id, data.total_files);
      pollBatch(data.batch_id);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed');
      setUploading(false);
    }
  };

  const pollBatch = (batchId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/cv/batch/${batchId}`);
        setBatch(data);
        if (data.status === 'done') clearInterval(interval);
      } catch { /* ignore */ }
    }, 3000);
    apiClient.get(`/cv/batch/${batchId}`).then(({ data }) => setBatch(data)).catch(() => {});
  };

  const handleResolve = async (itemId: string, action: string) => {
    if (!batch) return;
    await apiClient.post(`/cv/batch/${batch.batch_id}/items/${itemId}/resolve?action=${action}`);
    const { data } = await apiClient.get(`/cv/batch/${batch.batch_id}`);
    setBatch(data);
  };

  const handleResolveAll = async (action: string) => {
    if (!batch) return;
    await apiClient.post(`/cv/batch/${batch.batch_id}/resolve-all?action=${action}`);
    const { data } = await apiClient.get(`/cv/batch/${batch.batch_id}`);
    setBatch(data);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const duplicates = batch?.items.filter(i => i.status === 'duplicate') ?? [];
  const done = batch?.items.filter(i => i.status === 'done') ?? [];
  const errors = batch?.items.filter(i => i.status === 'error') ?? [];
  const processing = batch?.items.filter(i => i.status === 'pending') ?? [];

  const toggle = (section: string) => setExpandedSection(expandedSection === section ? null : section);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Upload CV</h1>
      <p className="text-sm text-text-secondary mb-6">Upload CV để tạo hồ sơ ứng viên. Hỗ trợ tối đa 200 file/lần.</p>

      {/* Drop zone */}
      {!uploading && !batch && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-border-subtle'}`}
        >
          <Upload className="mx-auto mb-3 text-text-muted" size={32} />
          <p className="text-sm text-text-secondary mb-2">Kéo thả CV vào đây hoặc chọn file</p>
          <p className="text-xs text-text-muted mb-3">PDF, DOCX — tối đa 10MB/file, 200 file/lần</p>
          <label className="inline-block px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-accent-hover">
            Chọn file
            <input type="file" multiple accept=".pdf,.docx" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
          </label>
        </div>
      )}

      {/* Uploading to server */}
      {uploading && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-6 text-center">
          <Loader2 className="mx-auto mb-3 text-accent animate-spin" size={32} />
          <p className="text-sm font-medium text-text-primary">Đang upload files lên server...</p>
          <p className="text-xs text-text-muted mt-1">Vui lòng không đóng tab cho đến khi hoàn tất</p>
          <div className="w-full h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-xs text-text-muted mt-2">{uploadProgress}%</p>
        </div>
      )}

      {/* Batch result */}
      {batch && !uploading && (
        <div className="space-y-3">
          {/* Overall progress */}
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                {batch.status === 'done' ? '✅ Xử lý hoàn tất' : '🔄 Đang xử lý...'}
              </span>
              <span className="text-xs text-text-muted">{batch.processed}/{batch.total_files} file</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${batch.status === 'done' ? 'bg-emerald-500' : 'bg-accent'}`}
                style={{ width: `${Math.round((batch.processed / batch.total_files) * 100)}%` }}
              />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-600">{done.length}</div>
              <div className="text-[10px] text-text-muted">Thành công</div>
            </div>
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-600">{duplicates.length}</div>
              <div className="text-[10px] text-text-muted">Trùng</div>
            </div>
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-600">{errors.length}</div>
              <div className="text-[10px] text-text-muted">Lỗi</div>
            </div>
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{processing.length}</div>
              <div className="text-[10px] text-text-muted">Đang xử lý</div>
            </div>
          </div>

          {/* Duplicates section */}
          {duplicates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggle('duplicates')}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <span className="text-[13px] font-medium text-amber-800">CV trùng ({duplicates.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); handleResolveAll('update_all'); }} className="text-[10px] px-2 py-1 bg-accent text-white rounded-md hover:bg-accent-hover">
                      Cập nhật tất cả
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleResolveAll('create_all'); }} className="text-[10px] px-2 py-1 bg-white border border-amber-300 text-amber-800 rounded-md hover:bg-amber-100">
                      Tạo mới tất cả
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleResolveAll('skip_all'); }} className="text-[10px] px-2 py-1 text-amber-700 hover:text-amber-900">
                      Bỏ qua
                    </button>
                  </div>
                  {expandedSection === 'duplicates' ? <ChevronUp size={14} className="text-amber-600" /> : <ChevronDown size={14} className="text-amber-600" />}
                </div>
              </div>
              {expandedSection === 'duplicates' && (
                <div className="px-4 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {duplicates.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-text-primary truncate">{item.file_name}</div>
                        <div className="text-[10px] text-text-muted">
                          Trùng với: <span className="font-medium">{item.duplicate_name}</span>
                          {item.duplicate_of && <Link to={`/candidates/${item.duplicate_of}`} className="text-accent ml-1 hover:underline">xem ↗</Link>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button onClick={() => handleResolve(item.id, 'update')} className="p-1.5 text-accent hover:bg-accent/10 rounded-md" title="Cập nhật hồ sơ cũ">
                          <RefreshCw size={13} />
                        </button>
                        <button onClick={() => handleResolve(item.id, 'create_new')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Tạo ứng viên mới">
                          <UserPlus size={13} />
                        </button>
                        <button onClick={() => handleResolve(item.id, 'skip')} className="p-1.5 text-text-muted hover:bg-gray-100 rounded-md" title="Bỏ qua">
                          <SkipForward size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Errors section */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggle('errors')}>
                <div className="flex items-center gap-2">
                  <XCircle size={15} className="text-red-600" />
                  <span className="text-[13px] font-medium text-red-800">Lỗi ({errors.length})</span>
                </div>
                {expandedSection === 'errors' ? <ChevronUp size={14} className="text-red-600" /> : <ChevronDown size={14} className="text-red-600" />}
              </div>
              {expandedSection === 'errors' && (
                <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {errors.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-red-100">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-text-primary truncate">{item.file_name}</div>
                        <div className="text-[10px] text-red-600">{item.error || 'Không thể xử lý file'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Success section */}
          {done.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggle('done')}>
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-600" />
                  <span className="text-[13px] font-medium text-emerald-800">Thành công ({done.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/candidates" className="text-[11px] text-emerald-700 hover:underline flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    Xem danh sách <ExternalLink size={10} />
                  </Link>
                  {expandedSection === 'done' ? <ChevronUp size={14} className="text-emerald-600" /> : <ChevronDown size={14} className="text-emerald-600" />}
                </div>
              </div>
              {expandedSection === 'done' && (
                <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
                  {done.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-100">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-text-primary truncate">{item.candidate_name || item.file_name}</div>
                      </div>
                      {item.candidate_id && (
                        <Link to={`/candidates/${item.candidate_id}`} className="text-[10px] text-accent hover:underline shrink-0 ml-2">
                          Xem ↗
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload more */}
          {batch.status === 'done' && (
            <button onClick={() => setBatch(null)} className="w-full py-3 text-sm font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/5 transition-colors">
              Upload thêm CV
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

      <p className="mt-6 text-xs text-text-muted">
        💡 Files được upload lên server trước. Sau đó hệ thống tự xử lý — bạn có thể đóng tab và quay lại sau.
      </p>
    </div>
  );
}
