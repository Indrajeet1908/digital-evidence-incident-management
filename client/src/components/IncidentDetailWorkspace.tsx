import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';
import { IncidentStatusModal } from './IncidentStatusModal';
import { CopyButton } from './CopyButton';

interface IncidentDetailWorkspaceProps {
  incidentId: string;
  onBack: () => void;
  onSelectCase: (caseId: string) => void;
  onSelectEvidence: (evidenceId: string) => void;
  onAddEvidence?: (caseId: string, incidentId: string) => void;
  userRole?: string;
}

export const IncidentDetailWorkspace: React.FC<IncidentDetailWorkspaceProps> = ({
  incidentId,
  onBack,
  onSelectCase,
  onSelectEvidence,
  onAddEvidence,
  userRole,
}) => {
  const toast = useToast();
  const [incident, setIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'ai' | 'statusHistory'>('overview');

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);

  // AI classify modal & state
  const [showAIModal, setShowAIModal] = useState(false);
  const [isClassifyingAI, setIsClassifyingAI] = useState(false);
  const [aiForce, setAiForce] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');

  const canEdit = userRole === 'ADMIN' || userRole === 'INVESTIGATOR';
  const canClassifyAI = canEdit;

  const fetchIncidentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getIncident(incidentId);
      setIncident(res.incident || res);
    } catch (err: any) {
      console.error('Failed to load incident record:', err);
      setError(err.message || 'Incident record not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (incidentId) {
      fetchIncidentData();
    }
  }, [incidentId]);

  const handleRunAIClassification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canClassifyAI) return;
    setIsClassifyingAI(true);
    try {
      const res = await api.classifyIncidentAI(incidentId, {
        force: aiForce,
        provider: aiProvider,
      });
      const providerLabel = res.analysis?.provider === 'openai' ? 'OpenAI GPT' : 'Google Gemini';
      toast.success(
        res.cached
          ? `Retrieved cached AI classification (${providerLabel})`
          : `AI Incident classification complete (${providerLabel})`
      );
      setShowAIModal(false);
      fetchIncidentData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate AI incident classification');
    } finally {
      setIsClassifyingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors"
        >
          ← Back to Incidents Directory
        </button>
        <div className="h-44 bg-slate-100 dark:bg-slate-800/80 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/80 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center space-y-4">
        <div className="text-rose-600 dark:text-rose-400 text-sm font-semibold">Incident Record Not Found</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Requested security incident record could not be loaded.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          Back to Incidents
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Incidents Directory
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {canClassifyAI && (
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              disabled={isClassifyingAI}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/80 dark:hover:bg-purple-900/80 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isClassifyingAI ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span>Classifying ({aiProvider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'})...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>AI Advisory Classify</span>
                </>
              )}
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowStatusModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Change Status
            </button>
          )}

          {canEdit && onAddEvidence && incident.case && (
            <button
              type="button"
              onClick={() => onAddEvidence(incident.case.id, incident.id)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>+</span>
              <span>Link Evidence</span>
            </button>
          )}
        </div>
      </div>

      {/* Incident Header Card */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  {incident.incidentNumber}
                </span>
                <CopyButton text={incident.incidentNumber} />
              </div>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {incident.incidentType}
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                Source: {incident.source}
              </span>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                {incident.status}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{incident.title}</h1>

            {incident.case && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Parent Case:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectCase(incident.case.id)}
                    className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-bold"
                  >
                    {incident.case.caseNumber} — {incident.case.title}
                  </button>
                  <CopyButton text={incident.case.caseNumber} />
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60 min-w-[220px]">
            <div>
              <span className="text-slate-400 dark:text-slate-500">Severity: </span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{incident.severity}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Priority: </span>
              <span className="text-slate-800 dark:text-slate-200">{incident.priority}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Detected: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {incident.detectedAt ? new Date(incident.detectedAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Assigned: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {incident.assignedTo
                  ? `${incident.assignedTo.firstName || ''} ${incident.assignedTo.lastName || ''}`.trim() ||
                    incident.assignedTo.email
                  : 'Unassigned'}
              </span>
            </div>
          </div>
        </div>

        {incident.description && (
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-200 dark:border-slate-700/60">
            {incident.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Incident Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'evidence'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Linked Evidence ({incident.evidence?.length || 0})
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
          AI Findings ({incident.aiAnalyses?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statusHistory')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'statusHistory'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Status History ({incident.statusHistory?.length || 0})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Occurred At</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">
                {incident.occurredAt ? new Date(incident.occurredAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Contained At</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">
                {incident.containedAt ? new Date(incident.containedAt).toLocaleString() : 'Pending Containment'}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Resolved At</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">
                {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'Pending Resolution'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Resolution Summary</span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {incident.resolution || 'No formal resolution has been recorded for this incident.'}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Linked Evidence */}
      {activeTab === 'evidence' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Evidence Artifacts Linked to this Incident</span>
            {canEdit && onAddEvidence && incident.case && (
              <button
                type="button"
                onClick={() => onAddEvidence(incident.case.id, incident.id)}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
              >
                + Link New Evidence
              </button>
            )}
          </div>

          {!incident.evidence || incident.evidence.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No evidence artifacts have been linked directly to this incident yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {incident.evidence.map((ev: any) => (
                <div
                  key={ev.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/20 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectEvidence(ev.id)}
                      className="font-mono text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      {ev.evidenceNumber}
                    </button>
                    <CopyButton text={ev.evidenceNumber} />
                    <span className="text-slate-800 dark:text-slate-200 ml-1 font-medium">{ev.originalFilename}</span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase ml-1">({ev.evidenceType})</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <span>SHA: {ev.sha256?.substring(0, 10)}...</span>
                    <button
                      type="button"
                      onClick={() => onSelectEvidence(ev.id)}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: AI Findings */}
      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 transition-colors">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-lg text-xs text-purple-800 dark:text-purple-300">
            <span className="font-bold">⚠️ Advisory Notice:</span> All AI-generated incident classifications and
            indicators are recommendations to assist human investigators. They do NOT automatically alter database
            severity or status without human approval.
          </div>

          {!incident.aiAnalyses || incident.aiAnalyses.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No AI analysis has been run for this incident yet.{' '}
              {canClassifyAI && 'Click "AI Advisory Classify" above to initiate a run.'}
            </div>
          ) : (
            <div className="space-y-3">
              {incident.aiAnalyses.map((ai: any) => (
                <div key={ai.id} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-700 dark:text-purple-400 font-bold uppercase">{ai.analysisType}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {ai.status}
                    </span>
                  </div>
                  {ai.summary && <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{ai.summary}</p>}
                  {ai.result?.classification && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 font-mono">
                      Suggested Classification: <strong>{String(ai.result.classification)}</strong>
                    </div>
                  )}
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

      {/* Tab 4: Status Lifecycle History */}
      {activeTab === 'statusHistory' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 transition-colors">
          <div className="text-xs font-semibold text-slate-900 dark:text-white">Immutable Status Audit Trail</div>
          {!incident.statusHistory || incident.statusHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No status transitions recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {incident.statusHistory.map((sh: any) => (
                <div key={sh.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 dark:text-slate-400">{sh.previousStatus || 'INIT'}</span>
                      <span className="text-indigo-600 dark:text-indigo-400">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{sh.newStatus}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(sh.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {sh.reason && <p className="text-slate-700 dark:text-slate-300 italic">"{sh.reason}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Modal */}
      <IncidentStatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        incidentId={incident.id}
        incidentNumber={incident.incidentNumber}
        currentStatus={incident.status}
        onStatusChanged={() => fetchIncidentData()}
      />

      {/* Incident AI Classification Modal */}
      {showAIModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Advisory Incident AI Classification</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 text-xs">{incident.incidentNumber}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Request AI-generated classification assessment across incident artifacts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Advisory Disclaimer */}
            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-lg p-3 text-purple-800 dark:text-purple-300 text-xs flex items-start gap-2.5">
              <span className="text-sm">⚠️</span>
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold">Advisory Assistance Notice:</span> Generated recommendations assist human investigators and will NOT automatically modify stored incident severity, priority, or lifecycle status.
              </div>
            </div>

            <form onSubmit={handleRunAIClassification} className="space-y-4 text-xs">
              {/* AI Provider Selector */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Select AI Provider</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      aiProvider === 'gemini'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-900 dark:text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="incidentAiProvider"
                      value="gemini"
                      checked={aiProvider === 'gemini'}
                      onChange={() => setAiProvider('gemini')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">Google Gemini</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Gemini 1.5 Flash (Default)</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      aiProvider === 'openai'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="incidentAiProvider"
                      value="openai"
                      checked={aiProvider === 'openai'}
                      onChange={() => setAiProvider('openai')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">OpenAI GPT</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">GPT-4o Mini</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Force Fresh Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceIncidentClassification"
                  checked={aiForce}
                  onChange={(e) => setAiForce(e.target.checked)}
                  className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="forceIncidentClassification" className="text-slate-700 dark:text-slate-300 text-xs cursor-pointer select-none">
                  Force fresh analysis (bypass cached result for {aiProvider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'})
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAIModal(false)}
                  disabled={isClassifyingAI}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassifyingAI}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isClassifyingAI ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Classifying with {aiProvider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'}...</span>
                    </>
                  ) : (
                    <span>Execute Classification ({aiProvider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'})</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
