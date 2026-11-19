import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentCreated: (newIncident: any) => void;
  defaultCaseId?: string;
}

const INCIDENT_TYPES = [
  'PHISHING',
  'MALWARE',
  'DATA_BREACH',
  'UNAUTHORIZED_ACCESS',
  'ACCOUNT_COMPROMISE',
  'INSIDER_THREAT',
  'NETWORK_ATTACK',
  'ENDPOINT_COMPROMISE',
  'SUSPICIOUS_ACTIVITY',
  'OTHER',
];

const INCIDENT_CATEGORIES = [
  'EMAIL_SECURITY',
  'IDENTITY_ACCESS',
  'ENDPOINT_SECURITY',
  'NETWORK_SECURITY',
  'DATA_SECURITY',
  'APPLICATION_SECURITY',
  'CLOUD_SECURITY',
  'OTHER',
];

const INCIDENT_SOURCES = [
  'USER_REPORT',
  'SOC_ALERT',
  'SIEM',
  'EDR',
  'EMAIL',
  'NETWORK_MONITORING',
  'THREAT_INTELLIGENCE',
  'MANUAL_INVESTIGATION',
  'OTHER',
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
  isOpen,
  onClose,
  onIncidentCreated,
  defaultCaseId,
}) => {
  const toast = useToast();
  const [casesList, setCasesList] = useState<Array<{ id: string; caseNumber: string; title: string }>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [incidentType, setIncidentType] = useState('OTHER');
  const [category, setCategory] = useState('OTHER');
  const [severity, setSeverity] = useState('MEDIUM');
  const [priority, setPriority] = useState('MEDIUM');
  const [source, setSource] = useState('OTHER');
  const [detectedAt, setDetectedAt] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [reportedAt, setReportedAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (defaultCaseId) {
        setSelectedCaseId(defaultCaseId);
      }
      api.getCases({ limit: 100 })
        .then((res) => {
          const list = (res.cases || res.data || []).map((c: any) => ({ id: c.id, caseNumber: c.caseNumber, title: c.title }));
          setCasesList(list);
          if (!defaultCaseId && list.length > 0) {
            setSelectedCaseId(list[0].id);
          }
        })
        .catch((err) => console.error('Failed to load cases for incident:', err));
    }
  }, [isOpen, defaultCaseId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedCaseId) {
      setErrorMsg('Please select a parent Case for this security incident.');
      return;
    }

    if (title.trim().length < 3) {
      setErrorMsg('Title must be at least 3 characters long');
      return;
    }

    const payload: Record<string, any> = {
      caseId: selectedCaseId,
      title: title.trim(),
      incidentType,
      category,
      severity,
      priority,
      source,
    };

    if (description.trim()) payload.description = description.trim();
    if (detectedAt) payload.detectedAt = new Date(detectedAt).toISOString();
    if (occurredAt) payload.occurredAt = new Date(occurredAt).toISOString();
    if (reportedAt) payload.reportedAt = new Date(reportedAt).toISOString();

    setIsSubmitting(true);
    try {
      const res = await api.createIncident(payload);
      toast.success(`Incident created: ${res.incident.incidentNumber}`);
      onIncidentCreated(res.incident);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-incident-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 id="create-incident-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Create New Security Incident
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Record a specific security breach, alert, or forensic anomaly under an investigation case.
            </p>
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

          {/* Parent Case Selector */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Associated Case <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <select
              required
              disabled={Boolean(defaultCaseId)}
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-70 cursor-pointer"
            >
              <option value="">Select a case dossier...</option>
              {casesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Incident Title <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Credential Harvesting Payload Detected in Finance Inbox"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Description</label>
            <textarea
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Document indicators, observed anomalous behavior, target hostnames, IPs..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Grid: Type & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {INCIDENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid: Severity, Priority, Source */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Detection Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {INCIDENT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid: Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Detected At</label>
              <input
                type="datetime-local"
                value={detectedAt}
                onChange={(e) => setDetectedAt(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Occurred At</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Reported At</label>
              <input
                type="datetime-local"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
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
                  <span>Creating Incident...</span>
                </>
              ) : (
                <span>Create Incident</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
