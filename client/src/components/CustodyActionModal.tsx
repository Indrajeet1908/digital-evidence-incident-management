import React, { useState } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';

export type CustodyActionType = 'TRANSFER' | 'RECEIVE' | 'SEAL' | 'UNSEAL' | 'RELEASE';

interface CustodyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceId: string;
  evidenceNumber: string;
  userRole?: string;
  onCustodyUpdated: () => void;
}

export const CustodyActionModal: React.FC<CustodyActionModalProps> = ({
  isOpen,
  onClose,
  evidenceId,
  evidenceNumber,
  userRole,
  onCustodyUpdated,
}) => {
  const toast = useToast();
  const [actionType, setActionType] = useState<CustodyActionType>('TRANSFER');
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isAdmin = userRole?.toUpperCase() === 'ADMIN';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (actionType !== 'RECEIVE' && !reason.trim()) {
      setErrorMsg(`A reason is required to execute a custody ${actionType.toLowerCase()} action.`);
      return;
    }

    if (actionType === 'TRANSFER' && !toUserId.trim()) {
      setErrorMsg('A recipient investigator/officer User ID is required to transfer custody.');
      return;
    }

    if (actionType === 'RELEASE' && !isAdmin) {
      setErrorMsg('Only an Administrator can authorize the final release of evidence.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (actionType === 'TRANSFER') {
        await api.transferEvidenceCustody(evidenceId, {
          toUserId: toUserId.trim(),
          reason: reason.trim(),
          location: location.trim() || undefined,
        });
        toast.success(`Custody transfer recorded for ${evidenceNumber}`);
      } else if (actionType === 'RECEIVE') {
        await api.receiveEvidenceCustody(evidenceId, {
          reason: reason.trim() || undefined,
          location: location.trim() || undefined,
        });
        toast.success(`Custody receipt confirmed for ${evidenceNumber}`);
      } else if (actionType === 'SEAL') {
        await api.sealEvidenceCustody(evidenceId, {
          reason: reason.trim(),
        });
        toast.success(`Evidence ${evidenceNumber} has been cryptographically sealed.`);
      } else if (actionType === 'UNSEAL') {
        await api.unsealEvidenceCustody(evidenceId, {
          reason: reason.trim(),
        });
        toast.warning(`Evidence ${evidenceNumber} seal broken for forensic examination.`);
      } else if (actionType === 'RELEASE') {
        await api.releaseEvidenceCustody(evidenceId, {
          reason: reason.trim(),
        });
        toast.info(`Evidence ${evidenceNumber} authorized release finalized.`);
      }

      onCustodyUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to execute custody ${actionType.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Record Custody Event</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs font-semibold">{evidenceNumber}</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Append a cryptographically audited chain-of-custody transfer or state mutation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Action Type Selector */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Custody Action Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['TRANSFER', 'RECEIVE', 'SEAL', 'UNSEAL'] as CustodyActionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    actionType === type
                      ? 'bg-indigo-50 dark:bg-indigo-600/30 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActionType('RELEASE')}
                  className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    actionType === 'RELEASE'
                      ? 'bg-rose-50 dark:bg-rose-600/30 border-rose-500 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  RELEASE (Admin)
                </button>
              )}
            </div>
          </div>

          {/* Conditional Inputs */}
          {actionType === 'TRANSFER' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Recipient User ID <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="UUID of target investigator or custodian"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {(actionType === 'TRANSFER' || actionType === 'RECEIVE') && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Physical / Digital Location</label>
              <input
                type="text"
                placeholder="e.g. Evidence Locker 4B, Secure Vault, Forensic Workstation 2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Reason / Justification {actionType !== 'RECEIVE' && <span className="text-rose-500 dark:text-rose-400">*</span>}
            </label>
            <textarea
              rows={3}
              required={actionType !== 'RECEIVE'}
              placeholder={`State formal rationale for ${actionType.toLowerCase()}...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="bg-indigo-50/70 dark:bg-slate-800/40 border border-indigo-100 dark:border-slate-800 rounded-lg p-2.5 text-[11px] text-indigo-900 dark:text-slate-400 flex items-start gap-2">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">ℹ</span>
            <span>
              This operation generates an immutable SHA-256 chained event linked to the previous custody hash.
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-300 dark:border-transparent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                actionType === 'RELEASE'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isSubmitting ? 'Recording Event...' : `Submit ${actionType}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
