import {
  CaseStatus,
  CasePriority,
  CaseSeverity,
  CaseConfidentiality,
  CaseType,
  CaseCategory,
  CaseMemberRole,
} from '@prisma/client';

export {
  CaseStatus,
  CasePriority,
  CaseSeverity,
  CaseConfidentiality,
  CaseType,
  CaseCategory,
  CaseMemberRole,
};

export interface SafeUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface CaseMemberSummary {
  id: string;
  role: CaseMemberRole;
  createdAt: Date;
  user: SafeUserSummary;
}

export interface CaseStatusHistorySummary {
  id: string;
  previousStatus: CaseStatus | null;
  newStatus: CaseStatus;
  reason: string | null;
  createdAt: Date;
  changedBy: SafeUserSummary;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMetadata;
}
