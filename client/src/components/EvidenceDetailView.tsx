import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CustodyActionModal } from './CustodyActionModal';
import { AIEvidenceModal } from './AIEvidenceModal';
import { CopyButton } from './CopyButton';

interface EvidenceDetailViewProps {
  evidenceId: string;
  onBack: () => void;
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

interface EvidenceDetailData {
  id: string;
  evidenceNumber: string;
  originalFilename: string;
  storedFilename?: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  evidenceType: string;
  source: string;
  description?: string;
  createdAt: string;
  case?: { id: string; caseNumber: string; title: string };
  incident?: { id: string; incidentNumber: string; title: string };
  uploadedBy?: { id: string; firstName?: string; lastName?: string; email: string };
}

interface EvidenceIntegrityData {
  evidenceId: string;
  storedHash: string;
  currentHash: string;
  integrity: 'VALID' | 'MISMATCH' | 'UNVERIFIED';
  verifiedAt?: string;
}

export const EvidenceDetailView: React.FC<EvidenceDetailViewProps> = ({
  evidenceId,
  onBack,
  onSelectCase,
  userRole,
}) => {
  const [evidence, setEvidence] = useState<EvidenceDetailData | null>(null);
  const [custodyEvents, setCustodyEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<any[]>([]);
  const [integrityData, setIntegrityData] = useState<EvidenceIntegrityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'overview' | 'custody' | 'ai' | 'audit'>('overview');

  // Modals state
  const [isCustodyModalOpen, setIsCustodyModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Verification state
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [integrityFeedback, setIntegrityFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Download state
  const [downloading, setDownloading] = useState(false);

  const fetchAllEvidenceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [evRes, custodyRes, auditRes, aiRes] = await Promise.allSettled([
        api.getEvidence(evidenceId),
        api.getEvidenceCustody(evidenceId),
        api.getEvidenceAudit(evidenceId),
        api.getEvidenceAI(evidenceId),
      ]);

      if (evRes.status === 'fulfilled') {
        const fetchedEvidence = evRes.value.evidence || evRes.value;
        setEvidence(fetchedEvidence);

        if (!integrityData) {
          setIntegrityData({
            evidenceId,
            storedHash: fetchedEvidence.sha256 || '',
            currentHash: '',
            integrity: 'UNVERIFIED',
          });
        }
      } else {
        throw new Error(evRes.reason?.message || 'Failed to load evidence details');
      }

      if (custodyRes.status === 'fulfilled') {
        setCustodyEvents(custodyRes.value.events || custodyRes.value || []);
      }

      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value.logs || auditRes.value || []);
      }

      if (aiRes.status === 'fulfilled') {
        setAiAnalyses(aiRes.value.analyses || aiRes.value || []);
      }
    } catch (err: any) {
      console.error('Error fetching evidence details:', err);
      setError(err.message || 'Failed to load evidence artifact details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (evidenceId) {
      fetchAllEvidenceData();
    }
  }, [evidenceId]);

  const handleDownload = async () => {
    if (!evidence) return;
    setDownloading(true);
    try {
      await api.downloadEvidence(evidenceId, evidence.originalFilename);
    } catch (err: any) {
      alert(err.message || 'Failed to download evidence artifact');
    } finally {
      setDownloading(false);
    }
  };

