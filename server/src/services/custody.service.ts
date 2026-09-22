import prisma from '../config/database';
import { AppError } from '../utils/errors';
import {
  computeCustodyEventHash,
  computeAuditLogHash,
} from '../utils/event-hash';
import {
  CustodyEventType,
  EvidenceAuditAction,
  AuditResult,
  EvidenceCustodyEventResponse,
  EvidenceAuditLogResponse,
  CustodyIntegrityResponse,
  AuditIntegrityResponse,
  CurrentCustodianInfo,
} from '../types/custody.types';
import {
  TransferCustodyInput,
  ReceiveCustodyInput,
  SealCustodyInput,
  UnsealCustodyInput,
  ReleaseCustodyInput,
  ListCustodyHistoryQueryInput,
  ListAuditHistoryQueryInput,
} from '../validators/custody.validator';
import { Prisma } from '@prisma/client';

export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCustodyEventResponse(event: any): EvidenceCustodyEventResponse {
  return {
    id: event.id,
    evidenceId: event.evidenceId,
    eventType: event.eventType,
    fromUserId: event.fromUserId ?? null,
    fromUser: event.fromUser
      ? {
          id: event.fromUser.id,
          firstName: event.fromUser.firstName,
          lastName: event.fromUser.lastName,
          email: event.fromUser.email,
        }
      : null,
    toUserId: event.toUserId ?? null,
    toUser: event.toUser
      ? {
          id: event.toUser.id,
          firstName: event.toUser.firstName,
          lastName: event.toUser.lastName,
          email: event.toUser.email,
        }
      : null,
    actorUserId: event.actorUserId,
    actorUser: event.actorUser
      ? {
          id: event.actorUser.id,
          firstName: event.actorUser.firstName,
          lastName: event.actorUser.lastName,
          email: event.actorUser.email,
        }
      : undefined,
    reason: event.reason ?? null,
    notes: event.notes ?? null,
    location: event.location ?? null,
    eventAt: new Date(event.eventAt).toISOString(),
    createdAt: new Date(event.createdAt).toISOString(),
    eventHash: event.eventHash,
    previousEventHash: event.previousEventHash ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAuditLogResponse(log: any): EvidenceAuditLogResponse {
  return {
    id: log.id,
    evidenceId: log.evidenceId,
    actorUserId: log.actorUserId ?? null,
    actorUser: log.actorUser
      ? {
          id: log.actorUser.id,
          firstName: log.actorUser.firstName,
          lastName: log.actorUser.lastName,
          email: log.actorUser.email,
        }
      : null,
    action: log.action,
    result: log.result,
    ipAddress: log.ipAddress ?? null,
    userAgent: log.userAgent ?? null,
    metadata: log.metadata,
    createdAt: new Date(log.createdAt).toISOString(),
    eventHash: log.eventHash,
    previousEventHash: log.previousEventHash ?? null,
  };
}

export class CustodyService {
  /**
   * Appends an immutable custody event within a transaction or standalone.
   * Derives the previousEventHash and calculates the deterministic eventHash server-side.
   */
  async appendCustodyEvent(
    tx: Prisma.TransactionClient,
    data: {
      evidenceId: string;
      eventType: CustodyEventType;
      fromUserId?: string | null;
      toUserId?: string | null;
      actorUserId: string;
      reason?: string | null;
      notes?: string | null;
      location?: string | null;
      eventAt?: Date;
    }
  ) {
    const lastEvent = await tx.evidenceCustodyEvent.findFirst({
      where: { evidenceId: data.evidenceId },
      orderBy: { createdAt: 'desc' },
      select: { eventHash: true },
    });

    const previousEventHash = lastEvent?.eventHash ?? null;
    const eventAt = data.eventAt ?? new Date();

    const eventHash = computeCustodyEventHash({
      evidenceId: data.evidenceId,
      eventType: data.eventType,
      fromUserId: data.fromUserId ?? null,
      toUserId: data.toUserId ?? null,
      actorUserId: data.actorUserId,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      location: data.location ?? null,
      eventAt,
      previousEventHash,
    });

    return tx.evidenceCustodyEvent.create({
      data: {
        evidenceId: data.evidenceId,
        eventType: data.eventType,
        fromUserId: data.fromUserId ?? null,
        toUserId: data.toUserId ?? null,
        actorUserId: data.actorUserId,
        reason: data.reason ?? null,
        notes: data.notes ?? null,
        location: data.location ?? null,
        eventAt,
        eventHash,
        previousEventHash,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        actorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Appends an immutable audit log entry.
   * Derives previousEventHash and calculates deterministic eventHash server-side.
   */
  async appendAuditLog(
    dbClient: Prisma.TransactionClient | typeof prisma,
    data: {
      evidenceId: string;
      actorUserId?: string | null;
      action: EvidenceAuditAction;
      result?: AuditResult;
      ipAddress?: string | null;
      userAgent?: string | null;
      metadata?: unknown;
    }
  ) {
    const lastLog = await dbClient.evidenceAuditLog.findFirst({
      where: { evidenceId: data.evidenceId },
      orderBy: { createdAt: 'desc' },
      select: { eventHash: true },
    });

    const previousEventHash = lastLog?.eventHash ?? null;
    const createdAt = new Date();
    const result = data.result ?? AuditResult.SUCCESS;

    const eventHash = computeAuditLogHash({
      evidenceId: data.evidenceId,
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      result,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      metadata: data.metadata ?? null,
      createdAt,
      previousEventHash,
    });

    return dbClient.evidenceAuditLog.create({
      data: {
        evidenceId: data.evidenceId,
        actorUserId: data.actorUserId ?? null,
        action: data.action,
        result,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        createdAt,
        eventHash,
        previousEventHash,
      },
      include: {
        actorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Derives current custodian state from chronological custody events.
   */
  async getCurrentCustodian(evidenceId: string): Promise<CurrentCustodianInfo> {
    const events = await prisma.evidenceCustodyEvent.findMany({
      where: { evidenceId },
      orderBy: { createdAt: 'asc' },
      include: {
        toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (events.length === 0) {
      return {
        evidenceId,
        custodianId: null,
        custodian: null,
        pendingRecipientId: null,
        pendingRecipient: null,
        isSealed: false,
        isReleased: false,
        lastEvent: null,
      };
    }

    let custodianId: string | null = null;
    let custodianUser: { id: string; firstName: string; lastName: string; email: string } | null = null;
    let pendingRecipientId: string | null = null;
    let pendingRecipientUser: { id: string; firstName: string; lastName: string; email: string } | null = null;
    let isSealed = false;
    let isReleased = false;

    for (const evt of events) {
      switch (evt.eventType) {
        case CustodyEventType.UPLOADED:
        case CustodyEventType.COLLECTED:
        case CustodyEventType.STORED:
          custodianId = evt.toUserId;
          custodianUser = evt.toUser ?? null;
          pendingRecipientId = null;
          pendingRecipientUser = null;
          break;
        case CustodyEventType.TRANSFERRED:
          // In custody transfer: toUser is the intended recipient
          pendingRecipientId = evt.toUserId;
          pendingRecipientUser = evt.toUser ?? null;
          custodianId = evt.toUserId;
          custodianUser = evt.toUser ?? null;
          break;
        case CustodyEventType.RECEIVED:
        case CustodyEventType.RETURNED:
          custodianId = evt.toUserId;
          custodianUser = evt.toUser ?? null;
          pendingRecipientId = null;
          pendingRecipientUser = null;
          break;
        case CustodyEventType.SEALED:
          isSealed = true;
          break;
        case CustodyEventType.UNSEALED:
          isSealed = false;
          break;
        case CustodyEventType.RELEASED:
          isReleased = true;
          custodianId = null;
          custodianUser = null;
          pendingRecipientId = null;
          pendingRecipientUser = null;
          break;
        default:
          break;
      }
    }

    const last = events.length > 0 ? events[events.length - 1] : undefined;

    return {
      evidenceId,
      custodianId,
      custodian: custodianUser,
      pendingRecipientId,
      pendingRecipient: pendingRecipientUser,
      isSealed,
      isReleased,
      lastEvent: last
        ? {
            id: last.id,
            eventType: last.eventType,
            eventAt: new Date(last.eventAt).toISOString(),
          }
        : null,
    };
  }

  /**
   * Initiates an evidence custody transfer to another active system user.
   */
  async transferCustody(
    evidenceId: string,
    input: TransferCustodyInput,
    actorId: string,
    ctx?: AuditContext
  ): Promise<EvidenceCustodyEventResponse> {
    return prisma.$transaction(async (tx) => {
      // 1. Verify Evidence exists
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
        select: { id: true, evidenceNumber: true },
      });
      if (!evidence) {
        throw new AppError('Evidence not found', 404);
      }

      // 2. Verify Recipient User exists and is active
      const targetUser = await tx.user.findUnique({
        where: { id: input.toUserId },
        select: { id: true, isActive: true, firstName: true, lastName: true },
      });
      if (!targetUser) {
        throw new AppError('Target recipient user not found', 404);
      }
      if (!targetUser.isActive) {
        throw new AppError('Cannot transfer evidence to an inactive user', 400);
      }

      // 3. Inspect current custody state
      const state = await this.getCurrentCustodian(evidenceId);
      if (state.isReleased) {
        throw new AppError('Cannot transfer custody of released evidence', 400);
      }

      const fromUserId = state.custodianId ?? actorId;

      // 4. Record TRANSFERRED custody event
      const event = await this.appendCustodyEvent(tx, {
        evidenceId,
        eventType: CustodyEventType.TRANSFERRED,
        fromUserId,
        toUserId: input.toUserId,
        actorUserId: actorId,
        reason: input.reason,
        notes: input.notes,
        location: input.location,
      });

      // 5. Record corresponding CUSTODY_TRANSFERRED audit log
      await this.appendAuditLog(tx, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.CUSTODY_TRANSFERRED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          fromUserId,
          toUserId: input.toUserId,
          reason: input.reason,
          location: input.location,
        },
      });

      return formatCustodyEventResponse(event);
    });
  }

  /**
   * Acknowledges and completes custody receipt by the designated recipient.
   */
  async receiveCustody(
    evidenceId: string,
    input: ReceiveCustodyInput,
    actorId: string,
    ctx?: AuditContext
  ): Promise<EvidenceCustodyEventResponse> {
    return prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      });
      if (!evidence) {
        throw new AppError('Evidence not found', 404);
      }

      const lastCustody = await tx.evidenceCustodyEvent.findFirst({
        where: { evidenceId },
        orderBy: { createdAt: 'desc' },
      });

      if (!lastCustody || lastCustody.eventType !== CustodyEventType.TRANSFERRED) {
        throw new AppError(
          'There is no pending custody transfer to receive for this evidence',
          400
        );
      }

      if (lastCustody.toUserId !== actorId) {
        throw new AppError(
          'You are not the designated recipient for this custody transfer',
          403
        );
      }

      const event = await this.appendCustodyEvent(tx, {
        evidenceId,
        eventType: CustodyEventType.RECEIVED,
        fromUserId: lastCustody.fromUserId,
        toUserId: actorId,
        actorUserId: actorId,
        reason: input.reason || 'Custody received and acknowledged by designated recipient',
        notes: input.notes,
        location: input.location,
      });

      await this.appendAuditLog(tx, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.CUSTODY_RECEIVED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          receivedFromUserId: lastCustody.fromUserId,
          receiverUserId: actorId,
        },
      });

      return formatCustodyEventResponse(event);
    });
  }

  /**
   * Seals evidence with an immutable SEALED event.
   */
  async sealEvidence(
    evidenceId: string,
    input: SealCustodyInput,
    actorId: string,
    ctx?: AuditContext
  ): Promise<EvidenceCustodyEventResponse> {
    return prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      });
      if (!evidence) {
        throw new AppError('Evidence not found', 404);
      }

      const state = await this.getCurrentCustodian(evidenceId);
      if (state.isReleased) {
        throw new AppError('Cannot seal released evidence', 400);
      }
      if (state.isSealed) {
        throw new AppError('Evidence is already sealed', 400);
      }

      const event = await this.appendCustodyEvent(tx, {
        evidenceId,
        eventType: CustodyEventType.SEALED,
        fromUserId: state.custodianId,
        toUserId: state.custodianId,
        actorUserId: actorId,
        reason: input.reason,
        notes: input.notes,
      });

      await this.appendAuditLog(tx, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.SEALED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: { reason: input.reason },
      });

      return formatCustodyEventResponse(event);
    });
  }

  /**
   * Unseals evidence with an immutable UNSEALED event.
   */
  async unsealEvidence(
    evidenceId: string,
    input: UnsealCustodyInput,
    actorId: string,
    ctx?: AuditContext
  ): Promise<EvidenceCustodyEventResponse> {
    return prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      });
      if (!evidence) {
        throw new AppError('Evidence not found', 404);
      }

      const state = await this.getCurrentCustodian(evidenceId);
      if (state.isReleased) {
        throw new AppError('Cannot unseal released evidence', 400);
      }
      if (!state.isSealed) {
        throw new AppError('Evidence is not currently sealed', 400);
      }

      const event = await this.appendCustodyEvent(tx, {
        evidenceId,
        eventType: CustodyEventType.UNSEALED,
        fromUserId: state.custodianId,
        toUserId: state.custodianId,
        actorUserId: actorId,
        reason: input.reason,
        notes: input.notes,
      });

      await this.appendAuditLog(tx, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.UNSEALED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: { reason: input.reason },
      });

      return formatCustodyEventResponse(event);
    });
  }

  /**
   * Releases evidence lifecycle with an immutable RELEASED event (ADMIN only).
   */
  async releaseEvidence(
    evidenceId: string,
    input: ReleaseCustodyInput,
    actorId: string,
    ctx?: AuditContext
  ): Promise<EvidenceCustodyEventResponse> {
    return prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      });
      if (!evidence) {
        throw new AppError('Evidence not found', 404);
      }

      const state = await this.getCurrentCustodian(evidenceId);
      if (state.isReleased) {
        throw new AppError('Evidence is already released', 400);
      }

      const event = await this.appendCustodyEvent(tx, {
        evidenceId,
        eventType: CustodyEventType.RELEASED,
        fromUserId: state.custodianId,
        toUserId: null,
        actorUserId: actorId,
        reason: input.reason,
        notes: input.notes,
        location: input.location,
      });

      await this.appendAuditLog(tx, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.RELEASED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: { reason: input.reason, location: input.location },
      });

      return formatCustodyEventResponse(event);
    });
  }

  /**
   * Verifies the cryptographic chain of custody for an evidence record.
   * Never mutates or repairs broken history.
   */
  async verifyCustodyIntegrity(evidenceId: string): Promise<CustodyIntegrityResponse> {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true },
    });
    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    const events = await prisma.evidenceCustodyEvent.findMany({
      where: { evidenceId },
      orderBy: { createdAt: 'asc' },
    });

    if (events.length === 0) {
      return {
        evidenceId,
        integrity: 'VALID',
        eventsChecked: 0,
      };
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;

      // Rule 1: First event must have previousEventHash === null
      if (i === 0 && event.previousEventHash !== null) {
        return { evidenceId, integrity: 'MISMATCH', eventsChecked: i + 1 };
      }

      // Rule 2: Subsequent events must reference preceding event's eventHash
      const prevEvent = i > 0 ? events[i - 1] : undefined;
      if (i > 0 && (!prevEvent || event.previousEventHash !== prevEvent.eventHash)) {
        return { evidenceId, integrity: 'MISMATCH', eventsChecked: i + 1 };
      }

      // Rule 3: Recomputed eventHash must exactly match stored eventHash
      const recomputedHash = computeCustodyEventHash({
        evidenceId: event.evidenceId,
        eventType: event.eventType,
        fromUserId: event.fromUserId,
        toUserId: event.toUserId,
        actorUserId: event.actorUserId,
        reason: event.reason,
        notes: event.notes,
        location: event.location,
        eventAt: event.eventAt,
        previousEventHash: event.previousEventHash,
      });

      if (recomputedHash.toLowerCase() !== event.eventHash.toLowerCase()) {
        return { evidenceId, integrity: 'MISMATCH', eventsChecked: i + 1 };
      }
    }

    return {
      evidenceId,
      integrity: 'VALID',
      eventsChecked: events.length,
    };
  }

  /**
   * Verifies the cryptographic audit event chain for an evidence record.
   */
  async verifyAuditIntegrity(evidenceId: string): Promise<AuditIntegrityResponse> {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true },
    });
    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    const logs = await prisma.evidenceAuditLog.findMany({
      where: { evidenceId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return {
        evidenceId,
        integrity: 'VALID',
        eventsChecked: 0,
      };
    }

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (!log) continue;

      if (i === 0 && log.previousEventHash !== null) {
        return { evidenceId, integrity: 'MISMATCH', eventsChecked: i + 1 };
      }

      const prevLog = i > 0 ? logs[i - 1] : undefined;
      if (i > 0 && (!prevLog || log.previousEventHash !== prevLog.eventHash)) {
        return { evidenceId, integrity: 'MISMATCH', eventsChecked: i + 1 };
      }

      const recomputedHash = computeAuditLogHash({
        evidenceId: log.evidenceId,
        actorUserId: log.actorUserId,
        action: log.action,
        result: log.result,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata,
        createdAt: log.createdAt,
        previousEventHash: log.previousEventHash,
      });

      if (recomputedHash.toLowerCase() !== log.eventHash.toLowerCase()) {
        return { evidenceId, integrity: 'MISMATCH', eventsChecked: i + 1 };
      }
    }

    return {
      evidenceId,
      integrity: 'VALID',
      eventsChecked: logs.length,
    };
  }

  /**
   * Lists custody event history for an evidence record with pagination.
   */
  async listCustodyHistory(
    evidenceId: string,
    query: ListCustodyHistoryQueryInput
  ) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true },
    });
    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [total, events] = await Promise.all([
      prisma.evidenceCustodyEvent.count({ where: { evidenceId } }),
      prisma.evidenceCustodyEvent.findMany({
        where: { evidenceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          toUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          actorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: events.map(formatCustodyEventResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Lists audit history for an evidence record with filters and pagination.
   */
  async listAuditHistory(evidenceId: string, query: ListAuditHistoryQueryInput) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true },
    });
    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    const { action, result, actorUserId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EvidenceAuditLogWhereInput = { evidenceId };
    if (action) where.action = action;
    if (result) where.result = result;
    if (actorUserId) where.actorUserId = actorUserId;

    const [total, logs] = await Promise.all([
      prisma.evidenceAuditLog.count({ where }),
      prisma.evidenceAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: logs.map(formatAuditLogResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

export const custodyService = new CustodyService();
