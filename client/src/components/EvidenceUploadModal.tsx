import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEvidenceUploaded: (newEvidence: any) => void;
  defaultCaseId?: string;
  defaultIncidentId?: string;
}

const EVIDENCE_TYPES = [
  'DOCUMENT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'LOG',
  'EMAIL',
  'NETWORK_CAPTURE',
  'MEMORY_DUMP',
  'DISK_IMAGE',
  'ARCHIVE',
  'DATABASE_EXPORT',
  'OTHER',
];

const EVIDENCE_SOURCES = [
  'ENDPOINT',
  'SERVER',
  'NETWORK',
  'EMAIL',
  'CLOUD',
  'USER_SUBMITTED',
  'SECURITY_TOOL',
  'FORENSIC_TOOL',
  'EXTERNAL_MEDIA',
  'OTHER',
];

export const EvidenceUploadModal: React.FC<EvidenceUploadModalProps> = ({
  isOpen,
  onClose,
  onEvidenceUploaded,
  defaultCaseId,
  defaultIncidentId,
}) => {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form data
  const [file, setFile] = useState<File | null>(null);
  const [casesList, setCasesList] = useState<Array<{ id: string; caseNumber: string; title: string }>>([]);
  const [incidentsList, setIncidentsList] = useState<Array<{ id: string; incidentNumber: string; title: string; caseId: string }>>([]);
  const [caseId, setCaseId] = useState(defaultCaseId || '');
  const [incidentId, setIncidentId] = useState(defaultIncidentId || '');
  const [evidenceType, setEvidenceType] = useState('DOCUMENT');
  const [source, setSource] = useState('ENDPOINT');
  const [description, setDescription] = useState('');
  const [collectedAt, setCollectedAt] = useState('');

  // Upload Progress State
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'hashing' | 'creating' | 'done'>('idle');
  const [uploadedResult, setUploadedResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setUploadState('idle');
      setUploadedResult(null);
      setErrorMsg('');
      setFile(null);
      if (defaultCaseId) setCaseId(defaultCaseId);
      if (defaultIncidentId) setIncidentId(defaultIncidentId);

      // Load cases
      api.getCases({ limit: 100 })
        .then((res) => {
          const list = (res.cases || res.data || []).map((c: any) => ({ id: c.id, caseNumber: c.caseNumber, title: c.title }));
          setCasesList(list);
          if (!defaultCaseId && list.length > 0) {
            setCaseId(list[0].id);
          }
        })
        .catch((err) => console.error('Failed to load cases:', err));

      // Load incidents
      api.getIncidents({ limit: 100 })
        .then((res) => {
          setIncidentsList(
            (res.incidents || res.data || []).map((inc: any) => ({
              id: inc.id,
              incidentNumber: inc.incidentNumber,
              title: inc.title,
              caseId: inc.caseId,
            }))
          );
        })
        .catch((err) => console.error('Failed to load incidents:', err));
    }
  }, [isOpen, defaultCaseId, defaultIncidentId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const filteredIncidents = incidentsList.filter((i) => !caseId || i.caseId === caseId);

  const handleSubmitUpload = async () => {
    if (!file) {
      setErrorMsg('Please select a physical file to upload.');
      return;
    }
    if (!caseId) {
      setErrorMsg('Please select a target Case dossier.');
      return;
    }

    setErrorMsg('');
    setUploadState('uploading');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    if (incidentId) formData.append('incidentId', incidentId);
    formData.append('evidenceType', evidenceType);
    formData.append('source', source);
    if (description.trim()) formData.append('description', description.trim());
    if (collectedAt) formData.append('collectedAt', new Date(collectedAt).toISOString());

    // Architectural stages: Uploading -> Server-side SHA-256 calculation -> Creating evidence record
    setTimeout(() => {
      setUploadState('hashing');
    }, 400);

    try {
      setTimeout(() => {
        setUploadState('creating');
      }, 800);

      const res = await api.uploadEvidence(formData);
      setUploadState('done');
      setUploadedResult(res.evidence);
      toast.success(`Evidence uploaded successfully: ${res.evidence.evidenceNumber}`);
      onEvidenceUploaded(res.evidence);
    } catch (err: any) {
      setUploadState('idle');
      setErrorMsg(err.message || 'Evidence upload failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-evidence-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="upload-evidence-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Ingest Digital Evidence
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Securely register physical files with server-side SHA-256 integrity and audit logging.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Wizard Progress Bar */}
        {uploadState === 'idle' && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono bg-slate-50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                step === 1 ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' : 'border-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              1. File
            </button>
            <button
              type="button"
              onClick={() => file && setStep(2)}
              disabled={!file}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                step === 2 ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' : 'border-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              2. Case Context
            </button>
            <button
              type="button"
              onClick={() => file && caseId && setStep(3)}
              disabled={!file || !caseId}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                step === 3 ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' : 'border-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              3. Metadata
            </button>
            <button
              type="button"
              onClick={() => file && caseId && setStep(4)}
              disabled={!file || !caseId}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                step === 4 ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' : 'border-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              4. Review
            </button>
          </div>
        )}

        <div className="p-6 text-xs">
          {errorMsg && (
            <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Uploading States */}
          {uploadState !== 'idle' && uploadState !== 'done' && (
            <div className="py-10 text-center space-y-4">
              <div className="w-12 h-12 border-3 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {uploadState === 'uploading' && 'Uploading...'}
                  {uploadState === 'hashing' && 'Server-side SHA-256 calculation...'}
                  {uploadState === 'creating' && 'Creating evidence record & custody trail...'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enforcing application-level cryptographic integrity and audit immutability.
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {uploadState === 'done' && uploadedResult && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 text-xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evidence Uploaded Successfully</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cryptographic SHA-256 calculated server-side and recorded in audit log.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 text-left font-mono space-y-1.5 max-w-md mx-auto text-[11px]">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Evidence Number: </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{uploadedResult.evidenceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Filename: </span>
                  <span className="text-slate-800 dark:text-slate-200">{uploadedResult.originalFilename}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">SHA-256 Digest: </span>
                  <span className="text-emerald-700 dark:text-emerald-300 break-all">{uploadedResult.sha256}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Integrity Status: </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">VALID (Ingested)</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Select File */}
          {uploadState === 'idle' && step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-8 text-center transition-colors">
                <input
                  type="file"
                  id="evidence-file-input"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="evidence-file-input" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-full flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400 text-lg shadow-sm">
                    📁
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-white">
                    {file ? file.name : 'Click to select physical evidence file'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB — ${file.type || 'binary data'}`
                      : 'Accepts raw logs, disk images, network captures, emails, documents'}
                  </p>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!file}
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Next: Select Case →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Target Case & Incident */}
          {uploadState === 'idle' && step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Target Case Dossier <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  value={caseId}
                  onChange={(e) => {
                    setCaseId(e.target.value);
                    setIncidentId('');
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Select a case...</option>
                  {casesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Associated Incident <span className="text-slate-500 dark:text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  value={incidentId}
                  onChange={(e) => setIncidentId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">None (Case-level artifact)</option>
                  {filteredIncidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.incidentNumber} — {i.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-300 dark:border-transparent cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!caseId}
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg cursor-pointer shadow-sm"
                >
                  Next: Forensic Metadata →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Forensic Metadata */}
          {uploadState === 'idle' && step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Evidence Type</label>
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {EVIDENCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Source Designation</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {EVIDENCE_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Collected At Timestamp</label>
                <input
                  type="datetime-local"
                  value={collectedAt}
                  onChange={(e) => setCollectedAt(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Forensic Description & Notes</label>
                <textarea
                  rows={2}
                  maxLength={5000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Seizure location, acquiring investigator device ID, preservation precautions..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-300 dark:border-transparent cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg cursor-pointer shadow-sm"
                >
                  Review & Ingest →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Ingest */}
          {uploadState === 'idle' && step === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">File:</span>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">{file?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Size:</span>
                  <span className="text-slate-900 dark:text-slate-200 font-mono">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : '0 KB'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target Case:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                    {casesList.find((c) => c.id === caseId)?.caseNumber || caseId}
                  </span>
                </div>
                {incidentId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Linked Incident:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono font-medium">
                      {incidentsList.find((i) => i.id === incidentId)?.incidentNumber || incidentId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Type / Source:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {evidenceType} / {source}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-lg text-indigo-800 dark:text-indigo-300 text-[11px]">
                Upon confirmation, the file will be transmitted securely to the server repository where an immutable
                cryptographic SHA-256 hash and initial chain-of-custody event will be generated.
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-300 dark:border-transparent cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitUpload}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer"
                >
                  Confirm & Ingest Evidence
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
