import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Clock } from 'lucide-react';
import { apiClient } from '@/data/api/client';
import { useJobs } from '@/features/jobs/hooks/useJobs';

interface UploadResult {
  candidate_id: string;
  file_name: string;
  page_count: number;
  is_scanned: boolean;
  pii_detected: Record<string, number>;
  structured_data?: Record<string, unknown>;
  status?: string;
}

export function CvUploadPage() {
  const { data: jobs } = useJobs();
  const [jobId, setJobId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<{ file: string; result?: UploadResult; error?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => () => pollRef.current.forEach(clearInterval), []);

  const pollCandidate = (idx: number, candidateId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/candidates/${candidateId}`);
        if (data.status !== 'processing') {
          clearInterval(interval);
          setResults(prev => prev.map((r, i) => i === idx ? { ...r, result: { ...r.result!, structured_data: data.structured_data, status: data.status } } : r));
        }
      } catch { /* ignore */ }
    }, 2000);
    pollRef.current.push(interval);
  };

  const handleFiles = (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => /\.(pdf|docx)$/i.test(f.name));
    setFiles(prev => [...prev, ...valid]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const upload = async () => {
    if (!files.length) return;
    setUploading(true);
    setResults([]);
    const newResults: typeof results = [];

    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      if (jobId) form.append('job_id', jobId);
      try {
        const { data } = await apiClient.post<UploadResult>('/cv/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 });
        newResults.push({ file: file.name, result: data });
        setResults([...newResults]);
        if (data.status === 'processing') {
          pollCandidate(newResults.length - 1, data.candidate_id);
        }
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Upload failed';
        newResults.push({ file: file.name, error: msg });
        setResults([...newResults]);
      }
    }
    setUploading(false);
    setFiles([]);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold text-text-primary mb-1">CV Upload</h1>
      <p className="text-sm text-text-secondary mb-6">Upload CV files to scan, parse, and create candidates automatically.</p>

      {/* Job selector */}
      <select value={jobId} onChange={e => setJobId(e.target.value)} className="w-full mb-4 px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20">
        <option value="">No job (upload to talent pool)</option>
        {jobs?.map(j => <option key={j.id} value={j.id}>{j.title} — {j.location || 'N/A'}</option>)}
      </select>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-border-subtle'}`}
      >
        <Upload className="mx-auto mb-3 text-text-muted" size={32} />
        <p className="text-sm text-text-secondary mb-2">Drag & drop PDF or DOCX files here</p>
        <label className="inline-block px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-accent-hover">
          Choose files
          <input type="file" multiple accept=".pdf,.docx" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-bg-surface rounded-lg text-sm">
              <FileText size={14} className="text-accent" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-text-muted text-xs">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(i)} className="text-text-muted hover:text-red-500 text-xs">✕</button>
            </div>
          ))}
          <button onClick={upload} disabled={uploading} className="w-full mt-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading && <Loader2 size={14} className="animate-spin" />}
            {uploading ? 'Processing...' : `Upload & Scan ${files.length} file(s)`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Results</h2>
          {results.map((r, i) => (
            <div key={i} className={`p-4 rounded-lg border ${r.error ? 'border-red-200 bg-red-50' : r.result?.status === 'processing' ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {r.error ? <AlertCircle size={14} className="text-red-500" /> : r.result?.status === 'processing' ? <Clock size={14} className="text-yellow-600 animate-pulse" /> : <CheckCircle size={14} className="text-green-600" />}
                <span className="text-sm font-medium">{r.file}</span>
                {r.result?.status === 'processing' && <span className="text-xs text-yellow-700 ml-auto">AI đang phân tích...</span>}
              </div>
              {r.error && <p className="text-xs text-red-600">{r.error}</p>}
              {r.result && r.result.status !== 'processing' && (
                <div className="text-xs text-text-secondary space-y-0.5 mt-1">
                  <p>Candidate ID: {r.result.candidate_id.slice(0, 8)}… | Pages: {r.result.page_count} {r.result.is_scanned && '(OCR)'}</p>
                  <p>Name: {(r.result.structured_data?.name as string) || '—'} | Skills: {((r.result.structured_data?.skills as string[]) || []).slice(0, 5).join(', ')}</p>
                  {Object.keys(r.result.pii_detected).length > 0 && (
                    <p className="text-orange-600">🔒 PII masked: {Object.entries(r.result.pii_detected).map(([k, v]) => `${k}(${v})`).join(', ')}</p>
                  )}
                </div>
              )}
              {r.result && r.result.status === 'processing' && (
                <div className="text-xs text-text-secondary mt-1">
                  <p>Candidate ID: {r.result.candidate_id.slice(0, 8)}… | Pages: {r.result.page_count} {r.result.is_scanned && '(OCR)'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
