import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CreateIncidentModal } from './CreateIncidentModal';
import { CopyButton } from './CopyButton';

interface IncidentsListViewProps {
  onSelectIncident: (incidentId: string) => void;
  onSelectCase: (caseId: string) => void;
  userRole: string;
}

export const IncidentsListView: React.FC<IncidentsListViewProps> = ({
  onSelectIncident,
  onSelectCase,
  userRole,
}) => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canCreate = userRole === 'ADMIN' || userRole === 'INVESTIGATOR';

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getIncidents({
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        priority: priorityFilter || undefined,
        incidentType: typeFilter || undefined,
      });
      setIncidents(res.incidents || res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch incidents list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [page, statusFilter, severityFilter, priorityFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchIncidents();
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

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'text-rose-600 dark:text-rose-400 font-bold';
      case 'HIGH':
        return 'text-orange-600 dark:text-orange-400 font-medium';
      case 'MEDIUM':
        return 'text-amber-600 dark:text-amber-400';
      case 'LOW':
        return 'text-slate-500 dark:text-slate-400';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Security Incident Registry</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Detect, catalog, and mitigate cybersecurity incidents mapped to investigation dossiers.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Create Incident</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-xs transition-colors">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by incident number, title, or source..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <svg
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINED">Contained</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Incident Types</option>
            <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
            <option value="MALWARE">Malware Infection</option>
            <option value="PHISHING">Phishing Campaign</option>
            <option value="DATA_EXFILTRATION">Data Exfiltration</option>
            <option value="DENIAL_OF_SERVICE">Denial of Service</option>
            <option value="RANSOMWARE">Ransomware</option>
            <option value="POLICY_VIOLATION">Policy Violation</option>
            <option value="OTHER">Other</option>
          </select>

          {(search || statusFilter || severityFilter || priorityFilter || typeFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setSeverityFilter('');
                setPriorityFilter('');
                setTypeFilter('');
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-rose-600 dark:text-rose-400 text-xs font-medium">{error}</div>
            <button
              type="button"
              onClick={fetchIncidents}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
              🚨
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Incidents Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No security incident records match your active search filters.
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Create New Incident
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Incident #</th>
                  <th className="px-4 py-3">Title & Type</th>
                  <th className="px-4 py-3">Parent Case</th>
                  <th className="px-4 py-3">Severity & Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Detected At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectIncident(inc.id)}
                          className="text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                          title={`Open workspace for ${inc.incidentNumber}`}
                        >
                          {inc.incidentNumber}
                        </button>
                        <CopyButton text={inc.incidentNumber} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-200 font-medium truncate max-w-xs">{inc.title}</div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {inc.incidentType?.replace(/_/g, ' ')} • {inc.source}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {inc.case ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectCase(inc.case.id)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            {inc.case.caseNumber}
                          </button>
                          <CopyButton text={inc.case.caseNumber} />
                        </div>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-mono text-[11px] ${getSeverityBadge(inc.severity)}`}>
                        {inc.severity}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">P: {inc.priority}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getStatusBadge(
                          inc.status
                        )}`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {inc.detectedAt ? new Date(inc.detectedAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectIncident(inc.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-lg text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        Inspect Workspace →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Total: <span className="text-slate-900 dark:text-white font-mono font-medium">{totalCount}</span> incidents
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Incident Modal */}
      <CreateIncidentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onIncidentCreated={(newIncident) => {
          fetchIncidents();
          onSelectIncident(newIncident.id);
        }}
      />
    </div>
  );
};
