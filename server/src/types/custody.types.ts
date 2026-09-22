import {
  CustodyEventType,
  EvidenceAuditAction,
  AuditResult,
} from '@prisma/client';

export { CustodyEventType, EvidenceAuditAction, AuditResult };

/**
 * Public representation of an Evidence Custody Event.
 * Strictly excludes password hashes and sensitive user credentials.
 */
export interface EvidenceCustodyEventResponse {
  id: string;
  evidenceId: string;
  eventType: CustodyEventType;
  fromUserId: string | null;
  fromUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  toUserId: string | null;
  toUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  actorUserId: string;
  actorUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reason: string | null;
  notes: string | null;
  location: string | null;
  eventAt: string;
  createdAt: string;
  eventHash: string;
  previousEventHash: string | null;
}

/**
 * Public representation of an Evidence Audit Log entry.
 */
export interface EvidenceAuditLogResponse {
  id: string;
  evidenceId: string;
  actorUserId: string | null;
  actorUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  action: EvidenceAuditAction;
  result: AuditResult;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
  eventHash: string;
  previousEventHash: string | null;
}

/**
 * Result structure for custody integrity chain verification.
 */
export interface CustodyIntegrityResponse {
  evidenceId: string;
  integrity: 'VALID' | 'MISMATCH';
  eventsChecked: number;
}

/**
 * Result structure for audit integrity chain verification.
 */
export interface AuditIntegrityResponse {
  evidenceId: string;
  integrity: 'VALID' | 'MISMATCH';
  eventsChecked: number;
}

/**
 * Current custodian state derived from append-only custody event history.
 */
export interface CurrentCustodianInfo {
  evidenceId: string;
  custodianId: string | null;
  custodian?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  pendingRecipientId: string | null;
  pendingRecipient?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  isSealed: boolean;
  isReleased: boolean;
  lastEvent: {
    id: string;
    eventType: CustodyEventType;
    eventAt: string;
  } | null;
}
