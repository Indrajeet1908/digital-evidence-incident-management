export type AlertSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface NormalizedActivityItem {
  id: string;
  timestamp: string;
  type: string;
  actor: {
    id: string | null;
    name: string;
  };
  entityType: 'CASE' | 'INCIDENT' | 'EVIDENCE' | 'AI_ANALYSIS';
  entityId: string;
  entityReference?: string;
  description: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
}

export interface InvestigationOverviewResponse {
  cases: {
    total: number;
    open: number;
    inProgress: number;
    closed: number;
  };
  incidents: {
    total: number;
    open: number;
    investigating: number;
    contained: number;
    resolved: number;
    closed: number;
  };
  evidence: {
    total: number;
    recent: number;
    integrityVerified: number;
    integrityFailures: number;
  };
  ai: {
    totalAnalyses: number;
    completed: number;
    failed: number;
    pending: number;
  };
  custody: {
    recentTransfers: number;
  };
  recentActivity: NormalizedActivityItem[];
}

export interface CaseInvestigationSummaryResponse {
  case: {
    id: string;
    caseNumber: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    severity: string;
    caseType: string;
    category: string;
    createdAt: string;
    updatedAt: string;
    leadInvestigator: { id: string; name: string } | null;
    members: Array<{ id: string; name: string; role: string }>;
    tags: string[];
    closureReason: string | null;
  };
  incidentSummary: {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byPriority: Record<string, number>;
    incidents: Array<{
      id: string;
      incidentNumber: string;
      title: string;
      status: string;
      severity: string;
      priority: string;
      detectedAt: string | null;
    }>;
  };
  evidenceSummary: {
    total: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    integrity: {
      verified: number;
      failures: number;
      unverified: number;
    };
    recentEvidence: Array<{
      id: string;
      evidenceNumber: string;
      originalFilename: string;
      evidenceType: string;
      fileSize: number;
      sha256: string;
      createdAt: string;
      latestIntegrity: string;
    }>;
  };
  aiSummary: {
    totalAnalyses: number;
    completed: number;
    failed: number;
    latestFindings: Array<{
      title: string;
      description: string;
      severity: string;
      confidence: number;
    }>;
    latestSummaries: Array<{
      id: string;
      analysisType: string;
      summary: string;
      confidence: number | null;
      completedAt: string | null;
    }>;
  };
  custodySummary: {
    currentCustodyState: string;
    recentEvents: Array<{
      id: string;
      eventType: string;
      actor: string;
      fromUser: string | null;
      toUser: string | null;
      reason: string | null;
      eventAt: string;
    }>;
  };
  activitySummary: {
    recentAuditEvents: Array<{
      id: string;
      action: string;
      result: string;
      actor: string;
      timestamp: string;
    }>;
  };
}

export interface ActivityTimelineResponse {
  items: NormalizedActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IncidentIntelligenceItem {
  id: string;
  incidentNumber: string;
  title: string;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  };
  type: string;
  category: string;
  severity: string;
  priority: string;
  status: string;
  assignedInvestigator: {
    id: string;
    name: string;
  } | null;
  detectedAt: string | null;
  updatedAt: string;
  evidenceCount: number;
  aiAnalysisCount: number;
  latestAIClassification: {
    classification: string;
    confidence: number;
    summary: string;
  } | null;
}

export interface IncidentIntelligenceResponse {
  items: IncidentIntelligenceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EvidenceIntelligenceItem {
  id: string;
  evidenceNumber: string;
  filename: string;
  evidenceType: string;
  source: string;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  };
  incident: {
    id: string;
    incidentNumber: string;
    title: string;
  } | null;
  fileSize: number;
  uploadedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  sha256: string;
  latestIntegrityResult: 'VALID' | 'MISMATCH' | 'UNVERIFIED';
  currentCustody: {
    custodianId: string | null;
    custodianName: string | null;
    isSealed: boolean;
    isReleased: boolean;
  };
  aiAnalysisCount: number;
}

export interface EvidenceIntelligenceResponse {
  items: EvidenceIntelligenceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AIIntelligenceResponse {
  totalAnalyses: number;
  analysesByType: Record<string, number>;
  analysesByStatus: Record<string, number>;
  averageConfidence: number | null;
  commonIndicatorTypes: Record<string, number>;
  recentAnalyses: Array<{
    id: string;
    evidenceId: string | null;
    evidenceNumber?: string;
    analysisType: string;
    status: string;
    confidence: number | null;
    createdAt: string;
  }>;
  recentFindings: Array<{
    title: string;
    description: string;
    severity: string;
    confidence: number;
    evidenceId?: string;
    evidenceNumber?: string;
  }>;
}

export interface InvestigationAlertItem {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface InvestigationAlertsResponse {
  alerts: InvestigationAlertItem[];
  total: number;
}

export interface UnifiedSearchResponse {
  cases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    priority: string;
  }>;
  incidents: Array<{
    id: string;
    incidentNumber: string;
    title: string;
    status: string;
    severity: string;
    caseNumber: string;
  }>;
  evidence: Array<{
    id: string;
    evidenceNumber: string;
    originalFilename: string;
    evidenceType: string;
    caseNumber: string;
  }>;
}
