/**
 * Report types and structured content model for Milestone 11:
 * Reporting & Investigation Report Generation.
 *
 * Reports are stateless read-only records of investigation state.
 * They never alter underlying case, incident, evidence, custody, audit, or AI records.
 */

// ─── Report Type Enum ────────────────────────────────────────────
export const REPORT_TYPES = {
  INVESTIGATION_SUMMARY: 'INVESTIGATION_SUMMARY',
  DETAILED_CASE_REPORT: 'DETAILED_CASE_REPORT',
  INCIDENT_REPORT: 'INCIDENT_REPORT',
  EVIDENCE_REPORT: 'EVIDENCE_REPORT',
  CHAIN_OF_CUSTODY_REPORT: 'CHAIN_OF_CUSTODY_REPORT',
  AI_ANALYSIS_REPORT: 'AI_ANALYSIS_REPORT',
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

// ─── Report Generation Input ─────────────────────────────────────
export interface ReportGenerationInput {
  reportType: ReportType;
  caseId?: string;
  incidentId?: string;
  evidenceId?: string;
  includeAI?: boolean;
  includeAudit?: boolean;
  includeCustody?: boolean;
}

// ─── Report Metadata ─────────────────────────────────────────────
export interface ReportMetadata {
  reportType: ReportType;
  generatedAt: string;
  generatedBy: {
    id: string;
    name: string;
    role: string;
  };
  caseNumber?: string;
  incidentNumber?: string;
  evidenceNumber?: string;
  classification?: string;
  reportHash: string;
}

// ─── Section: Case Identification ────────────────────────────────
export interface CaseIdentificationSection {
  caseNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  severity: string;
  caseType: string;
  category: string;
  classification: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closureReason: string | null;
  leadInvestigator: string | null;
  members: Array<{ name: string; role: string }>;
  tags: string[];
}

// ─── Section: Incident ───────────────────────────────────────────
export interface IncidentSectionItem {
  incidentNumber: string;
  title: string;
  type: string;
  category: string;
  severity: string;
  priority: string;
  status: string;
  source: string;
  description: string | null;
  detectedAt: string | null;
  occurredAt: string | null;
  reportedAt: string | null;
  resolvedAt: string | null;
  assignedInvestigator: string | null;
  resolution: string | null;
  aiClassification?: {
    classification: string;
    confidence: number;
    summary: string;
    disclaimer: string;
  } | null;
}

// ─── Section: Evidence Inventory ─────────────────────────────────
export interface EvidenceInventoryItem {
  evidenceNumber: string;
  originalFilename: string;
  evidenceType: string;
  source: string;
  fileSize: number;
  mimeType: string;
  caseNumber: string;
  incidentNumber: string | null;
  uploadedBy: string;
  collectedAt: string | null;
  createdAt: string;
  sha256: string;
  description: string | null;
}

// ─── Section: Evidence Integrity ─────────────────────────────────
export interface EvidenceIntegrityItem {
  evidenceNumber: string;
  storedSha256: string;
  latestCalculatedSha256: string | null;
  integrityStatus: 'VALID' | 'MISMATCH' | 'NOT_VERIFIED';
  verificationTimestamp: string | null;
  integrityFailures: number;
  note: string;
}

// ─── Section: Custody Event ──────────────────────────────────────
export interface CustodyEventItem {
  eventTimestamp: string;
  eventType: string;
  fromUser: string | null;
  toUser: string | null;
  actor: string;
  reason: string | null;
  location: string | null;
  notes: string | null;
  isTamperEvident: boolean;
  eventHash: string;
}

// ─── Section: Audit ──────────────────────────────────────────────
export interface AuditItem {
  action: string;
  result: string;
  actor: string;
  timestamp: string;
  entityType: string;
  entityReference: string;
  metadata: Record<string, unknown> | null;
}

// ─── Section: AI Finding ─────────────────────────────────────────
export interface AIFindingItem {
  analysisType: string;
  provider: string;
  model: string;
  status: string;
  generatedAt: string;
  completedAt: string | null;
  summary: string | null;
  confidence: number | null;
  classification?: string | null;
  severity?: string | null;
  findings: Array<{
    title: string;
    description: string;
    severity: string;
    confidence: number;
  }>;
  indicators: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  recommendedActions: string[];
  aiInputHash: string;
  disclaimer: string;
  errorMessage?: string | null;
}

// ─── Section: Activity Timeline ──────────────────────────────────
export interface ActivityTimelineItem {
  timestamp: string;
  type: string;
  actor: string;
  entityType: string;
  entityReference: string;
  description: string;
  result: string;
}

// ─── Full Investigation Report ───────────────────────────────────
export interface InvestigationReport {
  reportMetadata: ReportMetadata;
  case: CaseIdentificationSection | null;
  incidents: IncidentSectionItem[];
  evidence: EvidenceInventoryItem[];
  integrity: EvidenceIntegrityItem[];
  custody: CustodyEventItem[];
  audit: AuditItem[];
  aiAnalysis: AIFindingItem[];
  activityTimeline: ActivityTimelineItem[];
  summary: string;
  limitations: string[];
  disclaimer: string;
}

// ─── AI Disclaimer Constant ─────────────────────────────────────
export const AI_ADVISORY_DISCLAIMER =
  'AI-generated content is investigative assistance only and does not ' +
  'constitute a confirmed forensic finding or autonomous decision. ' +
  'All AI classifications, summaries, and extracted indicators require ' +
  'human investigator corroboration before being treated as established fact.';

export const REPORT_DISCLAIMER =
  'This report was generated from platform records as of the generation timestamp. ' +
  'It represents a point-in-time snapshot of investigation data and does not constitute ' +
  'a final forensic determination. All AI-assisted content is advisory only.';
