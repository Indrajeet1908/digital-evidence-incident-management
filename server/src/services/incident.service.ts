import prisma from '../config/database';
import { IncidentStatus, Prisma } from '@prisma/client';
import {
  CreateIncidentInput,
  UpdateIncidentInput,
  UpdateIncidentStatusInput,
  ListIncidentsQueryInput,
} from '../validators/incident.validator';
import { generateIncidentNumber } from '../utils/incident-number';
import { AppError } from '../utils/errors';
import { AuthUser } from '../types/auth.types';
import { PaginatedResult } from '../types/case.types';

const safeUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  isActive: true,
  role: {
    select: {
      name: true,
    },
  },
};

const safeCaseSelect = {
  id: true,
  caseNumber: true,
  title: true,
  status: true,
  priority: true,
  severity: true,
};

function formatUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive?: boolean;
  role: { name: string };
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role.name,
    ...(user.isActive !== undefined ? { isActive: user.isActive } : {}),
  };
}

export class IncidentService {
  /**
   * Creates a new Incident associated with an existing Case within a transaction.
   * - Validates target Case existence and status (cannot add to CLOSED case)
   * - Validates assigned user active status if assigned
   * - Generates unique incidentNumber server-side (INC-YYYY-XXXX)
   * - Sets initial status to OPEN
   * - Appends initial status audit record in IncidentStatusHistory
   */
  async createIncident(input: CreateIncidentInput, creatorId: string) {
    // 1. Verify Case exists and is active
    const targetCase = await prisma.case.findUnique({
      where: { id: input.caseId },
      select: { id: true, status: true, title: true },
    });

    if (!targetCase) {
      throw new AppError('Associated Case was not found', 404);
    }

    if (targetCase.status === 'CLOSED') {
      throw new AppError('Cannot create an incident against a closed case', 400);
    }

    // 2. Verify assigned user if specified
    if (input.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: input.assignedToId },
        include: { role: true },
      });

      if (!assignedUser || !assignedUser.isActive) {
        throw new AppError('Assigned user does not exist or is inactive', 400);
      }
    }

    // 3. Atomically create Incident + IncidentStatusHistory
    return await prisma.$transaction(async (tx) => {
      const incidentNumber = await generateIncidentNumber(tx);

      const createdIncident = await tx.incident.create({
        data: {
          incidentNumber,
          caseId: input.caseId,
          title: input.title,
          description: input.description,
          incidentType: input.incidentType,
          category: input.category,
          severity: input.severity,
          priority: input.priority,
          status: IncidentStatus.OPEN,
          source: input.source,
          detectedAt: input.detectedAt,
          occurredAt: input.occurredAt,
          reportedAt: input.reportedAt,
          createdById: creatorId,
          assignedToId: input.assignedToId,
        },
        include: {
          case: { select: safeCaseSelect },
          createdBy: { select: safeUserSelect },
          assignedTo: { select: safeUserSelect },
        },
      });

      // Initial audit record
      await tx.incidentStatusHistory.create({
        data: {
          incidentId: createdIncident.id,
          previousStatus: null,
          newStatus: IncidentStatus.OPEN,
          changedById: creatorId,
          reason: 'Initial incident creation',
        },
      });

      return {
        ...createdIncident,
        createdBy: formatUser(createdIncident.createdBy),
        assignedTo: createdIncident.assignedTo
          ? formatUser(createdIncident.assignedTo)
          : null,
      };
    });
  }

  /**
   * Lists incidents with filtering, search, and pagination.
   */
  async listIncidents(
    query: ListIncidentsQueryInput,
    _user: AuthUser
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.IncidentWhereInput = {};

    if (query.caseId) where.caseId = query.caseId;
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.priority) where.priority = query.priority;
    if (query.incidentType) where.incidentType = query.incidentType;
    if (query.category) where.category = query.category;
    if (query.assignedToId) where.assignedToId = query.assignedToId;

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { incidentNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.incident.count({ where });
    const skip = (query.page - 1) * query.limit;
    const totalPages = Math.ceil(total / query.limit) || 1;

    const incidents = await prisma.incident.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        case: { select: safeCaseSelect },
        createdBy: { select: safeUserSelect },
        assignedTo: { select: safeUserSelect },
        _count: {
          select: {
            statusHistory: true,
          },
        },
      },
    });

    const data = incidents.map((inc) => ({
      id: inc.id,
      incidentNumber: inc.incidentNumber,
      caseId: inc.caseId,
      title: inc.title,
      description: inc.description,
      incidentType: inc.incidentType,
      category: inc.category,
      severity: inc.severity,
      priority: inc.priority,
      status: inc.status,
      source: inc.source,
      detectedAt: inc.detectedAt,
      occurredAt: inc.occurredAt,
      reportedAt: inc.reportedAt,
      resolvedAt: inc.resolvedAt,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
      resolution: inc.resolution,
      case: inc.case,
      createdBy: formatUser(inc.createdBy),
      assignedTo: inc.assignedTo ? formatUser(inc.assignedTo) : null,
      statusHistoryCount: inc._count.statusHistory,
    }));

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves an incident by ID including associated Case, creator, assigned user,
   * and complete status history audit log.
   */
  async getIncidentById(incidentId: string) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        case: { select: safeCaseSelect },
        createdBy: { select: safeUserSelect },
        assignedTo: { select: safeUserSelect },
        evidence: {
          select: {
            id: true,
            evidenceNumber: true,
            originalFilename: true,
            evidenceType: true,
            fileSize: true,
            mimeType: true,
            sha256: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        aiAnalyses: {
          select: {
            id: true,
            analysisType: true,
            status: true,
            summary: true,
            result: true,
            provider: true,
            model: true,
            confidence: true,
            inputHash: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          include: {
            changedBy: { select: safeUserSelect },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    return {
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      caseId: incident.caseId,
      title: incident.title,
      description: incident.description,
      incidentType: incident.incidentType,
      category: incident.category,
      severity: incident.severity,
      priority: incident.priority,
      status: incident.status,
      source: incident.source,
      detectedAt: incident.detectedAt,
      occurredAt: incident.occurredAt,
      reportedAt: incident.reportedAt,
      resolvedAt: incident.resolvedAt,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      resolution: incident.resolution,
      case: incident.case,
      createdBy: formatUser(incident.createdBy),
      assignedTo: incident.assignedTo ? formatUser(incident.assignedTo) : null,
      evidence: (incident.evidence || []).map((ev) => ({
        id: ev.id,
        evidenceNumber: ev.evidenceNumber,
        originalFilename: ev.originalFilename,
        evidenceType: ev.evidenceType,
        fileSize: Number(ev.fileSize),
        mimeType: ev.mimeType,
        sha256: ev.sha256,
        createdAt: ev.createdAt,
      })),
      aiAnalyses: (incident.aiAnalyses || []).map((ai) => ({
        id: ai.id,
        analysisType: ai.analysisType,
        status: ai.status,
        summary: ai.summary,
        result: ai.result,
        provider: ai.provider,
        model: ai.model,
        confidence: ai.confidence,
        inputHash: ai.inputHash,
        createdAt: ai.createdAt,
        completedAt: ai.completedAt,
      })),
      statusHistory: incident.statusHistory.map((h) => ({
        id: h.id,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        reason: h.reason,
        createdAt: h.createdAt,
        changedBy: formatUser(h.changedBy),
      })),
    };
  }

  /**
   * Updates non-critical incident metadata.
   * Protected fields (id, incidentNumber, caseId, createdById, resolvedAt, status) cannot be modified.
   */
  async updateIncident(incidentId: string, input: UpdateIncidentInput) {
    const existing = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!existing) {
      throw new AppError('Incident not found', 404);
    }

    if (input.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: input.assignedToId },
        include: { role: true },
      });

      if (!assignedUser || !assignedUser.isActive) {
        throw new AppError('Assigned user does not exist or is inactive', 400);
      }
    }

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.incidentType !== undefined && { incidentType: input.incidentType }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.severity !== undefined && { severity: input.severity }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.detectedAt !== undefined && { detectedAt: input.detectedAt }),
        ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
        ...(input.reportedAt !== undefined && { reportedAt: input.reportedAt }),
        ...(input.assignedToId !== undefined && { assignedToId: input.assignedToId }),
        ...(input.resolution !== undefined && { resolution: input.resolution }),
      },
      include: {
        case: { select: safeCaseSelect },
        createdBy: { select: safeUserSelect },
        assignedTo: { select: safeUserSelect },
      },
    });

    return {
      ...updated,
      createdBy: formatUser(updated.createdBy),
      assignedTo: updated.assignedTo ? formatUser(updated.assignedTo) : null,
    };
  }

  /**
   * Transitions an Incident status and creates an immutable status history audit log.
   * - If transitioning to RESOLVED: automatically timestamps resolvedAt server-side
   * - If transitioning to CLOSED: requires closure reason or resolution note
   * - If reopening: clears resolvedAt
   */
  async changeStatus(
    incidentId: string,
    input: UpdateIncidentStatusInput,
    actingUserId: string
  ) {
    const existing = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!existing) {
      throw new AppError('Incident not found', 404);
    }

    if (existing.status === input.status) {
      throw new AppError(
        `Incident is already in ${input.status} status`,
        400
      );
    }

    const isResolving = input.status === IncidentStatus.RESOLVED;
    const isClosing = input.status === IncidentStatus.CLOSED;
    const isReopening =
      (existing.status === IncidentStatus.RESOLVED ||
        existing.status === IncidentStatus.CLOSED) &&
      input.status !== IncidentStatus.RESOLVED &&
      input.status !== IncidentStatus.CLOSED;

    return await prisma.$transaction(async (tx) => {
      // 1. Update Incident record
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: input.status,
          ...(isResolving && {
            resolvedAt: new Date(),
            ...(input.reason && { resolution: input.reason }),
          }),
          ...(isClosing && {
            ...(!existing.resolvedAt && { resolvedAt: new Date() }),
            ...(input.reason && { resolution: input.reason }),
          }),
          ...(isReopening && {
            resolvedAt: null,
          }),
        },
        include: {
          case: { select: safeCaseSelect },
          createdBy: { select: safeUserSelect },
          assignedTo: { select: safeUserSelect },
        },
      });

      // 2. Append immutable audit history record
      await tx.incidentStatusHistory.create({
        data: {
          incidentId,
          previousStatus: existing.status,
          newStatus: input.status,
          changedById: actingUserId,
          reason: input.reason || null,
        },
      });

      return {
        ...updated,
        createdBy: formatUser(updated.createdBy),
        assignedTo: updated.assignedTo ? formatUser(updated.assignedTo) : null,
      };
    });
  }
}

export const incidentService = new IncidentService();
