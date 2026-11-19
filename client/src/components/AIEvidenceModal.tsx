import React, { useState } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';

export type BackendAIAnalysisType =
  | 'EVIDENCE_SUMMARY'
  | 'INCIDENT_CLASSIFICATION'
  | 'IOC_EXTRACTION'
  | 'THREAT_ANALYSIS'
  | 'INVESTIGATION_SUMMARY';

interface AIEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceId: string;
  evidenceNumber: string;
  onAnalysisComplete: (result: any) => void;
}

const AI_ANALYSIS_OPTIONS: Array<{
  type: BackendAIAnalysisType;
  label: string;
  description: string;
}> = [
  {
    type: 'EVIDENCE_SUMMARY',
    label: 'Evidence Summary',
    description: 'Summarizes key artifact attributes, forensic provenance, and high-level relevance.',
  },
  {
    type: 'IOC_EXTRACTION',
    label: 'IOC Extraction',
    description: 'Extracts indicators of compromise (IPs, hashes, domains, emails, URLs) from artifact data.',
  },
  {
    type: 'THREAT_ANALYSIS',
    label: 'Threat Analysis',
    description: 'Assesses threat vectors, potential MITRE ATT&CK techniques, and threat actor behavior.',
  },
  {
    type: 'INCIDENT_CLASSIFICATION',
    label: 'Incident Classification',
    description: 'Assesses incident taxonomy and severity categorization aligned with artifact content.',
  },
  {
    type: 'INVESTIGATION_SUMMARY',
    label: 'Investigation Summary',
    description: 'Produces a holistic investigative summary combining artifact context and lead observations.',
  },
];

export type AIProviderChoice = 'gemini' | 'openai';

export const AIEvidenceModal: React.FC<AIEvidenceModalProps> = ({
  isOpen,
  onClose,
  evidenceId,
  evidenceNumber,
  onAnalysisComplete,
}) => {
  const toast = useToast();
  const [provider, setProvider] = useState<AIProviderChoice>('gemini');
  const [analysisType, setAnalysisType] = useState<BackendAIAnalysisType>('EVIDENCE_SUMMARY');
  const [force, setForce] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await api.triggerEvidenceAI(evidenceId, analysisType, force, provider);
      const providerLabel = provider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT';
      toast.success(`AI analysis completed for ${evidenceNumber} via ${providerLabel}`);
      onAnalysisComplete(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to trigger AI analysis');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOption = AI_ANALYSIS_OPTIONS.find((opt) => opt.type === analysisType);
  const providerLabel = provider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT';

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
              <span>Run AI Forensic Analysis</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs font-semibold">{evidenceNumber}</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Request automated analysis using Google Gemini or OpenAI GPT models.
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

        {/* Mandatory Advisory Notice */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg p-3 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <span className="text-sm">⚠️</span>
          <div className="text-[11px] leading-relaxed">
            <span className="font-semibold">Advisory Assistance Notice:</span> All AI-generated findings are
            investigative assistance only and do not constitute a confirmed forensic finding. Always corroborate
            findings with primary evidence records.
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* AI Provider Selector */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Select AI Provider</label>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  provider === 'gemini'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-slate-900 dark:text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="aiProvider"
                  value="gemini"
                  checked={provider === 'gemini'}
                  onChange={() => setProvider('gemini')}
                  className="text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-200">Google Gemini</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Gemini 1.5 Flash (Default)</span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  provider === 'openai'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-slate-900 dark:text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="aiProvider"
                  value="openai"
                  checked={provider === 'openai'}
                  onChange={() => setProvider('openai')}
                  className="text-emerald-600 focus:ring-emerald-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-200">OpenAI GPT</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">GPT-4o Mini</span>
                </div>
              </label>
            </div>
          </div>

          {/* Analysis Type */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Select Analysis Type</label>
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value as BackendAIAnalysisType)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            >
              {AI_ANALYSIS_OPTIONS.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  {opt.label} ({opt.type})
                </option>
              ))}
            </select>
            {selectedOption && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                {selectedOption.description}
              </p>
            )}
          </div>

          {/* Force Re-analysis Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="forceAnalysis"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="forceAnalysis" className="text-slate-700 dark:text-slate-300 text-xs cursor-pointer select-none">
              Force fresh analysis (bypass cached result for {providerLabel})
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-300 dark:border-transparent transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Processing with {providerLabel}...</span>
                </>
              ) : (
                <span>Execute Analysis ({providerLabel})</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
