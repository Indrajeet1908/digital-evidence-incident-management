import crypto from 'crypto';

/**
 * Deterministically serializes any JavaScript object or primitive into a canonical JSON string.
 * All object keys are recursively sorted lexicographically to prevent non-deterministic JSON ordering.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`
  );
  return '{' + entries.join(',') + '}';
}

export interface CustodyHashPayload {
  evidenceId: string;
  eventType: string;
  fromUserId: string | null;
  toUserId: string | null;
  actorUserId: string;
  reason: string | null;
  notes: string | null;
  location: string | null;
  eventAt: string | Date;
  previousEventHash: string | null;
}

/**
 * Computes a deterministic SHA-256 event hash for an EvidenceCustodyEvent.
 */
export function computeCustodyEventHash(payload: CustodyHashPayload): string {
  const eventAtIso =
    typeof payload.eventAt === 'string'
      ? payload.eventAt
      : new Date(payload.eventAt).toISOString();

  const canonicalObj = {
    actorUserId: payload.actorUserId,
    eventAt: eventAtIso,
    eventType: payload.eventType,
    evidenceId: payload.evidenceId,
    fromUserId: payload.fromUserId ?? null,
    location: payload.location ?? null,
    notes: payload.notes ?? null,
    previousEventHash: payload.previousEventHash ?? null,
    reason: payload.reason ?? null,
    toUserId: payload.toUserId ?? null,
  };

  const serialized = canonicalize(canonicalObj);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export interface AuditHashPayload {
  evidenceId: string;
  actorUserId: string | null;
  action: string;
  result: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string | Date;
  previousEventHash: string | null;
}

/**
 * Computes a deterministic SHA-256 event hash for an EvidenceAuditLog.
 */
export function computeAuditLogHash(payload: AuditHashPayload): string {
  const createdAtIso =
    typeof payload.createdAt === 'string'
      ? payload.createdAt
      : new Date(payload.createdAt).toISOString();

  const canonicalObj = {
    action: payload.action,
    actorUserId: payload.actorUserId ?? null,
    createdAt: createdAtIso,
    evidenceId: payload.evidenceId,
    ipAddress: payload.ipAddress ?? null,
    metadata: payload.metadata ?? null,
    previousEventHash: payload.previousEventHash ?? null,
    result: payload.result,
    userAgent: payload.userAgent ?? null,
  };

  const serialized = canonicalize(canonicalObj);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
