import React, { useState, useEffect } from 'react';
import type { AIIntelligenceResponse } from '../types/dashboard.types';
import { api } from '../services/api';
import { CopyButton } from './CopyButton';

export const AIInsightsSection: React.FC = () => {
  const [data, setData] = useState<AIIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAI = async () => {
      setLoading(true);
      try {
        const res = await api.getAIIntelligence();
        setData(res);
      } catch (err) {
        console.error('Failed to load AI intelligence:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAI();
  }, []);

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800';
      case 'LOW':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 dark:bg-slate-900/60 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-center text-slate-500 dark:text-slate-400 text-xs">
        Failed to load AI insights.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Advisory Banner */}
      <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-xl p-4 flex items-start gap-3">
        <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/80 dark:border dark:border-purple-700 dark:text-purple-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <div>
          <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wide">
            Advisory Intelligence Only
          </h4>
          <p className="text-xs text-purple-800/90 dark:text-purple-300/90 mt-0.5 leading-relaxed">
            All AI classifications, summaries, and extracted indicators are advisory forensic recommendations. They assist investigator workflows and require human investigator corroboration. AI outputs never automatically mutate case status or custody records.
          </p>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total & Status */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono mb-1">Total AI Analyses</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{data.totalAnalyses}</div>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            {Object.entries(data.analysesByStatus).map(([status, count]) => (
              <span key={status} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {status}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Average Confidence */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono mb-1">Average Model Confidence</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {data.averageConfidence !== null ? `${(data.averageConfidence * 100).toFixed(1)}%` : 'N/A'}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(data.averageConfidence || 0) * 100}%` }}
            />
          </div>
        </div>

        {/* Analyses by Type */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono mb-1">Analyses by Type</div>
          <div className="space-y-1 mt-2 text-xs">
            {Object.entries(data.analysesByType).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{type}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Common Indicators & Recent Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Common Indicator Types */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:border dark:border-purple-800 dark:text-purple-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Extracted Threat Indicators</h3>
          </div>

          {Object.keys(data.commonIndicatorTypes).length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No threat indicators extracted yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.commonIndicatorTypes).map(([indType, count]) => (
                <div
                  key={indType}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs"
                >
                  <span className="font-mono text-purple-700 dark:text-purple-400 uppercase text-[11px]">{indType}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Findings */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:border dark:border-purple-800 dark:text-purple-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Advisory Findings</h3>
          </div>

          {data.recentFindings.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No findings generated yet.</div>
          ) : (
            <div className="space-y-3">
              {data.recentFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-200">{finding.title}</div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 line-clamp-2">{finding.description}</p>
                    {finding.evidenceNumber && (
                      <div className="flex items-center gap-1 mt-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span>Evidence: {finding.evidenceNumber}</span>
                        <CopyButton text={finding.evidenceNumber} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getSeverityBadge(
                        finding.severity
                      )}`}
                    >
                      {finding.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {(finding.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
