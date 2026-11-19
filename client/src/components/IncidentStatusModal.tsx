import React, { useState } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';

interface IncidentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  incidentNumber: string;
  currentStatus: string;
  onStatusChanged: (updatedIncident: any) => void;
}

const INCIDENT_STATUSES = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'];

export const IncidentStatusModal: React.FC<IncidentStatusModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  incidentNumber,
  currentStatus,
  onStatusChanged,
}) => {
  const toast = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (status === 'CLOSED' && !reason.trim()) {
      setErrorMsg('A closure resolution note is mandatory when transitioning an incident to CLOSED status.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: { status: string; reason?: string } = { status };
      if (reason.trim()) payload.reason = reason.trim();

      const res = await api.updateIncidentStatus(incidentId, payload);
      toast.success(`Incident status updated to ${status}`);
      onStatusChanged(res.incident);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update incident status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-status-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="incident-status-title" className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Update Incident Status
            </h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-mono font-semibold">{incidentNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Target Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {INCIDENT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Resolution / Transition Reason{' '}
              {status === 'CLOSED' && <span className="text-rose-500 dark:text-rose-400 font-bold">*</span>}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                status === 'CLOSED'
                  ? 'Mandatory: Incident resolution details, containment actions taken...'
                  : 'Optional note regarding status change justification...'
              }
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-300 dark:border-transparent transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Confirm Transition</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
