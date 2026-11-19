import React, { useState, useEffect } from 'react';
import type { IncidentIntelligenceItem } from '../types/dashboard.types';
import { api } from '../services/api';
import { CopyButton } from './CopyButton';

interface IncidentIntelligenceTableProps {
  onSelectCase: (caseId: string) => void;
}

export const IncidentIntelligenceTable: React.FC<IncidentIntelligenceTableProps> = ({ onSelectCase }) => {
  const [incidents, setIncidents] = useState<IncidentIntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const data = await api.getIncidentIntelligence({
        page,
        limit: 10,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setIncidents(data.items);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch incident intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [page, severityFilter, statusFilter, priorityFilter]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800';
      case 'INVESTIGATING':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800';
      case 'CONTAINED':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800';
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:border dark:border-amber-800 dark:text-amber-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Incident Intelligence</h3>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Statuses</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="CONTAINED">Contained</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Priorities</option>
              <option value="CRITICAL">P0</option>
              <option value="HIGH">P1</option>
              <option value="MEDIUM">P2</option>
              <option value="LOW">P3</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-900/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No incident records match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[580px]">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2">Incident</th>
                  <th className="px-3 py-2">Case Context</th>
                  <th className="px-2 py-2">Severity</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Investigator</th>
                  <th className="px-2 py-2 text-center">Evd</th>
                  <th className="px-3 py-2">AI Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 font-mono font-medium text-amber-600 dark:text-amber-400">
                        <span>{inc.incidentNumber}</span>
                        <CopyButton text={inc.incidentNumber} />
                      </div>
                      <div className="truncate max-w-[160px] text-slate-800 dark:text-slate-300 mt-0.5" title={inc.title}>
                        {inc.title}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectCase(inc.case.id)}
                          className="text-left font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {inc.case.caseNumber}
                        </button>
                        <CopyButton text={inc.case.caseNumber} />
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate block max-w-[130px]" title={inc.case.title}>
                        {inc.case.title}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${getSeverityBadge(
                          inc.severity
                        )}`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded border ${getStatusBadge(
                          inc.status
                        )}`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[110px]" title={inc.assignedInvestigator?.name || 'Unassigned'}>
                      {inc.assignedInvestigator ? inc.assignedInvestigator.name : <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded-full font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px]">
                        {inc.evidenceCount}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {inc.latestAIClassification ? (
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                            {inc.latestAIClassification.classification} ({(inc.latestAIClassification.confidence * 100).toFixed(0)}%)
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]" title={inc.latestAIClassification.summary}>
                            {inc.latestAIClassification.summary}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
