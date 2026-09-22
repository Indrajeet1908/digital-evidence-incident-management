import {
  IncidentStatus,
  IncidentPriority,
  IncidentSeverity,
  IncidentType,
  IncidentCategory,
  IncidentSource,
} from '@prisma/client';

export {
  IncidentStatus,
  IncidentPriority,
  IncidentSeverity,
  IncidentType,
  IncidentCategory,
  IncidentSource,
};

export interface SafeUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface CaseSummary {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  priority: string;
  severity: string;
}

export interface IncidentStatusHistorySummary {
  id: string;
  previousStatus: IncidentStatus | null;
  newStatus: IncidentStatus;
  reason: string | null;
  createdAt: Date;
  changedBy: SafeUserSummary;
}

export interface IncidentSummary {
  id: string;
  incidentNumber: string;
  caseId: string;
  title: string;
  description: string | null;
  incidentType: IncidentType;
  category: IncidentCategory;
  severity: IncidentSeverity;
  priority: IncidentPriority;
  status: IncidentStatus;
  source: IncidentSource;
  detectedAt: Date | null;
  occurredAt: Date | null;
  reportedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resolution: string | null;
  createdBy: SafeUserSummary;
  assignedTo: SafeUserSummary | null;
  case?: CaseSummary;
}