  const handleLiveIntegrityCheck = async () => {
    if (verifyingIntegrity) return;
    setVerifyingIntegrity(true);
    setIntegrityFeedback(null);
    try {
      const res = await api.verifyEvidenceIntegrity(evidenceId);
      const verifiedTimestamp = new Date().toISOString();
      const updatedIntegrity: EvidenceIntegrityData = {
        evidenceId: res.evidenceId,
        storedHash: res.storedHash || evidence?.sha256 || '',
        currentHash: res.currentHash || '',
        integrity: res.integrity,
        verifiedAt: verifiedTimestamp,
      };
      setIntegrityData(updatedIntegrity);

      if (res.integrity === 'VALID') {
        setIntegrityFeedback({
          type: 'success',
          message: 'Forensic integrity verified: Physical file SHA-256 matches stored checksum.',
        });
      } else {
        setIntegrityFeedback({
          type: 'warning',
          message: 'WARNING: SHA-256 hash mismatch! Physical file content does not match stored checksum.',
        });
      }

      try {
        const auditRes = await api.getEvidenceAudit(evidenceId);
        if (auditRes?.logs) {
          setAuditLogs(auditRes.logs);
        }
      } catch (auditErr) {
        console.warn('Failed to refresh audit log:', auditErr);
      }
    } catch (err: any) {
      setIntegrityFeedback({
        type: 'error',
        message: err.message || 'Failed to verify evidence checksum',
      });
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes && bytes !== 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors"
        >
          ← Back to Investigation
        </button>
        <div className="h-44 bg-slate-100 dark:bg-slate-800/80 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/80 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !evidence) {
    return (
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center space-y-4">
        <div className="text-rose-600 dark:text-rose-400 text-sm font-semibold">Error Loading Evidence</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Evidence artifact not found'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          Back to Investigation
        </button>
      </div>
    );
  }

  const integrityStatus: 'VALID' | 'MISMATCH' | 'UNVERIFIED' =
    integrityData?.integrity || 'UNVERIFIED';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Case Investigation
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Artifact */}
          {userRole?.toUpperCase() !== 'VIEWER' && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Download original evidence artifact"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloading ? 'Downloading...' : 'Download Artifact'}</span>
            </button>
          )}

          {/* Record Chain of Custody */}
          {userRole?.toUpperCase() !== 'VIEWER' && (
            <button
              type="button"
              onClick={() => setIsCustodyModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Record custody transfer, receive, seal, or release"
            >
              <span>⚖️</span>
              <span>Custody Event</span>
            </button>
          )}

          {/* Run AI Analysis */}
          {userRole?.toUpperCase() !== 'VIEWER' && (
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/80 dark:hover:bg-purple-900/80 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Run AI Forensic Analysis"
            >
              <span>✨</span>
              <span>AI Analysis</span>
            </button>
          )}

          {/* Live Integrity Verification */}
          <button
            type="button"
            onClick={handleLiveIntegrityCheck}
            disabled={verifyingIntegrity}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 border border-indigo-500 disabled:border-slate-300 dark:disabled:border-slate-700 text-xs rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
            title="Verify SHA-256 integrity against stored physical evidence file"
          >
            {verifyingIntegrity ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Verify SHA-256</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast / Alert Message for Integrity Verification */}
      {integrityFeedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            integrityFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : integrityFeedback.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              : 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">
              {integrityFeedback.type === 'success' ? '✓' : '⚠️'}
            </span>
            <span>{integrityFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setIntegrityFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1 cursor-pointer"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Evidence Header Card */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                  {evidence.evidenceNumber}
                </span>
                <CopyButton text={evidence.evidenceNumber} />
              </div>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {evidence.evidenceType}
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                Source: {evidence.source}
              </span>
              <span
                className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                  integrityStatus === 'VALID'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                    : integrityStatus === 'MISMATCH'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800 animate-pulse'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                Integrity: {integrityStatus}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{evidence.originalFilename}</h2>
            {evidence.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed">
                {evidence.description}
              </p>
            )}
          </div>

          {/* Quick Info Box */}
          <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60 min-w-[240px]">
            <div>
              <span className="text-slate-400 dark:text-slate-500">File Size: </span>
              <span className="text-slate-800 dark:text-slate-200">{formatFileSize(evidence.fileSize)}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">MIME Type: </span>
              <span className="text-slate-800 dark:text-slate-200">{evidence.mimeType}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Uploaded By: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {evidence.uploadedBy
                  ? `${evidence.uploadedBy.firstName || ''} ${evidence.uploadedBy.lastName || ''}`.trim() || evidence.uploadedBy.email
                  : 'System'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Ingested At: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {new Date(evidence.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic SHA-256 Box */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/90 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase shrink-0">
                SHA-256:
              </span>
              <span className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate select-all">
                {evidence.sha256}
              </span>
            </div>
            <CopyButton text={evidence.sha256} label="Copy Hash" />
          </div>
        </div>

        {/* Case & Incident Association Link */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 text-xs">
          {evidence.case && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Associated Case:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelectCase && onSelectCase(evidence.case!.id)}
                  className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-bold"
                >
                  {evidence.case.caseNumber} — {evidence.case.title}
                </button>
                <CopyButton text={evidence.case.caseNumber} />
              </div>
            </div>
          )}

          {evidence.incident && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Linked Incident:</span>
              <div className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-bold">
                <span>{evidence.incident.incidentNumber} — {evidence.incident.title}</span>
                <CopyButton text={evidence.incident.incidentNumber} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Integrity & Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('custody')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'custody'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Chain of Custody ({custodyEvents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'ai'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          AI Findings ({aiAnalyses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Audit History ({auditLogs.length})
        </button>
      </div>

      {/* Sub-Tab 1: Integrity & Overview Details */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Forensic Integrity Verification</span>
            {integrityData?.verifiedAt && (
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                Last Verified: {new Date(integrityData.verifiedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Stored Hash (Database)</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">SHA-256</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-emerald-600 dark:text-emerald-400 break-all select-all">
                  {integrityData?.storedHash || evidence.sha256}
                </span>
                <CopyButton text={integrityData?.storedHash || evidence.sha256} />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Calculated Hash (On-Disk Physical File)</span>
                {integrityData?.currentHash && (
                  <span
                    className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${
                      integrityStatus === 'VALID'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800'
                    }`}
                  >
                    {integrityStatus}
                  </span>
                )}
              </div>
              {integrityData?.currentHash ? (
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono break-all select-all ${
                      integrityStatus === 'VALID' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400 font-bold'
                    }`}
                  >
                    {integrityData.currentHash}
                  </span>
                  <CopyButton text={integrityData.currentHash} />
                </div>
              ) : (
                <span className="font-mono text-slate-500 dark:text-slate-400 italic">
                  Not computed yet — click &quot;⚡ Verify SHA-256&quot; above to calculate.
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400">
            <p>
              <strong className="text-slate-800 dark:text-slate-200">Forensic Guarantee:</strong> Digital evidence hashes are computed server-side prior to storage.
              Application-level immutability prohibits file modifications or unrecorded deletions.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Chain of Custody */}
      {activeTab === 'custody' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">Cryptographic Chain of Custody</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">
              {custodyEvents.length} Recorded Transfer/State Events
            </span>
          </div>

          {custodyEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No custody events recorded for this artifact.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {custodyEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold uppercase">{evt.eventType}</span>
                      <span className="text-slate-800 dark:text-slate-300">
                        by {evt.actorUser ? `${evt.actorUser.firstName || ''} ${evt.actorUser.lastName || ''}`.trim() || evt.actorUser.email : 'Unknown'}
                      </span>
                      {evt.isTamperEvident && (
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono">
                          TAMPER-EVIDENT
                        </span>
                      )}
                    </div>
                    {evt.reason && <p className="text-slate-600 dark:text-slate-400 mt-1 italic">"{evt.reason}"</p>}
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {evt.fromUser && `From: ${evt.fromUser.firstName || evt.fromUser.email} → `}
                      {evt.toUser && `To: ${evt.toUser.firstName || evt.toUser.email}`}
                    </div>
                  </div>
                  <div className="text-right sm:shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <div>{new Date(evt.eventAt || evt.createdAt).toLocaleString()}</div>
                    {evt.eventHash && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500" title={evt.eventHash}>
                        Hash: {evt.eventHash.substring(0, 10)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: AI Analysis */}
      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-lg p-3 text-xs text-purple-800 dark:text-purple-300">
            <span className="font-bold">⚠️ Advisory Notice:</span> All AI-generated findings are recommendations to assist human investigators.
            They do not constitute confirmed forensic facts without human verification.
          </div>

          {aiAnalyses.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No AI analyses performed for this artifact.</div>
          ) : (
            <div className="space-y-3">
              {aiAnalyses.map((ai, idx) => (
                <div key={ai.id || idx} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-700 dark:text-purple-400 font-bold uppercase">{ai.analysisType}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {ai.status}
                    </span>
                  </div>
                  {ai.summary && <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{ai.summary}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-mono">
                    <span>Model: {ai.provider} / {ai.model}</span>
                    {ai.inputHash && <span>Input Hash: {ai.inputHash.substring(0, 10)}...</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 4: Audit History */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">Immutable Audit Log</span>
            <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">{auditLogs.length} Actions Audited</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No audit records found.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {auditLogs.map((log, idx) => (
                <div key={log.id || idx} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-medium mr-2">{log.action}</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      by {log.actorUser ? `${log.actorUser.firstName || ''} ${log.actorUser.lastName || ''}`.trim() || log.actorUser.email : 'System'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] ${
                        log.result === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800'
                      }`}
                    >
                      {log.result}
                    </span>
                    <span className="text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custody Action Modal */}
      {evidence && (
        <CustodyActionModal
          isOpen={isCustodyModalOpen}
          onClose={() => setIsCustodyModalOpen(false)}
          evidenceId={evidenceId}
          evidenceNumber={evidence.evidenceNumber}
          userRole={userRole}
          onCustodyUpdated={() => fetchAllEvidenceData()}
        />
      )}

      {/* AI Analysis Modal */}
      {evidence && (
        <AIEvidenceModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          evidenceId={evidenceId}
          evidenceNumber={evidence.evidenceNumber}
          onAnalysisComplete={() => fetchAllEvidenceData()}
        />
      )}
    </div>
  );
};
