import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { CopyButton } from './CopyButton';

interface ReportPreview {
  reportMetadata: {
    reportType: string;
    generatedAt: string;
    generatedBy: { id: string; name: string; role: string };
    caseNumber?: string;
    incidentNumber?: string;
    evidenceNumber?: string;
    classification?: string;
    reportHash: string;
  };
  case: Record<string, unknown> | null;
  incidents: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  integrity: Array<Record<string, unknown>>;
  custody: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  aiAnalysis: Array<Record<string, unknown>>;
  activityTimeline: Array<Record<string, unknown>>;
  summary: string;
  limitations: string[];
  disclaimer: string;
}

const REPORT_TYPES = [
  { value: 'INVESTIGATION_SUMMARY', label: 'Investigation Summary', requires: 'caseId' },
  { value: 'DETAILED_CASE_REPORT', label: 'Detailed Case Report', requires: 'caseId' },
  { value: 'INCIDENT_REPORT', label: 'Incident Report', requires: 'incidentId' },
  { value: 'EVIDENCE_REPORT', label: 'Evidence Report', requires: 'evidenceId' },
  { value: 'CHAIN_OF_CUSTODY_REPORT', label: 'Chain of Custody Report', requires: 'evidenceId' },
  { value: 'AI_ANALYSIS_REPORT', label: 'AI Analysis Report', requires: 'evidenceId' },
] as const;

interface EntityOption {
  id: string;
  label: string;
}

