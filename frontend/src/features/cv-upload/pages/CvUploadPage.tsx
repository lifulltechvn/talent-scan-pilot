import { useCallback, useEffect, useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw, UserPlus, SkipForward, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/data/api/client';
import { startBatchTracking } from '@/shared/batch-store';
import { useI18n } from '@/shared/i18n';

interface BatchItem {
  id: string;
  file_name: string;
  status: string;
  candidate_id: string | null;
  candidate_name: string | null;
  duplicate_of: string | null;
  duplicate_name: string | null;
  duplicate_reason: string | null;
  duplicate_details: {
    match_field?: string;
    match_value?: string;
    existing_status?: string;
    new_skills_added?: string[];
    skills_removed?: string[];
    new_experience_count?: number;
    old_experience_count?: number;
  } | null;
  duplicate_status: string | null;
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
  const { t } = useI18n();
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
      } else if (data && data.status === 'done' && data.items?.some((i: any) => i.status === 'duplicate')) {
        // Show completed batch only if has unresolved duplicates
        setBatch(data);
      }
    }).catch(() => {});
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const all = Array.from(files);
    const valid = all.filter(f => /\.(pdf|docx)$/i.test(f.name));
    const skipped = all.length - valid.length;
    if (skipped > 0) {
      setError(t('filesSkipped').replace('{count}', String(skipped)));
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
      setError(e.response?.data?.detail || t('uploadFailed'));
      setUploading(false);
    }
  };

  const pollBatch = (batchId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/cv/batch/${batchId}`);
        setBatch(data);
        // Only stop polling when batch is done AND no items are still pending
        const allDone = data.status === 'done' && data.items.every((i: BatchItem) => i.status !== 'pending');
        if (allDone) clearInterval(interval);
      } catch { /* ignore */ }
    }, 3000);
    apiClient.get(`/cv/batch/${batchId}`).then(({ data }) => setBatch(data)).catch(() => {});
  };

  const handleResolve = async (itemId: string, action: string) => {
    if (!batch) return;
    try {
      await apiClient.post(`/cv/batch/${batch.batch_id}/items/${itemId}/resolve?action=${action}`);
      const { data } = await apiClient.get(`/cv/batch/${batch.batch_id}`);
      setBatch(data);
    } catch (e: any) {
      console.error('Resolve failed:', e?.response?.data || e);
    }
  };

  const handleResolveAll = async (action: string) => {
    if (!batch) return;
    try {
      await apiClient.post(`/cv/batch/${batch.batch_id}/resolve-all?action=${action}`);
      const { data } = await apiClient.get(`/cv/batch/${batch.batch_id}`);
      setBatch(data);
    } catch (e: any) {
      console.error('Resolve all failed:', e?.response?.data || e);
    }
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
      <h1 className="text-xl font-semibold text-text-primary mb-1">{t('cvUploadTitle')}</h1>
      <p className="text-sm text-text-secondary mb-6">{t('cvUploadSubtitle')}</p>

      {/* Drop zone */}
      {!uploading && !batch && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-border-subtle'}`}
        >
          <Upload className="mx-auto mb-3 text-text-muted" size={32} />
          <p className="text-sm text-text-secondary mb-2">{t('dragDropText')}</p>
          <p className="text-xs text-text-muted mb-3">{t('fileConstraints')}</p>
          <label className="inline-block px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-accent-hover">
            {t('selectFiles')}
            <input type="file" multiple accept=".pdf,.docx" className="hidden" onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      )}

      {/* Uploading to server */}
      {uploading && (
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-6 text-center">
          <Loader2 className="mx-auto mb-3 text-accent animate-spin" size={32} />
          <p className="text-sm font-medium text-text-primary">{t('uploadingToServer')}</p>
          <p className="text-xs text-text-muted mt-1">{t('doNotCloseTab')}</p>
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
                {batch.status === 'done' && processing.length === 0 ? t('processingComplete') : t('processing')}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{t('filesProgress').replace('{processed}', String(batch.processed)).replace('{total}', String(batch.total_files))}</span>
                {batch.status === 'done' && processing.length === 0 && (
                  <button onClick={() => setBatch(null)} className="text-xs text-text-muted hover:text-text-primary">{t('closeBtn')}</button>
                )}
              </div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${batch.status === 'done' && processing.length === 0 ? 'bg-emerald-500' : 'bg-accent'}`}
                style={{ width: `${Math.round((batch.processed / batch.total_files) * 100)}%` }}
              />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-600">{done.length}</div>
              <div className="text-[10px] text-text-muted">{t('successCount')}</div>
            </div>
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-600">{duplicates.length}</div>
              <div className="text-[10px] text-text-muted">{t('duplicateCount')}</div>
            </div>
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-600">{errors.length}</div>
              <div className="text-[10px] text-text-muted">{t('errorCount')}</div>
            </div>
            <div className="bg-bg-panel border border-border-subtle rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{processing.length}</div>
              <div className="text-[10px] text-text-muted">{t('processingCount')}</div>
            </div>
          </div>

          {/* Currently processing files */}
          {processing.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xs font-medium text-blue-800 mb-2">{t('currentlyProcessing').replace('{count}', String(processing.length))}</h3>
              <div className="space-y-1.5">
                {processing.slice(0, 5).map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin shrink-0" />
                    <span className="text-[11px] text-blue-800 truncate">{item.file_name}</span>
                  </div>
                ))}
                {processing.length > 5 && (
                  <div className="text-[10px] text-blue-600">{t('moreInQueue').replace('{count}', String(processing.length - 5))}</div>
                )}
              </div>
              {/* Processing steps animation */}
              <div className="mt-3 flex items-center gap-1 text-[10px] text-blue-600">
                <span className="font-medium">{t('steps')}:</span>
                {['Extract', 'PII Filter', 'AI Parse', 'Embed'].map((step, i) => (
                  <span key={step} className={`px-1.5 py-0.5 rounded ${i <= Math.floor(Date.now() / 2000) % 4 ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-400'}`}>{step}</span>
                ))}
              </div>
            </div>
          )}

          {/* Duplicates section */}
          {duplicates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggle('duplicates')}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <span className="text-[13px] font-medium text-amber-800">{t('duplicateCvs').replace('{count}', String(duplicates.length))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); handleResolveAll('update_all'); }} className="text-[10px] px-2 py-1 bg-accent text-white rounded-md hover:bg-accent-hover">
                      {t('updateAll')}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleResolveAll('create_all'); }} className="text-[10px] px-2 py-1 bg-white border border-amber-300 text-amber-800 rounded-md hover:bg-amber-100">
                      {t('createAll')}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleResolveAll('skip_all'); }} className="text-[10px] px-2 py-1 text-amber-700 hover:text-amber-900">
                      {t('skipAll')}
                    </button>
                  </div>
                  {expandedSection === 'duplicates' ? <ChevronUp size={14} className="text-amber-600" /> : <ChevronDown size={14} className="text-amber-600" />}
                </div>
              </div>
              {expandedSection === 'duplicates' && (
                <div className="px-4 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {duplicates.map(item => (
                    <div key={item.id} className="p-2.5 bg-white rounded-lg border border-amber-100">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium text-text-primary truncate">{item.file_name}</div>
                          <div className="text-[10px] text-text-muted">
                            {item.duplicate_reason === 'blacklisted' && <span className="text-red-600 font-medium">🚫 Ứng viên đã bị Blacklist: </span>}
                            {item.duplicate_reason === 'hash_match' && t('hashMatch')}
                            {item.duplicate_reason === 'email_match' && t('emailMatch')}
                            {item.duplicate_reason === 'phone_match' && t('phoneMatch')}
                            {!item.duplicate_reason && t('duplicateWith')}
                            <span className="font-medium">{item.duplicate_name}</span>
                            {item.duplicate_status && item.duplicate_reason !== 'blacklisted' && <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${item.duplicate_status === 'rejected' ? 'bg-red-100 text-red-700' : item.duplicate_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{item.duplicate_status}</span>}
                            {item.duplicate_of && <Link to={`/candidates/${item.duplicate_of}`} className="text-accent ml-1 hover:underline">{t('view')}</Link>}
                          </div>
                          {item.duplicate_details && (
                            <div className="mt-1 space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {item.duplicate_details.days_since_original > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                                    {item.duplicate_details.days_since_original >= 365 ? t('yearsAgo').replace('{count}', String(Math.floor(item.duplicate_details.days_since_original / 365))) : item.duplicate_details.days_since_original >= 30 ? t('monthsAgo').replace('{count}', String(Math.floor(item.duplicate_details.days_since_original / 30))) : t('daysAgo').replace('{count}', String(item.duplicate_details.days_since_original))}
                                  </span>
                                )}
                                {item.duplicate_details.new_skills_added && item.duplicate_details.new_skills_added.length > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">{t('newSkillsAdded').replace('{count}', String(item.duplicate_details.new_skills_added.length))}</span>
                                )}
                                {item.duplicate_details.new_experience_count != null && item.duplicate_details.old_experience_count != null && item.duplicate_details.new_experience_count > item.duplicate_details.old_experience_count && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{t('newExperience').replace('{count}', String(item.duplicate_details.new_experience_count - item.duplicate_details.old_experience_count))}</span>
                                )}
                                {item.duplicate_details.existing_status === 'rejected' && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">{t('previouslyRejected')}</span>
                                )}
                              </div>
                              {item.duplicate_details.recommendation_reason && (
                                <div className={`text-[10px] px-2 py-1 rounded ${item.duplicate_details.recommendation === 'update' ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-text-muted'}`}>
                                  💡 {item.duplicate_details.recommendation_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <button onClick={() => handleResolve(item.id, 'update')} className="p-1.5 text-accent hover:bg-accent/10 rounded-md" title={t('updateCvTooltip')}>
                            <RefreshCw size={13} />
                          </button>
                          <button onClick={() => handleResolve(item.id, 'create_new')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title={t('createNewTooltip')}>
                            <UserPlus size={13} />
                          </button>
                          <button onClick={() => handleResolve(item.id, 'skip')} className="p-1.5 text-text-muted hover:bg-gray-100 rounded-md" title={t('skipTooltip')}>
                            <SkipForward size={13} />
                          </button>
                        </div>
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
                  <span className="text-[13px] font-medium text-red-800">{t('errorsSection').replace('{count}', String(errors.length))}</span>
                </div>
                {expandedSection === 'errors' ? <ChevronUp size={14} className="text-red-600" /> : <ChevronDown size={14} className="text-red-600" />}
              </div>
              {expandedSection === 'errors' && (
                <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {errors.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-red-100">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-text-primary truncate">{item.file_name}</div>
                        <div className="text-[10px] text-red-600">{item.error || t('cannotProcessFile')}</div>
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
                  <span className="text-[13px] font-medium text-emerald-800">{t('successSection').replace('{count}', String(done.length))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/candidates" className="text-[11px] text-emerald-700 hover:underline flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    {t('viewList')} <ExternalLink size={10} />
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
                          {t('view')}
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
            <button onClick={() => { setBatch(null); setError(''); }} className="w-full py-3 text-sm font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/5 transition-colors">
              {t('uploadMoreCv')}
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

      <p className="mt-6 text-xs text-text-muted">
        {t('uploadHint')}
      </p>
    </div>
  );
}
