import prisma from '../config/database';
import {
  CaseStatus,
  CaseMemberRole,
  Prisma,
} from '@prisma/client';
import {
  CreateCaseInput,
  UpdateCaseInput,
  UpdateCaseStatusInput,
  AddCaseMemberInput,
  ListCasesQueryInput,
} from '../validators/case.validator';
import { generateCaseNumber } from '../utils/case-number';
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

export class CaseService {
  /**
   * Creates a new Case within a database transaction.
   * - Automatically assigns server-generated unique case number
   * - Sets initial status to OPEN
   * - Creates initial CaseStatusHistory audit entry
   * - If lead investigator is specified, validates role and adds as CaseMember
   */
  async createCase(input: CreateCaseInput, creatorId: string) {
    // Validate lead investigator if provided
    if (input.leadInvestigatorId) {
      const leadUser = await prisma.user.findUnique({
        where: { id: input.leadInvestigatorId },
        include: { role: true },
      });

      if (!leadUser || !leadUser.isActive) {
        throw new AppError('Assigned lead investigator does not exist or is inactive', 400);
      }

      if (leadUser.role.name !== 'ADMIN' && leadUser.role.name !== 'INVESTIGATOR') {
        throw new AppError(
          'Lead investigator must hold an active INVESTIGATOR or ADMIN role',
          400
        );
      }
    }

    return await prisma.$transaction(async (tx) => {
      const caseNumber = await generateCaseNumber(tx);

      // 1. Create the Case
      const createdCase = await tx.case.create({
        data: {
          caseNumber,
          title: input.title,
          description: input.description,
          caseType: input.caseType,
          category: input.category,
          severity: input.severity,
          priority: input.priority,
          confidentiality: input.confidentiality,
          incidentDate: input.incidentDate,
          detectedAt: input.detectedAt,
          reportedAt: input.reportedAt,
          dueDate: input.dueDate,
          createdById: creatorId,
          leadInvestigatorId: input.leadInvestigatorId,
          tags: input.tags,
          status: CaseStatus.OPEN,
        },
        include: {
          createdBy: { select: safeUserSelect },
          leadInvestigator: { select: safeUserSelect },
        },
      });

      // 2. Create the initial status audit record
      await tx.caseStatusHistory.create({
        data: {
          caseId: createdCase.id,
          previousStatus: null,
          newStatus: CaseStatus.OPEN,
          changedById: creatorId,
          reason: 'Initial case creation',
        },
      });

      // 3. If lead investigator specified, add them as CaseMember
      if (input.leadInvestigatorId) {
        await tx.caseMember.create({
          data: {
            caseId: createdCase.id,
            userId: input.leadInvestigatorId,
            role: CaseMemberRole.LEAD_INVESTIGATOR,
          },
        });
      }

      return {
        ...createdCase,
        createdBy: formatUser(createdCase.createdBy),
        leadInvestigator: createdCase.leadInvestigator
          ? formatUser(createdCase.leadInvestigator)
          : null,
      };
    });
  }

