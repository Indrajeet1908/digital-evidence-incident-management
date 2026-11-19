import React, { useState, useEffect } from 'react';
import type { EvidenceIntelligenceItem } from '../types/dashboard.types';
import { api } from '../services/api';
import { CopyButton } from './CopyButton';

interface EvidenceIntelligenceTableProps {
  onSelectCase: (caseId: string) => void;
  onSelectEvidence?: (evidenceId: string) => void;
}

export const EvidenceIntelligenceTable: React.FC<EvidenceIntelligenceTableProps> = ({
  onSelectCase,
  onSelectEvidence,
}) => {
  const [evidenceItems, setEvidenceItems] = useState<EvidenceIntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState('');
  const [integrityFilter, setIntegrityFilter] = useState('');

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const data = await api.getEvidenceIntelligence({
        page,
        limit: 10,
        evidenceType: evidenceTypeFilter || undefined,
        integrityStatus: integrityFilter || undefined,
      });
      setEvidenceItems(data.items);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch evidence intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, [page, evidenceTypeFilter, integrityFilter]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getIntegrityBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800';
      case 'MISMATCH':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800 animate-pulse';
      case 'UNVERIFIED':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:border dark:border-emerald-800 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Digital Evidence Intelligence</h3>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={evidenceTypeFilter}
              onChange={(e) => {
                setEvidenceTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Evidence Types</option>
              <option value="DISK_IMAGE">Disk Image</option>
              <option value="MEMORY_DUMP">Memory Dump</option>
              <option value="NETWORK_PCAP">Network PCAP</option>
              <option value="LOG_FILE">Log File</option>
              <option value="DOCUMENT">Document</option>
              <option value="EMAIL">Email</option>
              <option value="MALWARE_SAMPLE">Malware</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              value={integrityFilter}
              onChange={(e) => {
                setIntegrityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Integrity States</option>
              <option value="VALID">VALID</option>
              <option value="MISMATCH">MISMATCH</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-900/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : evidenceItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No evidence records match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[580px]">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2">Evidence #</th>
                  <th className="px-3 py-2">Artifact</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-3 py-2">Case Context</th>
                  <th className="px-2 py-2">Integrity</th>
                  <th className="px-3 py-2">Custody State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {evidenceItems.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 font-mono">
                        {onSelectEvidence ? (
                          <button
                            type="button"
                            onClick={() => onSelectEvidence(ev.id)}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold text-left cursor-pointer"
                            title={`Inspect ${ev.evidenceNumber}`}
                          >
                            {ev.evidenceNumber}
                          </button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ev.evidenceNumber}</span>
                        )}
                        <CopyButton text={ev.evidenceNumber} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[150px]" title={ev.filename}>
                        {ev.filename}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {formatFileSize(ev.fileSize)}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="text-slate-700 dark:text-slate-300 block truncate max-w-[90px]">{ev.evidenceType}</span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">{ev.source}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectCase(ev.case.id)}
                          className="text-left font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {ev.case.caseNumber}
                        </button>
                        <CopyButton text={ev.case.caseNumber} />
                      </div>
                      {ev.incident && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 truncate max-w-[130px]">
                          <span>{ev.incident.incidentNumber}</span>
                          <CopyButton text={ev.incident.incidentNumber} />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded border ${getIntegrityBadge(
                          ev.latestIntegrityResult
                        )}`}
                      >
                        {ev.latestIntegrityResult}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-700 dark:text-slate-300 text-xs truncate max-w-[120px]" title={ev.currentCustody.custodianName || 'Unassigned'}>
                        {ev.currentCustody.custodianName || <span className="text-slate-400">Unassigned</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono">
                        {ev.currentCustody.isSealed && (
                          <span className="px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                            SEALED
                          </span>
                        )}
                        {ev.currentCustody.isReleased && (
                          <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            RELEASED
                          </span>
                        )}
                        {ev.aiAnalysisCount > 0 && (
                          <span className="px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                            {ev.aiAnalysisCount} AI
                          </span>
                        )}
                      </div>
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
