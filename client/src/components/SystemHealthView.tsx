import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const SystemHealthView: React.FC = () => {
  const [healthData, setHealthData] = useState<any | null>(null);
  const [readyData, setReadyData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, rRes] = await Promise.allSettled([api.getHealth(), api.getReady()]);
      if (hRes.status === 'fulfilled') {
        setHealthData(hRes.value);
      }
      if (rRes.status === 'fulfilled') {
        setReadyData(rRes.value);
      }
      setLastChecked(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to query system health endpoints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>System Telemetry & Health</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                healthData?.status === 'ok' || healthData?.status === 'HEALTHY'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800'
              }`}
            >
              {healthData?.status?.toUpperCase() || 'QUERYING'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time liveness and readiness probes monitoring database, storage, and platform integrity.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-sm"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Grid of Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Core Liveness */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Application Liveness</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {healthData?.status === 'ok' ? 'UP & HEALTHY' : healthData?.status || 'Unknown'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Node.js / Express process receiving requests on /api/health
          </p>
        </div>

        {/* Database Readiness */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">PostgreSQL Connection</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                readyData?.status === 'ready' || readyData?.database === 'connected'
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {readyData?.database?.toUpperCase() || (readyData?.status === 'ready' ? 'CONNECTED' : 'STANDBY')}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Prisma client connection pool verified against dep-postgres
          </p>
        </div>

        {/* Storage Readiness */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Evidence Volume Storage</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                readyData?.storage === 'accessible' || readyData?.status === 'ready'
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {readyData?.storage?.toUpperCase() || (readyData?.status === 'ready' ? 'ACCESSIBLE' : 'READY')}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Local filesystem / volume mount writable for evidence ingestion
          </p>
        </div>
      </div>

      {/* Raw Readiness Details */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Endpoint Telemetry Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60">
            <div className="text-slate-600 dark:text-slate-400 font-semibold mb-2 text-[11px] uppercase tracking-wider">
              GET /api/health
            </div>
            <pre className="text-slate-800 dark:text-slate-300 text-[11px] overflow-x-auto">
              {JSON.stringify(healthData || { status: 'loading...' }, null, 2)}
            </pre>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60">
            <div className="text-slate-600 dark:text-slate-400 font-semibold mb-2 text-[11px] uppercase tracking-wider">
              GET /api/ready
            </div>
            <pre className="text-slate-800 dark:text-slate-300 text-[11px] overflow-x-auto">
              {JSON.stringify(readyData || { status: 'loading...' }, null, 2)}
            </pre>
          </div>
        </div>

        {lastChecked && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
            Last probe response recorded at: {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};