export const ReportCenter: React.FC = () => {
  // Form state
  const [reportType, setReportType] = useState<string>('');
  const [caseId, setCaseId] = useState<string>('');
  const [incidentId, setIncidentId] = useState<string>('');
  const [evidenceId, setEvidenceId] = useState<string>('');
  const [includeAI, setIncludeAI] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(true);
  const [includeCustody, setIncludeCustody] = useState(true);

  // Entity lists
  const [cases, setCases] = useState<EntityOption[]>([]);
  const [incidents, setIncidents] = useState<EntityOption[]>([]);
  const [evidence, setEvidence] = useState<EntityOption[]>([]);

  // Evidence search & pagination state
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidencePage, setEvidencePage] = useState(1);
  const [evidenceTotal, setEvidenceTotal] = useState(0);
  const [evidenceTotalPages, setEvidenceTotalPages] = useState(1);
  const [isSearchingEvidence, setIsSearchingEvidence] = useState(false);
  const [loadingMoreEvidence, setLoadingMoreEvidence] = useState(false);
  const [selectedEvidenceOption, setSelectedEvidenceOption] = useState<EntityOption | null>(null);
  const isInitialMount = useRef(true);

  // Output state
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchEvidenceList = async (query: string, page = 1, append = false) => {
    if (page === 1 && !append) {
      setIsSearchingEvidence(true);
    } else {
      setLoadingMoreEvidence(true);
    }

    try {
      const res = await api.getEvidenceList({
        search: query.trim() || undefined,
        page,
        limit: 50,
      });

      const list = res.data ?? res.evidence ?? [];
      const newOptions: EntityOption[] = list.map((e: Record<string, string>) => ({
        id: e.id,
        label: `${e.evidenceNumber} - ${e.originalFilename}`,
      }));

      setEvidence((prev) => {
        let combined = append ? [...prev, ...newOptions] : newOptions;
        const seen = new Set<string>();
        combined = combined.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        // Ensure selected evidence option remains in list
        if (selectedEvidenceOption && !seen.has(selectedEvidenceOption.id)) {
          combined = [selectedEvidenceOption, ...combined];
        }

        return combined;
      });

      setEvidencePage(page);
      setEvidenceTotal(res.pagination?.total ?? newOptions.length);
      setEvidenceTotalPages(res.pagination?.totalPages ?? 1);
    } catch (err) {
      console.error('Failed to load evidence records:', err);
    } finally {
      setIsSearchingEvidence(false);
      setLoadingMoreEvidence(false);
    }
  };

  // Fetch entity lists on mount
  useEffect(() => {
    const loadEntities = async () => {
      try {
        const [casesRes, incidentsRes] = await Promise.all([
          api.getCases({ limit: 100 }),
          api.getIncidents({ limit: 100 }),
        ]);

        const casesList = casesRes.data ?? casesRes.cases ?? [];
        setCases(casesList.map((c: Record<string, string>) => ({ id: c.id, label: `${c.caseNumber} - ${c.title}` })));

        const incidentsList = incidentsRes.data ?? incidentsRes.incidents ?? [];
        setIncidents(incidentsList.map((i: Record<string, string>) => ({ id: i.id, label: `${i.incidentNumber} - ${i.title}` })));

        await fetchEvidenceList('', 1, false);
      } catch (err) {
        console.error('Failed to load entities:', err);
      }
    };
    loadEntities();
  }, []);

  // Debounced search when user types in evidence search input
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchEvidenceList(evidenceSearch, 1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [evidenceSearch]);

  const handleEvidenceSelect = (id: string) => {
    setEvidenceId(id);
    const found = evidence.find((e) => e.id === id);
    if (found) {
      setSelectedEvidenceOption(found);
    } else if (!id) {
      setSelectedEvidenceOption(null);
    }
  };

  const handleLoadMoreEvidence = () => {
    if (evidencePage < evidenceTotalPages && !loadingMoreEvidence && !isSearchingEvidence) {
      fetchEvidenceList(evidenceSearch, evidencePage + 1, true);
    }
  };

  const selectedType = REPORT_TYPES.find((t) => t.value === reportType);
  const requiresField = selectedType?.requires;

  const handlePreview = async () => {
    setError('');
    setLoading(true);
    setPreview(null);
    try {
      const body: Record<string, unknown> = {
        reportType,
        includeAI,
        includeAudit,
        includeCustody,
      };
      if (caseId) body.caseId = caseId;
      if (incidentId) body.incidentId = incidentId;
      if (evidenceId) body.evidenceId = evidenceId;

      const result = await api.previewReport(body);
      setPreview(result as ReportPreview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        reportType,
        includeAI,
        includeAudit,
        includeCustody,
      };
      if (caseId) body.caseId = caseId;
      if (incidentId) body.incidentId = incidentId;
      if (evidenceId) body.evidenceId = evidenceId;

      const token = localStorage.getItem('dep_auth_token');
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message ?? errJson?.error ?? 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportType.toLowerCase()}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const canSubmit = reportType && (
    (requiresField === 'caseId' && caseId) ||
    (requiresField === 'incidentId' && incidentId) ||
    (requiresField === 'evidenceId' && evidenceId)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Report Center</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Generate structured investigation reports from platform records.
          AI content is clearly labeled as advisory only.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-4">
        {/* Report Type Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setPreview(null);
              setError('');
            }}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a report type...</option>
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Dynamic Entity Selector */}
        {requiresField === 'caseId' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Case</label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a case...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {requiresField === 'incidentId' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Incident</label>
            <select
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select an incident...</option>
              {incidents.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
          </div>
        )}

        {requiresField === 'evidenceId' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Evidence Record
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {isSearchingEvidence ? 'Searching...' : `Showing ${evidence.length} of ${evidenceTotal || evidence.length}`}
              </span>
            </div>

            {/* Evidence Search Box */}
            <div className="relative">
              <input
                type="text"
                value={evidenceSearch}
                onChange={(e) => setEvidenceSearch(e.target.value)}
                placeholder="Search evidence by #, filename, or description (e.g., EVD-2026-0187, email)..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {evidenceSearch && (
                <button
                  type="button"
                  onClick={() => setEvidenceSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Evidence Select Dropdown */}
            <select
              value={evidenceId}
              onChange={(e) => handleEvidenceSelect(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select evidence record...</option>
              {evidence.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>

            {/* Selection confirmation badge & pagination */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {evidenceId && selectedEvidenceOption ? (
                <div className="inline-flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                  <span>Selected: <strong>{selectedEvidenceOption.label}</strong></span>
                  <button
                    type="button"
                    onClick={() => handleEvidenceSelect('')}
                    className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-200 ml-1 font-bold"
                    title="Deselect"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {evidence.length === 0 ? 'No evidence items found matching search query.' : 'Select an evidence item from the list above.'}
                </span>
              )}

              {evidencePage < evidenceTotalPages && (
                <button
                  type="button"
                  onClick={handleLoadMoreEvidence}
                  disabled={loadingMoreEvidence || isSearchingEvidence}
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium hover:underline disabled:opacity-50"
                >
                  {loadingMoreEvidence ? 'Loading...' : `Load more records (+50)`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Include Toggles */}
        {reportType && (
          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAI}
                onChange={(e) => setIncludeAI(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              Include AI Analysis
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAudit}
                onChange={(e) => setIncludeAudit(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              Include Audit Trail
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCustody}
                onChange={(e) => setIncludeCustody(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              Include Custody Chain
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handlePreview}
            disabled={!canSubmit || loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'Generating Preview...' : 'Preview Report'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!canSubmit || exporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-4">
          {/* Report Metadata */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Report Preview</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {preview.reportMetadata.reportType.replace(/_/g, ' ')} •{' '}
                {preview.reportMetadata.generatedAt}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">
                {preview.reportMetadata.classification}
              </span>
            </div>
          </div>

          {/* Case Section */}
          {preview.case && (
            <div>
              <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-2">Case Identification</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {Object.entries(preview.case)
                  .filter(([k]) => !['members', 'tags'].includes(k))
                  .slice(0, 9)
                  .map(([key, value]) => (
                    <div key={key} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-transparent rounded px-2.5 py-1.5 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">{key}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{String(value ?? '-')}</span>
                      </div>
                      {key === 'caseNumber' && Boolean(value) && (
                        <CopyButton text={String(value)} label="Copy case number" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Incidents */}
          {preview.incidents.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase mb-2">
                Incidents ({preview.incidents.length})
              </h4>
              <div className="space-y-1 text-xs">
                {preview.incidents.map((inc, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-transparent rounded px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">{String(inc.incidentNumber)}</span>
                      {Boolean(inc.incidentNumber) && <CopyButton text={String(inc.incidentNumber)} label="Copy incident number" />}
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 truncate mx-2">{String(inc.title)}</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">{String(inc.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {preview.evidence.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-2">
                Evidence Inventory ({preview.evidence.length})
              </h4>
              <div className="space-y-1 text-xs">
                {preview.evidence.map((ev, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-transparent rounded px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold">{String(ev.evidenceNumber)}</span>
                      {Boolean(ev.evidenceNumber) && <CopyButton text={String(ev.evidenceNumber)} label="Copy evidence number" />}
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 truncate mx-2">{String(ev.originalFilename)}</span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 hidden md:inline">{String(ev.sha256).slice(0, 16)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Advisory */}
          {preview.aiAnalysis.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-600 dark:text-yellow-400 uppercase mb-2">
                AI Analysis ({preview.aiAnalysis.length}) — Advisory Only
              </h4>
              <div className="p-2.5 bg-amber-50 dark:bg-yellow-950/30 border border-amber-200 dark:border-yellow-800/50 rounded-lg mb-2">
                <p className="text-[11px] text-amber-800 dark:text-yellow-500 font-medium">
                  ⚠️ AI-generated content is investigative assistance only and does not
                  constitute a confirmed forensic finding.
                </p>
              </div>
              <div className="space-y-1 text-xs">
                {preview.aiAnalysis.map((ai, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-transparent rounded px-3 py-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-amber-700 dark:text-yellow-300">{String(ai.analysisType)}</span>
                      <span className="text-slate-400 mx-1">—</span>
                      <span className="text-slate-700 dark:text-slate-300">{String(ai.status)}</span>
                    </div>
                    {ai.confidence !== null && (
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        ({((ai.confidence as number) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Executive Summary</h4>
            <p className="text-xs text-slate-800 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-transparent rounded p-3 leading-relaxed">{preview.summary}</p>
          </div>

          {/* Limitations */}
          {preview.limitations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Limitations</h4>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pl-4">
                {preview.limitations.map((lim, i) => (
                  <li key={i} className="list-disc">{lim}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">{preview.disclaimer}</p>
          </div>

          {/* Report Hash */}
          <div className="text-center flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300">
              Report Hash: {preview.reportMetadata.reportHash}
            </span>
            <CopyButton text={preview.reportMetadata.reportHash} label="Copy report hash" />
          </div>
        </div>
      )}
    </div>
  );
};