  /**
   * Lists cases with filtering, search, and pagination.
   */
  async listCases(
    query: ListCasesQueryInput,
    _user: AuthUser
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.CaseWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.severity) where.severity = query.severity;
    if (query.caseType) where.caseType = query.caseType;
    if (query.category) where.category = query.category;

    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { caseNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.case.count({ where });
    const skip = (query.page - 1) * query.limit;
    const totalPages = Math.ceil(total / query.limit) || 1;

    const cases = await prisma.case.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: safeUserSelect },
        leadInvestigator: { select: safeUserSelect },
        _count: {
          select: {
            members: true,
            statusHistory: true,
          },
        },
      },
    });

    const data = cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      description: c.description,
      caseType: c.caseType,
      category: c.category,
      severity: c.severity,
      priority: c.priority,
      confidentiality: c.confidentiality,
      status: c.status,
      incidentDate: c.incidentDate,
      detectedAt: c.detectedAt,
      reportedAt: c.reportedAt,
      dueDate: c.dueDate,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      closedAt: c.closedAt,
      tags: c.tags,
      createdBy: formatUser(c.createdBy),
      leadInvestigator: c.leadInvestigator
        ? formatUser(c.leadInvestigator)
        : null,
      membersCount: c._count.members,
      statusHistoryCount: c._count.statusHistory,
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
   * Retrieves comprehensive Case details by ID, including creator,
   * lead investigator, closure details, assigned members, and status history.
   */
  async getCaseById(caseId: string) {
    const foundCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: { select: safeUserSelect },
        leadInvestigator: { select: safeUserSelect },
        closedBy: { select: safeUserSelect },
        members: {
          include: {
            user: { select: safeUserSelect },
          },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: {
            changedBy: { select: safeUserSelect },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!foundCase) {
      throw new AppError('Case not found', 404);
    }

    return {
      id: foundCase.id,
      caseNumber: foundCase.caseNumber,
      title: foundCase.title,
      description: foundCase.description,
      caseType: foundCase.caseType,
      category: foundCase.category,
      severity: foundCase.severity,
      priority: foundCase.priority,
      confidentiality: foundCase.confidentiality,
      status: foundCase.status,
      incidentDate: foundCase.incidentDate,
      detectedAt: foundCase.detectedAt,
      reportedAt: foundCase.reportedAt,
      dueDate: foundCase.dueDate,
      createdAt: foundCase.createdAt,
      updatedAt: foundCase.updatedAt,
      closedAt: foundCase.closedAt,
      closureReason: foundCase.closureReason,
      tags: foundCase.tags,
      createdBy: formatUser(foundCase.createdBy),
      leadInvestigator: foundCase.leadInvestigator
        ? formatUser(foundCase.leadInvestigator)
        : null,
      closedBy: foundCase.closedBy ? formatUser(foundCase.closedBy) : null,
      members: foundCase.members.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        user: formatUser(m.user),
      })),
      statusHistory: foundCase.statusHistory.map((h) => ({
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
   * Updates non-critical metadata of a Case.
   * Protected fields (id, caseNumber, status, createdById, closedAt, etc.) cannot be modified.
   */
  async updateCase(caseId: string, input: UpdateCaseInput) {
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      throw new AppError('Case not found', 404);
    }

    if (input.leadInvestigatorId) {
      const leadUser = await prisma.user.findUnique({
        where: { id: input.leadInvestigatorId },
        include: { role: true },
      });

      if (!leadUser || !leadUser.isActive) {
        throw new AppError('Assigned lead investigator does not exist or is inactive', 400);
      }

      if (leadUser.role.name !== 'ADMIN' && leadUser.role.name !== 'INVESTIGATOR') {
        throw new AppError(
          'Lead investigator must hold an active INVESTIGATOR or ADMIN role',
          400
        );
      }
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.caseType !== undefined && { caseType: input.caseType }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.severity !== undefined && { severity: input.severity }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.confidentiality !== undefined && {
          confidentiality: input.confidentiality,
        }),
        ...(input.incidentDate !== undefined && { incidentDate: input.incidentDate }),
        ...(input.detectedAt !== undefined && { detectedAt: input.detectedAt }),
        ...(input.reportedAt !== undefined && { reportedAt: input.reportedAt }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.leadInvestigatorId !== undefined && {
          leadInvestigatorId: input.leadInvestigatorId,
        }),
        ...(input.tags !== undefined && { tags: input.tags }),
      },
      include: {
        createdBy: { select: safeUserSelect },
        leadInvestigator: { select: safeUserSelect },
      },
    });

    return {
      ...updatedCase,
      createdBy: formatUser(updatedCase.createdBy),
      leadInvestigator: updatedCase.leadInvestigator
        ? formatUser(updatedCase.leadInvestigator)
        : null,
    };
  }

  /**
   * Transitions Case status and records CaseStatusHistory in an atomic transaction.
   * If transitioning to CLOSED, records closedAt, closedById, and closureReason.
   * If reopening, clears closure tracking fields.
   */
  async changeStatus(
    caseId: string,
    input: UpdateCaseStatusInput,
    actingUserId: string
  ) {
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      throw new AppError('Case not found', 404);
    }

    if (existingCase.status === input.status) {
      throw new AppError(
        `Case is already in ${input.status} status`,
        400
      );
    }

    const isClosing = input.status === CaseStatus.CLOSED;
    const isReopening =
      existingCase.status === CaseStatus.CLOSED &&
      input.status !== CaseStatus.CLOSED;

    return await prisma.$transaction(async (tx) => {
      // 1. Update Case status and closure fields
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data: {
          status: input.status,
          ...(isClosing && {
            closedAt: new Date(),
            closedById: actingUserId,
            closureReason: input.reason,
          }),
          ...(isReopening && {
            closedAt: null,
            closedById: null,
            closureReason: null,
          }),
        },
        include: {
          createdBy: { select: safeUserSelect },
          leadInvestigator: { select: safeUserSelect },
          closedBy: { select: safeUserSelect },
        },
      });

      // 2. Append audit record to CaseStatusHistory
      await tx.caseStatusHistory.create({
        data: {
          caseId,
          previousStatus: existingCase.status,
          newStatus: input.status,
          changedById: actingUserId,
          reason: input.reason || null,
        },
      });

      return {
        ...updatedCase,
        createdBy: formatUser(updatedCase.createdBy),
        leadInvestigator: updatedCase.leadInvestigator
          ? formatUser(updatedCase.leadInvestigator)
          : null,
        closedBy: updatedCase.closedBy ? formatUser(updatedCase.closedBy) : null,
      };
    });
  }

  /**
   * Adds an active User as a CaseMember.
   * Enforces role integrity: system role must be compatible with member role.
   */
  async addMember(
    caseId: string,
    input: AddCaseMemberInput,
    _actingUserId: string
  ) {
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      throw new AppError('Case not found', 404);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { role: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError('Target user does not exist or is deactivated', 400);
    }

    // Role escalation check
    if (
      (input.role === CaseMemberRole.LEAD_INVESTIGATOR ||
        input.role === CaseMemberRole.INVESTIGATOR) &&
      targetUser.role.name !== 'ADMIN' &&
      targetUser.role.name !== 'INVESTIGATOR'
    ) {
      throw new AppError(
        `User with system role ${targetUser.role.name} cannot be assigned investigator responsibilities on a case`,
        400
      );
    }

    if (
      input.role === CaseMemberRole.ANALYST &&
      targetUser.role.name === 'VIEWER'
    ) {
      throw new AppError(
        'User with VIEWER system role cannot be assigned as an analyst',
        400
      );
    }

    // Check for existing membership
    const existingMembership = await prisma.caseMember.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: input.userId,
        },
      },
    });

    if (existingMembership) {
      throw new AppError('User is already assigned to this case', 409);
    }

    return await prisma.$transaction(async (tx) => {
      // If assigning as LEAD_INVESTIGATOR, update the leadInvestigatorId on the Case
      if (input.role === CaseMemberRole.LEAD_INVESTIGATOR) {
        // Demote existing lead investigator member if present
        if (existingCase.leadInvestigatorId) {
          await tx.caseMember.updateMany({
            where: {
              caseId,
              userId: existingCase.leadInvestigatorId,
              role: CaseMemberRole.LEAD_INVESTIGATOR,
            },
            data: {
              role: CaseMemberRole.INVESTIGATOR,
            },
          });
        }

        await tx.case.update({
          where: { id: caseId },
          data: { leadInvestigatorId: input.userId },
        });
      }

      const createdMember = await tx.caseMember.create({
        data: {
          caseId,
          userId: input.userId,
          role: input.role,
        },
        include: {
          user: { select: safeUserSelect },
        },
      });

      return {
        id: createdMember.id,
        role: createdMember.role,
        createdAt: createdMember.createdAt,
        user: formatUser(createdMember.user),
      };
    });
  }

  /**
   * Removes a member from a Case.
   * Protects the lead investigator from being removed without reassigning first.
   */
  async removeMember(
    caseId: string,
    targetUserId: string,
    _actingUserId: string
  ) {
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      throw new AppError('Case not found', 404);
    }

    const membership = await prisma.caseMember.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: targetUserId,
        },
      },
    });

    if (!membership) {
      throw new AppError('User is not a member of this case', 404);
    }

    // Lead investigator protection
    if (
      existingCase.leadInvestigatorId === targetUserId ||
      membership.role === CaseMemberRole.LEAD_INVESTIGATOR
    ) {
      throw new AppError(
        'Cannot remove the lead investigator. Please reassign the lead investigator first.',
        400
      );
    }

    await prisma.caseMember.delete({
      where: {
        caseId_userId: {
          caseId,
          userId: targetUserId,
        },
      },
    });

    return {
      message: 'Case member removed successfully',
    };
  }
}

export const caseService = new CaseService();
