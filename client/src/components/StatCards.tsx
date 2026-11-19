import React from 'react';
import type { InvestigationOverviewResponse } from '../types/dashboard.types';

interface StatCardsProps {
  overview: InvestigationOverviewResponse | null;
  onNavigate: (tab: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ overview, onNavigate }) => {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Cases Card */}
      <div
        onClick={() => onNavigate('cases')}
        className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-xl p-5 transition-all shadow-sm cursor-pointer"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Active Cases</span>
          <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{overview.cases.total}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{overview.cases.open} Open</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">{overview.cases.inProgress} In Progress</span>
          <span>•</span>
          <span className="text-slate-500 dark:text-slate-400">{overview.cases.closed} Closed</span>
        </div>
      </div>

      {/* Incidents Card */}
      <div
        onClick={() => onNavigate('incidents')}
        className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 rounded-xl p-5 transition-all shadow-sm cursor-pointer"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Security Incidents</span>
          <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 p-1.5 rounded-lg border border-amber-200 dark:border-amber-900/60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{overview.incidents.total}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="text-rose-600 dark:text-rose-400 font-medium">{overview.incidents.open} Open</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">{overview.incidents.investigating} Active</span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{overview.incidents.resolved} Resolved</span>
        </div>
      </div>

      {/* Evidence Card */}
      <div
        onClick={() => onNavigate('evidence')}
        className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500/50 rounded-xl p-5 transition-all shadow-sm cursor-pointer"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Digital Evidence</span>
          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{overview.evidence.total}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{overview.evidence.integrityVerified} Verified</span>
          <span>•</span>
          <span className={overview.evidence.integrityFailures > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
            {overview.evidence.integrityFailures} Failures
          </span>
          <span>•</span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">{overview.custody.recentTransfers} Transfers</span>
        </div>
      </div>

      {/* AI Analyses Card */}
      <div
        onClick={() => onNavigate('reports')}
        className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500/50 rounded-xl p-5 transition-all shadow-sm cursor-pointer"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">AI Intelligence</span>
          <span className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 p-1.5 rounded-lg border border-purple-200 dark:border-purple-900/60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{overview.ai.totalAnalyses}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="text-purple-600 dark:text-purple-400 font-medium">{overview.ai.completed} Complete</span>
          <span>•</span>
          <span className="text-slate-500 dark:text-slate-400">{overview.ai.pending} In Progress</span>
          <span>•</span>
          <span className={overview.ai.failed > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
            {overview.ai.failed} Failed
          </span>
        </div>
      </div>
    </div>
  );
};
