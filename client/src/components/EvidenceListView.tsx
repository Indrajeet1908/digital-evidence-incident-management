import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CopyButton } from './CopyButton';

interface EvidenceListViewProps {
  onSelectEvidence: (evidenceId: string) => void;
  onOpenUploadModal: () => void;
  userRole: string;
}

export const EvidenceListView: React.FC<EvidenceListViewProps> = ({
  onSelectEvidence,
  onOpenUploadModal,
  userRole,
}) => {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const canUpload = userRole === 'ADMIN' || userRole === 'INVESTIGATOR';

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEvidenceList({
        page,
        limit: 10,
        search: search.trim() || undefined,
        evidenceType: evidenceTypeFilter || undefined,
        source: sourceFilter || undefined,
      });
      setEvidenceList(res.evidence || res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch evidence list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, [page, evidenceTypeFilter, sourceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvidence();
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes && bytes !== 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Digital Evidence Registry</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Forensic repository for digital artifacts, SHA-256 integrity verifications, and chain of custody tracking.
          </p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Upload Evidence</span>
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
              placeholder="Search by evidence number, filename, or description..."
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
            value={evidenceTypeFilter}
            onChange={(e) => {
              setEvidenceTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Evidence Types</option>
            <option value="DOCUMENT">Document</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
            <option value="AUDIO">Audio</option>
            <option value="LOG">Log File</option>
            <option value="EMAIL">Email</option>
            <option value="NETWORK_CAPTURE">Network PCAP</option>
            <option value="MEMORY_DUMP">Memory Dump</option>
            <option value="DISK_IMAGE">Disk Image</option>
            <option value="ARCHIVE">Archive</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Sources</option>
            <option value="ENDPOINT">Endpoint</option>
            <option value="SERVER">Server</option>
            <option value="NETWORK">Network</option>
            <option value="EMAIL">Email</option>
            <option value="CLOUD">Cloud</option>
            <option value="USER_SUBMITTED">User Submitted</option>
            <option value="SECURITY_TOOL">Security Tool</option>
            <option value="OTHER">Other</option>
          </select>

          {(search || evidenceTypeFilter || sourceFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setEvidenceTypeFilter('');
                setSourceFilter('');
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
              onClick={fetchEvidence}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
              📦
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Evidence Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No digital evidence artifacts match your search parameters.
              </p>
            </div>
            {canUpload && (
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Upload First Evidence Artifact
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Evidence #</th>
                  <th className="py-3 px-4">Original Filename</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Case</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {evidenceList.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvidence(ev.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-mono text-indigo-600 dark:text-indigo-400 font-semibold group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors">
                        <span>{ev.evidenceNumber}</span>
                        <CopyButton text={ev.evidenceNumber} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-xs" title={ev.originalFilename}>
                        {ev.originalFilename}
                      </div>
                      {ev.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {ev.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                        {ev.evidenceType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{ev.source}</span>
                    </td>
                    <td className="py-3 px-4">
                      {ev.case ? (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          <span>{ev.case.caseNumber}</span>
                          <CopyButton text={ev.case.caseNumber} />
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {formatFileSize(ev.fileSize)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(ev.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 font-medium text-xs flex items-center justify-end gap-1">
                        <span>Inspect</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Total: <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span> artifacts • Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
