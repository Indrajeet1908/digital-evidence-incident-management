import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { CaseInvestigationSummaryResponse } from '../types/dashboard.types';
import { CaseStatusModal } from './CaseStatusModal';
import { CreateIncidentModal } from './CreateIncidentModal';
import { EvidenceUploadModal } from './EvidenceUploadModal';
import { CopyButton } from './CopyButton';

interface CaseInvestigationViewProps {
  caseId: string;
  onBack: () => void;
  onSelectEvidence?: (evidenceId: string) => void;
  onSelectIncident?: (incidentId: string) => void;
  userRole?: string;
}

export const CaseInvestigationView: React.FC<CaseInvestigationViewProps> = ({
  caseId,
  onBack,
  onSelectEvidence,
  onSelectIncident,
  userRole,
}) => {
  const [data, setData] = useState<CaseInvestigationSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'incidents' | 'evidence' | 'ai' | 'custody' | 'audit'>('incidents');

  // Modal controls
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isCreateIncidentOpen, setIsCreateIncidentOpen] = useState(false);
  const [isUploadEvidenceOpen, setIsUploadEvidenceOpen] = useState(false);

  const fetchCaseDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCaseInvestigationSummary(caseId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load case investigation summary:', err);
      setError(err.message || 'Failed to load case investigation details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchCaseDetails();
    }
  }, [caseId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors"
        >
          ← Back to Dashboard
        </button>
        <div className="h-44 bg-slate-100 dark:bg-slate-800/80 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/80 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center space-y-4">
        <div className="text-rose-600 dark:text-rose-400 text-sm font-semibold">Error Loading Case</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Case not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { case: c, incidentSummary, evidenceSummary, aiSummary, custodySummary, activitySummary } = data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getIntegrityBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800';
      case 'MISMATCH':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800';
      case 'UNVERIFIED':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Dashboard
      </button>

      {/* Case Header Card */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="inline-flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
                  {c.caseNumber}
                </span>
                <CopyButton text={c.caseNumber} />
              </div>
              <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getStatusBadge(c.status)}`}>
                {c.status}
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {c.priority} Priority
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {c.severity} Severity
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{c.title}</h2>
            {c.description && <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed">{c.description}</p>}
          </div>

          {/* Metadata Sidebar */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 min-w-[220px]">
            <div>
              <span className="text-slate-400 dark:text-slate-500">Lead: </span>
              <span className="text-slate-800 dark:text-slate-200">{c.leadInvestigator ? c.leadInvestigator.name : 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Created: </span>
              <span className="text-slate-800 dark:text-slate-200">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Members: </span>
              <span className="text-slate-800 dark:text-slate-200">{c.members.length} Investigators</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {c.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mr-1">Tags:</span>
            {c.tags.map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Controls for Case */}
        {userRole?.toUpperCase() !== 'VIEWER' && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>Change Status</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateIncidentOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Link Incident</span>
            </button>
            <button
              type="button"
              onClick={() => setIsUploadEvidenceOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span>+</span>
              <span>Upload Evidence</span>
            </button>
          </div>
        )}
      </div>

      {/* Investigation Metric Summary Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'incidents'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Incidents ({incidentSummary.total})
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'evidence'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Evidence ({evidenceSummary.total})
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'ai'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          AI Findings ({aiSummary.totalAnalyses})
        </button>
        <button
          onClick={() => setActiveTab('custody')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'custody'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Custody Trail ({custodySummary.recentEvents.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Audit History ({activitySummary.recentAuditEvents.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'incidents' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Linked Security Incidents</span>
            <div className="flex gap-2 font-mono text-[11px]">
              {Object.entries(incidentSummary.byStatus).map(([st, cnt]) => (
                <span key={st} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  {st}: {cnt}
                </span>
              ))}
            </div>
          </div>

          {incidentSummary.incidents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No security incidents linked to this case.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {incidentSummary.incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident && onSelectIncident(inc.id)}
                  className={`py-3 flex items-center justify-between text-xs transition-colors rounded px-2 -mx-2 ${
                    onSelectIncident ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer group' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-medium">
                      <span>{inc.incidentNumber}</span>
                      <CopyButton text={inc.incidentNumber} />
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 font-medium group-hover:text-slate-950 dark:group-hover:text-white">
                      {inc.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {inc.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      {inc.status}
                    </span>
                    {onSelectIncident && (
                      <span className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 text-[10px] ml-1">
                        →
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Linked Digital Evidence Artifacts</span>
            <div className="flex gap-2 font-mono text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{evidenceSummary.integrity.verified} Verified</span>
              <span>•</span>
              <span className={evidenceSummary.integrity.failures > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                {evidenceSummary.integrity.failures} Failures
              </span>
            </div>
          </div>

          {evidenceSummary.recentEvidence.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No evidence artifacts registered in this case.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {evidenceSummary.recentEvidence.map((ev) => (
                <div
                  key={ev.id}
                  className="py-2.5 px-2 -mx-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
                >
                  <div className="flex flex-wrap items-center text-left">
                    <div className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-bold mr-2">
                      <button
                        type="button"
                        onClick={() => onSelectEvidence && onSelectEvidence(ev.id)}
                        className="hover:underline cursor-pointer"
                        title={`View ${ev.evidenceNumber}`}
                      >
                        {ev.evidenceNumber}
                      </button>
                      <CopyButton text={ev.evidenceNumber} />
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white font-medium">
                      {ev.originalFilename}
                    </span>
                    <span className="ml-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                      ({ev.evidenceType})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pl-1 sm:pl-0">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400" title={ev.sha256}>
                      SHA: {ev.sha256.substring(0, 8)}...
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded border ${getIntegrityBadge(
                        ev.latestIntegrity
                      )}`}
                    >
                      {ev.latestIntegrity}
                    </span>
                    {onSelectEvidence && (
                      <button
                        type="button"
                        onClick={() => onSelectEvidence(ev.id)}
                        className="px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded transition-colors cursor-pointer"
                      >
                        Inspect →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-lg p-3 text-xs text-purple-800 dark:text-purple-300">
            <span className="font-bold">Advisory Notice:</span> AI findings are recommendations to assist human investigators.
          </div>

          {aiSummary.latestFindings.length === 0 && aiSummary.latestSummaries.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No AI analyses performed for this case.</div>
          ) : (
            <div className="space-y-4">
              {aiSummary.latestFindings.map((f, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{f.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                      {f.severity} • {(f.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">{f.description}</p>
                </div>
              ))}

              {aiSummary.latestSummaries.map((s) => (
                <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    <span>Analysis Type: {s.analysisType}</span>
                    {s.confidence !== null && <span>Confidence: {(s.confidence * 100).toFixed(0)}%</span>}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-xs">{s.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'custody' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Chain of Custody Events</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">Current: {custodySummary.currentCustodyState}</span>
          </div>

          {custodySummary.recentEvents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No custody events recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {custodySummary.recentEvents.map((evt) => (
                <div key={evt.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold mr-2 uppercase">{evt.eventType}</span>
                    <span className="text-slate-800 dark:text-slate-300">Actor: {evt.actor}</span>
                    {evt.fromUser && evt.toUser && (
                      <span className="text-slate-500 dark:text-slate-400 ml-2">
                        ({evt.fromUser} → {evt.toUser})
                      </span>
                    )}
                    {evt.reason && <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 italic">"{evt.reason}"</p>}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{new Date(evt.eventAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Evidence Audit Trail</div>
          {activitySummary.recentAuditEvents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No audit events recorded for this case.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {activitySummary.recentAuditEvents.map((ae) => (
                <div key={ae.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-2">{ae.action}</span>
                    <span className="text-slate-600 dark:text-slate-400">by {ae.actor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded border ${
                        ae.result === 'SUCCESS' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-transparent dark:border-emerald-800' : 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-transparent dark:border-rose-800'
                      }`}
                    >
                      {ae.result}
                    </span>
                    <span className="text-slate-500 dark:text-slate-500 text-[11px]">{new Date(ae.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Case Status Modal */}
      {c && (
        <CaseStatusModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          caseId={caseId}
          caseNumber={c.caseNumber}
          currentStatus={c.status}
          onStatusChanged={() => fetchCaseDetails()}
        />
      )}

      {/* Create Incident Modal */}
      <CreateIncidentModal
        isOpen={isCreateIncidentOpen}
        onClose={() => setIsCreateIncidentOpen(false)}
        defaultCaseId={caseId}
        onIncidentCreated={() => fetchCaseDetails()}
      />

      {/* Upload Evidence Modal */}
      <EvidenceUploadModal
        isOpen={isUploadEvidenceOpen}
        onClose={() => setIsUploadEvidenceOpen(false)}
        defaultCaseId={caseId}
        onEvidenceUploaded={() => fetchCaseDetails()}
      />
    </div>
  );
};
