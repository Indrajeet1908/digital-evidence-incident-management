import React, { useState, useEffect } from 'react';
import type { NormalizedActivityItem } from '../types/dashboard.types';
import { api } from '../services/api';

interface ActivityTimelineProps {
  initialItems?: NormalizedActivityItem[];
  onSelectCase?: (caseId: string) => void;
  filterCaseId?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  initialItems,
  onSelectCase,
  filterCaseId,
}) => {
  const [items, setItems] = useState<NormalizedActivityItem[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [filterType, setFilterType] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const fetchActivities = async (currentPage: number, typeFilter: string) => {
    setLoading(true);
    try {
      const data = await api.getActivityTimeline({
        page: currentPage,
        limit: 15,
        type: typeFilter || undefined,
        caseId: filterCaseId || undefined,
      });
      setItems(data.items);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch activity timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(page, filterType);
  }, [page, filterType, filterCaseId]);

  const getEntityBadge = (entityType: string) => {
    switch (entityType) {
      case 'CASE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800';
      case 'INCIDENT':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'EVIDENCE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
      case 'AI_ANALYSIS':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getResultPill = (result: string) => {
    switch (result) {
      case 'SUCCESS':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800';
      case 'FAILURE':
        return 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/60 dark:border-rose-800';
      case 'DENIED':
        return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800';
      default:
        return 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700';
    }
  };

  // If not expanded, display approximately 7 recent items
  const displayedItems = isExpanded ? items : items.slice(0, 7);

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:border dark:border-indigo-800 dark:text-indigo-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Investigation Activity Timeline</h3>
        </div>

        {/* Filter and View All Toggle */}
        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="">All Activity Types</option>
            <option value="CASE">Case Events</option>
            <option value="INCIDENT">Incident Events</option>
            <option value="EVIDENCE">Evidence Ingestion & Integrity</option>
            <option value="CUSTODY">Custody Transfers</option>
            <option value="AI">AI Inferences</option>
          </select>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer whitespace-nowrap"
          >
            {isExpanded ? 'Show Recent (7)' : 'View All Activity'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 py-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-900/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No activity records match the current filter.</div>
      ) : (
        <div className="space-y-2.5">
          {displayedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.entityType === 'CASE' && onSelectCase) {
                  onSelectCase(item.entityId);
                }
              }}
              className={`p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 transition-colors ${
                item.entityType === 'CASE' ? 'hover:border-indigo-500/50 cursor-pointer' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getEntityBadge(
                      item.entityType
                    )}`}
                  >
                    {item.entityType}
                  </span>
                  <div>
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-200">{item.description}</div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Actor: {item.actor.name}</span>
                      {item.entityReference && (
                        <>
                          <span>•</span>
                          <span>Ref: {item.entityReference}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center font-mono shrink-0">
                  <span
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getResultPill(
                      item.result
                    )}`}
                  >
                    {item.result}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View All Activity action when collapsed */}
      {!isExpanded && items.length > 7 && (
        <div className="mt-4 text-center border-t border-slate-200 dark:border-slate-700/60 pt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
          >
            View All Activity ({items.length} loaded)
          </button>
        </div>
      )}

      {/* Pagination Controls when expanded */}
      {isExpanded && totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
