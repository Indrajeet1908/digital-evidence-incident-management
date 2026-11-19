import React, { useState, useMemo } from 'react';
import type { InvestigationAlertItem, AlertSeverity } from '../types/dashboard.types';

interface InvestigationAlertsProps {
  alerts: InvestigationAlertItem[];
  onSelectCase?: (caseId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

interface AlertGroup {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  entityType: string;
  entityId: string;
  latestCreatedAt: string;
  count: number;
  alertIds: string[];
}

export const InvestigationAlerts: React.FC<InvestigationAlertsProps> = ({
  alerts,
  onSelectCase,
  onNavigateTab,
}) => {
  const [showAll, setShowAll] = useState(false);

  // Group genuinely related repeated alerts (same severity, type, and message)
  const groupedAlerts = useMemo<AlertGroup[]>(() => {
    const severityWeight: Record<AlertSeverity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      WARNING: 2,
      INFO: 1,
    };

    const map = new Map<string, AlertGroup>();

    for (const alert of alerts) {
      // Grouping key based on severity, alert type, and message
      const key = `${alert.severity}:::${alert.type}:::${alert.message.trim()}`;
      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
        existing.alertIds.push(alert.id);
        if (new Date(alert.createdAt) > new Date(existing.latestCreatedAt)) {
          existing.latestCreatedAt = alert.createdAt;
          existing.entityId = alert.entityId;
          existing.entityType = alert.entityType;
        }
      } else {
        map.set(key, {
          id: alert.id,
          severity: alert.severity,
          type: alert.type,
          message: alert.message,
          entityType: alert.entityType,
          entityId: alert.entityId,
          latestCreatedAt: alert.createdAt,
          count: 1,
          alertIds: [alert.id],
        });
      }
    }

    const groups = Array.from(map.values());

    // Sort by severity (CRITICAL > HIGH > WARNING > INFO) and then newest first
    return groups.sort((a, b) => {
      const weightDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 text-center transition-colors">
        <div className="inline-flex p-3 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200">All Systems & Investigations Healthy</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          No integrity discrepancies, failed AI tasks, or unassigned critical incidents detected.
        </p>
      </div>
    );
  }

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'WARNING':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800';
      case 'INFO':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    }
  };

  const handleAlertClick = (alert: AlertGroup) => {
    if (alert.entityType === 'CASE' && onSelectCase) {
      onSelectCase(alert.entityId);
    } else if (alert.entityType === 'INCIDENT' && onNavigateTab) {
      onNavigateTab('incidents');
    } else if (alert.entityType === 'EVIDENCE' && onNavigateTab) {
      onNavigateTab('evidence');
    } else if (alert.entityType === 'AI_ANALYSIS' && onNavigateTab) {
      onNavigateTab('ai');
    }
  };

  const visibleAlerts = showAll ? groupedAlerts : groupedAlerts.slice(0, 5);

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:border dark:border-rose-800 dark:text-rose-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Investigation Health Alerts</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
            {alerts.length} Total ({groupedAlerts.length} Unique)
          </span>

          {groupedAlerts.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline cursor-pointer ml-1"
            >
              {showAll ? 'Show Top 5' : `View All Alerts (${groupedAlerts.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            onClick={() => handleAlertClick(alert)}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer gap-2"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getSeverityBadge(
                    alert.severity
                  )}`}
                >
                  {alert.severity}
                </span>

                {alert.count > 1 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    {alert.count}x
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-slate-200 break-words leading-relaxed">
                  {alert.message}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Type: {alert.type}</span>
                  <span>•</span>
                  <span>Entity: {alert.entityType}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 self-end sm:self-center font-mono shrink-0">
              {new Date(alert.latestCreatedAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {groupedAlerts.length > 5 && !showAll && (
        <div className="mt-3 text-center border-t border-slate-200 dark:border-slate-700/60 pt-2.5">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
          >
            View All Alerts ({groupedAlerts.length})
          </button>
        </div>
      )}
    </div>
  );
};
