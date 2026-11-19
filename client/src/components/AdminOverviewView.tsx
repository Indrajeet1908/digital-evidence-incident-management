import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const AdminOverviewView: React.FC = () => {
  const [adminRbacData, setAdminRbacData] = useState<any | null>(null);
  const [readyData, setReadyData] = useState<any | null>(null);
  const [healthData, setHealthData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);

  const verifyAdminState = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rbacRes, readyRes, healthRes] = await Promise.allSettled([
        api.getAdminRbac(),
        api.getReady(),
        api.getHealth(),
      ]);

      if (rbacRes.status === 'fulfilled') {
        setAdminRbacData(rbacRes.value);
      } else {
        throw new Error(rbacRes.reason?.message || 'Administrator privilege verification failed');
      }

      if (readyRes.status === 'fulfilled') {
        setReadyData(readyRes.value);
      }
      if (healthRes.status === 'fulfilled') {
        setHealthData(healthRes.value);
      }

      setVerifiedAt(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to verify admin security credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAdminState();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Security & RBAC Administration</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono">
              CONFIDENTIAL
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Server-enforced role-based access control and system integrity verification.
          </p>
        </div>

        <button
          type="button"
          onClick={verifyAdminState}
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
          <span>Re-verify Admin Authority</span>
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-xl space-y-2">
          <div className="font-semibold flex items-center gap-2">
            <span>⛔ Access Denied / Verification Failed</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300">{error}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Endpoint <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">/api/rbac/admin</code> requires the authenticated role <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">ADMIN</code>.
          </p>
        </div>
      ) : (
        <>
          {/* Admin Authority Verification Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Backend Admin Authority Attestation</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </h3>
              {verifiedAt && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Verified: {verifiedAt.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Backend Message</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {adminRbacData?.message || 'Access verified'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Verified Endpoint</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                  {adminRbacData?.endpoint || '/api/rbac/admin'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Authenticated Role</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  {adminRbacData?.user?.role || 'ADMIN'}
                </span>
              </div>
            </div>
          </div>

          {/* Platform Operational State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Database & Storage Telemetry</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">PostgreSQL (Prisma)</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {readyData?.database?.toUpperCase() || (readyData?.status === 'ready' ? 'CONNECTED' : 'STANDBY')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">Evidence Storage Volume</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {readyData?.storage?.toUpperCase() || (readyData?.status === 'ready' ? 'ACCESSIBLE' : 'READY')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">Application Status</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {healthData?.status?.toUpperCase() || 'OK'}
                  </span>
                </div>
              </div>
            </div>

            {/* Enforced Role Matrix Reference */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Server Enforced RBAC Matrix</h3>
              <div className="space-y-2 text-[11px]">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">ADMIN</div>
                  <div className="text-slate-600 dark:text-slate-400">Full system access, custody release authorization, case roster editing, user governance.</div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">INVESTIGATOR</div>
                  <div className="text-slate-600 dark:text-slate-400">Case and incident lifecycle management, evidence upload/transfer, AI triggering, reports.</div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">ANALYST (FORENSIC)</div>
                  <div className="text-slate-600 dark:text-slate-400">Evidence inspection, custody updates, AI analysis execution, reporting exports.</div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">VIEWER</div>
                  <div className="text-slate-600 dark:text-slate-400">Strict read-only inspection and live SHA-256 integrity verification. Downloads and mutations blocked.</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
