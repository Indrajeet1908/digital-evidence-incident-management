import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CreateCaseModal } from './CreateCaseModal';
import { CopyButton } from './CopyButton';

interface CasesListViewProps {
  onSelectCase: (caseId: string) => void;
  userRole: string;
}

export const CasesListView: React.FC<CasesListViewProps> = ({
  onSelectCase,
  userRole,
}) => {
  const [cases, setCases] = useState<any[]>([]);
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

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCases({
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        priority: priorityFilter || undefined,
        caseType: typeFilter || undefined,
      });
      setCases(res.cases || res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cases list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [page, statusFilter, severityFilter, priorityFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCases();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'ON_HOLD':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800';
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Case Management Workspace</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse, manage, and coordinate digital forensics and incident investigation dossiers.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Create Case</span>
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
              placeholder="Search by case number, title, tags, or description..."
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
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
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
            <option value="">All Case Types</option>
            <option value="CYBERSECURITY_INCIDENT">Cyber Incident</option>
            <option value="DIGITAL_FORENSICS">Digital Forensics</option>
            <option value="DATA_BREACH">Data Breach</option>
            <option value="MALWARE">Malware</option>
            <option value="PHISHING">Phishing</option>
            <option value="INSIDER_THREAT">Insider Threat</option>
            <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
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
              onClick={fetchCases}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
              📁
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Cases Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No investigation dossiers match your current filter parameters.
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Create New Case
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Case Number</th>
                  <th className="px-4 py-3">Title & Classification</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Severity & Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Lead Investigator</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c.id)}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          title={`Open workspace for ${c.caseNumber}`}
                        >
                          {c.caseNumber}
                        </button>
                        <CopyButton text={c.caseNumber} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-200 font-medium truncate max-w-xs">{c.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{c.confidentiality}</span>
                        {c.tags && c.tags.length > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">
                            #{c.tags[0]} {c.tags.length > 1 && `+${c.tags.length - 1}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      {c.caseType?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-mono text-[11px] ${getSeverityBadge(c.severity)}`}>
                        {c.severity}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">P: {c.priority}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getStatusBadge(
                          c.status
                        )}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {c.leadInvestigator
                        ? `${c.leadInvestigator.firstName || ''} ${c.leadInvestigator.lastName || ''}`.trim() ||
                          c.leadInvestigator.email
                        : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCase(c.id)}
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
              Total: <span className="text-slate-900 dark:text-white font-mono font-medium">{totalCount}</span> cases
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

      {/* Create Case Modal */}
      <CreateCaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCaseCreated={(newCase) => {
          fetchCases();
          onSelectCase(newCase.id);
        }}
      />
    </div>
  );
};
