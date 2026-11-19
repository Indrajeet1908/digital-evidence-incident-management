import prisma from '../config/database';
import {
  InvestigationOverviewResponse,
  CaseInvestigationSummaryResponse,
  ActivityTimelineResponse,
  NormalizedActivityItem,
  IncidentIntelligenceResponse,
  IncidentIntelligenceItem,
  EvidenceIntelligenceResponse,
  EvidenceIntelligenceItem,
  AIIntelligenceResponse,
  InvestigationAlertsResponse,
  InvestigationAlertItem,
  UnifiedSearchResponse,
} from '../types/dashboard.types';
import {
  IncidentStatus,
  IncidentSeverity,
  IncidentPriority,
  IncidentType,
  IncidentCategory,
  EvidenceType,
  EvidenceSource,
  EvidenceAuditAction,
  AuditResult,
  AIAnalysisType,
  AIAnalysisStatus,
  Prisma,
} from '@prisma/client';
import { custodyService } from './custody.service';
import { AppError } from '../utils/errors';

export class DashboardService {
  /**
   * 1. GET /api/dashboard/overview
   * Returns high-level operational metrics aggregated directly from PostgreSQL.
   */
  async getOverview(): Promise<InvestigationOverviewResponse> {
    const recentThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalCases,
      openCases,
      inProgressCases,
      closedCases,
      incidentStatusCounts,
      totalEvidence,
      recentEvidence,
      verifiedIntegrity,
      failedIntegrity,
      aiStatusCounts,
      recentCustodyTransfers,
      recentTimeline,
    ] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({ where: { status: 'OPEN' } }),
      prisma.case.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.case.count({ where: { status: 'CLOSED' } }),

      prisma.incident.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      prisma.evidence.count(),
      prisma.evidence.count({ where: { createdAt: { gte: recentThreshold } } }),
      prisma.evidenceAuditLog.count({
        where: { action: EvidenceAuditAction.INTEGRITY_CHECKED, result: AuditResult.SUCCESS },
      }),
      prisma.evidenceAuditLog.count({
        where: { action: EvidenceAuditAction.INTEGRITY_CHECKED, result: AuditResult.FAILURE },
      }),

      prisma.aIAnalysis.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      prisma.evidenceCustodyEvent.count({
        where: { eventType: 'TRANSFERRED' },
      }),

      this.getActivityTimeline({ page: 1, limit: 10 }),
    ]);

    const incidentMap: Record<string, number> = {};
    for (const item of incidentStatusCounts) {
      incidentMap[item.status] = item._count.id;
    }

    const aiMap: Record<string, number> = {};
    let totalAI = 0;
    for (const item of aiStatusCounts) {
      aiMap[item.status] = item._count.id;
      totalAI += item._count.id;
    }

    return {
      cases: {
        total: totalCases,
        open: openCases,
        inProgress: inProgressCases,
        closed: closedCases,
      },
      incidents: {
        total: Object.values(incidentMap).reduce((a, b) => a + b, 0),
        open: incidentMap['OPEN'] || 0,
        investigating: incidentMap['INVESTIGATING'] || 0,
        contained: incidentMap['CONTAINED'] || 0,
        resolved: incidentMap['RESOLVED'] || 0,
        closed: incidentMap['CLOSED'] || 0,
      },
      evidence: {
        total: totalEvidence,
        recent: recentEvidence,
        integrityVerified: verifiedIntegrity,
        integrityFailures: failedIntegrity,
      },
      ai: {
        totalAnalyses: totalAI,
        completed: aiMap['COMPLETED'] || 0,
        failed: aiMap['FAILED'] || 0,
        pending: (aiMap['PENDING'] || 0) + (aiMap['PROCESSING'] || 0),
      },
      custody: {
        recentTransfers: recentCustodyTransfers,
      },
      recentActivity: recentTimeline.items,
    };
  }

  /**
   * 2. GET /api/dashboard/cases/:caseId
   * Consolidated single-case investigation summary view.
   */
  async getCaseInvestigation(caseId: string): Promise<CaseInvestigationSummaryResponse> {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        leadInvestigator: { select: { id: true, firstName: true, lastName: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        incidents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            incidentNumber: true,
            title: true,
            status: true,
            severity: true,
            priority: true,
            detectedAt: true,
          },
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            evidenceNumber: true,
            originalFilename: true,
            evidenceType: true,
            fileSize: true,
            sha256: true,
            createdAt: true,
          },
        },
        aiAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            analysisType: true,
            status: true,
            summary: true,
            confidence: true,
            result: true,
            completedAt: true,
          },
        },
      },
    });

    if (!caseRecord) {
      throw new AppError('Case not found', 404);
    }

    // Incident breakdowns
    const incByStatus: Record<string, number> = {};
    const incBySeverity: Record<string, number> = {};
    const incByPriority: Record<string, number> = {};

    for (const inc of caseRecord.incidents) {
      incByStatus[inc.status] = (incByStatus[inc.status] || 0) + 1;
      incBySeverity[inc.severity] = (incBySeverity[inc.severity] || 0) + 1;
      incByPriority[inc.priority] = (incByPriority[inc.priority] || 0) + 1;
    }

    // Evidence breakdowns & integrity checks
    const evByType: Record<string, number> = {};
    const evBySource: Record<string, number> = {};
    const evidenceIds = caseRecord.evidence.map((e) => e.id);

    const [auditLogs, custodyEvents] = await Promise.all([
      prisma.evidenceAuditLog.findMany({
        where: { evidenceId: { in: evidenceIds } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          actorUser: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.evidenceCustodyEvent.findMany({
        where: { evidenceId: { in: evidenceIds } },
        orderBy: { eventAt: 'desc' },
        take: 10,
        include: {
          actorUser: { select: { firstName: true, lastName: true } },
          fromUser: { select: { firstName: true, lastName: true } },
          toUser: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    let integrityVerified = 0;
    let integrityFailures = 0;
    const latestIntegrityMap = new Map<string, string>();

    for (const log of auditLogs) {
      if (log.action === EvidenceAuditAction.INTEGRITY_CHECKED && !latestIntegrityMap.has(log.evidenceId)) {
        latestIntegrityMap.set(log.evidenceId, log.result === AuditResult.SUCCESS ? 'VALID' : 'MISMATCH');
        if (log.result === AuditResult.SUCCESS) integrityVerified++;
        else integrityFailures++;
      }
    }

    const recentEvidenceList = caseRecord.evidence.slice(0, 10).map((ev) => {
      evByType[ev.evidenceType] = (evByType[ev.evidenceType] || 0) + 1;
      return {
        id: ev.id,
        evidenceNumber: ev.evidenceNumber,
        originalFilename: ev.originalFilename,
        evidenceType: ev.evidenceType,
        fileSize: Number(ev.fileSize),
        sha256: ev.sha256,
        createdAt: ev.createdAt.toISOString(),
        latestIntegrity: latestIntegrityMap.get(ev.id) || 'UNVERIFIED',
      };
    });

    // AI findings extraction
    const latestFindings: Array<{
      title: string;
      description: string;
      severity: string;
      confidence: number;
    }> = [];

    let completedAI = 0;
    let failedAI = 0;

    for (const ai of caseRecord.aiAnalyses) {
      if (ai.status === 'COMPLETED') {
        completedAI++;
        if (ai.result && typeof ai.result === 'object' && 'findings' in ai.result) {
          const resObj = ai.result as { findings?: typeof latestFindings };
          if (Array.isArray(resObj.findings)) {
            for (const f of resObj.findings.slice(0, 3)) {
              latestFindings.push({
                title: f.title,
                description: f.description,
                severity: f.severity,
                confidence: f.confidence,
              });
            }
          }
        }
      } else if (ai.status === 'FAILED') {
        failedAI++;
      }
    }

    return {
      case: {
        id: caseRecord.id,
        caseNumber: caseRecord.caseNumber,
        title: caseRecord.title,
        description: caseRecord.description,
        status: caseRecord.status,
        priority: caseRecord.priority,
        severity: caseRecord.severity,
        caseType: caseRecord.caseType,
        category: caseRecord.category,
        createdAt: caseRecord.createdAt.toISOString(),
        updatedAt: caseRecord.updatedAt.toISOString(),
        leadInvestigator: caseRecord.leadInvestigator
          ? {
              id: caseRecord.leadInvestigator.id,
              name: `${caseRecord.leadInvestigator.firstName} ${caseRecord.leadInvestigator.lastName}`.trim(),
            }
          : null,
        members: caseRecord.members.map((m) => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`.trim(),
          role: m.role,
        })),
        tags: caseRecord.tags,
        closureReason: caseRecord.closureReason,
      },
      incidentSummary: {
        total: caseRecord.incidents.length,
        byStatus: incByStatus,
        bySeverity: incBySeverity,
        byPriority: incByPriority,
        incidents: caseRecord.incidents.map((inc) => ({
          id: inc.id,
          incidentNumber: inc.incidentNumber,
          title: inc.title,
          status: inc.status,
          severity: inc.severity,
          priority: inc.priority,
          detectedAt: inc.detectedAt ? inc.detectedAt.toISOString() : null,
        })),
      },
      evidenceSummary: {
        total: caseRecord.evidence.length,
        byType: evByType,
        bySource: evBySource,
        integrity: {
          verified: integrityVerified,
          failures: integrityFailures,
          unverified: Math.max(0, caseRecord.evidence.length - (integrityVerified + integrityFailures)),
        },
        recentEvidence: recentEvidenceList,
      },
      aiSummary: {
        totalAnalyses: caseRecord.aiAnalyses.length,
        completed: completedAI,
        failed: failedAI,
        latestFindings: latestFindings.slice(0, 5),
        latestSummaries: caseRecord.aiAnalyses
          .filter((a) => a.summary)
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            analysisType: a.analysisType,
            summary: a.summary!,
            confidence: a.confidence,
            completedAt: a.completedAt ? a.completedAt.toISOString() : null,
          })),
      },
      custodySummary: {
        currentCustodyState: custodyEvents[0]?.eventType ?? 'INITIAL',
        recentEvents: custodyEvents.map((c) => ({
          id: c.id,
          eventType: c.eventType,
          actor: `${c.actorUser.firstName} ${c.actorUser.lastName}`.trim(),
          fromUser: c.fromUser ? `${c.fromUser.firstName} ${c.fromUser.lastName}`.trim() : null,
          toUser: c.toUser ? `${c.toUser.firstName} ${c.toUser.lastName}`.trim() : null,
          reason: c.reason,
          eventAt: c.eventAt.toISOString(),
        })),
      },
      activitySummary: {
        recentAuditEvents: auditLogs.slice(0, 10).map((l) => ({
          id: l.id,
          action: l.action,
          result: l.result,
          actor: l.actorUser ? `${l.actorUser.firstName} ${l.actorUser.lastName}`.trim() : 'System',
          timestamp: l.createdAt.toISOString(),
        })),
      },
    };
  }

  /**
   * 3. GET /api/dashboard/activity
   * Returns a normalized chronological timeline across Cases, Incidents, Evidence, Custody, and AI.
   */
  async getActivityTimeline(query: {
    page: number;
    limit: number;
    type?: string;
    caseId?: string;
    incidentId?: string;
    evidenceId?: string;
    actorUserId?: string;
    from?: Date;
    to?: Date;
  }): Promise<ActivityTimelineResponse> {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.from) dateFilter.gte = query.from;
    if (query.to) dateFilter.lte = query.to;
    const hasDate = Boolean(query.from || query.to);

    // Collect activities from multiple operational sources
    const [custodyEvents, auditLogs, aiAnalyses, caseStatusEvents, incidentStatusEvents] =
      await Promise.all([
        prisma.evidenceCustodyEvent.findMany({
          where: {
            ...(query.evidenceId && { evidenceId: query.evidenceId }),
            ...(query.actorUserId && { actorUserId: query.actorUserId }),
            ...(hasDate && { eventAt: dateFilter }),
          },
          take: 100,
          orderBy: { eventAt: 'desc' },
          include: {
            actorUser: { select: { id: true, firstName: true, lastName: true } },
            evidence: { select: { evidenceNumber: true, originalFilename: true } },
          },
        }),

        prisma.evidenceAuditLog.findMany({
          where: {
            ...(query.evidenceId && { evidenceId: query.evidenceId }),
            ...(query.actorUserId && { actorUserId: query.actorUserId }),
            ...(hasDate && { createdAt: dateFilter }),
          },
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: {
            actorUser: { select: { id: true, firstName: true, lastName: true } },
            evidence: { select: { evidenceNumber: true, originalFilename: true } },
          },
        }),

        prisma.aIAnalysis.findMany({
          where: {
            ...(query.caseId && { caseId: query.caseId }),
            ...(query.incidentId && { incidentId: query.incidentId }),
            ...(query.evidenceId && { evidenceId: query.evidenceId }),
            ...(query.actorUserId && { createdById: query.actorUserId }),
            ...(hasDate && { createdAt: dateFilter }),
          },
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            evidence: { select: { evidenceNumber: true } },
            case: { select: { caseNumber: true } },
          },
        }),

        prisma.caseStatusHistory.findMany({
          where: {
            ...(query.caseId && { caseId: query.caseId }),
            ...(query.actorUserId && { changedById: query.actorUserId }),
            ...(hasDate && { createdAt: dateFilter }),
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
            case: { select: { caseNumber: true } },
          },
        }),

        prisma.incidentStatusHistory.findMany({
          where: {
            ...(query.incidentId && { incidentId: query.incidentId }),
            ...(query.actorUserId && { changedById: query.actorUserId }),
            ...(hasDate && { createdAt: dateFilter }),
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
            incident: { select: { incidentNumber: true } },
          },
        }),
      ]);

    const normalizedItems: NormalizedActivityItem[] = [];

    // Custody events
    for (const c of custodyEvents) {
      normalizedItems.push({
        id: c.id,
        timestamp: c.eventAt.toISOString(),
        type: `CUSTODY_${c.eventType}`,
        actor: {
          id: c.actorUser.id,
          name: `${c.actorUser.firstName} ${c.actorUser.lastName}`.trim(),
        },
        entityType: 'EVIDENCE',
        entityId: c.evidenceId,
        entityReference: c.evidence?.evidenceNumber,
        description: c.reason || `Evidence custody transitioned to ${c.eventType}`,
        result: 'SUCCESS',
      });
    }

    // Audit logs (deduplicate against custody events)
    for (const a of auditLogs) {
      if (
        a.action !== EvidenceAuditAction.CUSTODY_TRANSFERRED &&
        a.action !== EvidenceAuditAction.CUSTODY_RECEIVED
      ) {
        normalizedItems.push({
          id: a.id,
          timestamp: a.createdAt.toISOString(),
          type: `AUDIT_${a.action}`,
          actor: {
            id: a.actorUser?.id || null,
            name: a.actorUser
              ? `${a.actorUser.firstName} ${a.actorUser.lastName}`.trim()
              : 'System',
          },
          entityType: 'EVIDENCE',
          entityId: a.evidenceId,
          entityReference: a.evidence?.evidenceNumber,
          description: `Action ${a.action} performed with result ${a.result}`,
          result: a.result as 'SUCCESS' | 'FAILURE' | 'DENIED',
        });
      }
    }

    // AI analyses
    for (const ai of aiAnalyses) {
      normalizedItems.push({
        id: ai.id,
        timestamp: (ai.completedAt || ai.createdAt).toISOString(),
        type: `AI_${ai.analysisType}`,
        actor: {
          id: ai.createdBy.id,
          name: `${ai.createdBy.firstName} ${ai.createdBy.lastName}`.trim(),
        },
        entityType: 'AI_ANALYSIS',
        entityId: ai.id,
        entityReference: ai.evidence?.evidenceNumber || ai.case?.caseNumber,
        description: ai.summary || `AI ${ai.analysisType} status: ${ai.status}`,
        result: ai.status === 'COMPLETED' ? 'SUCCESS' : ai.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
      });
    }

    // Case status changes
    for (const cs of caseStatusEvents) {
      normalizedItems.push({
        id: cs.id,
        timestamp: cs.createdAt.toISOString(),
        type: 'CASE_STATUS_CHANGED',
        actor: {
          id: cs.changedBy.id,
          name: `${cs.changedBy.firstName} ${cs.changedBy.lastName}`.trim(),
        },
        entityType: 'CASE',
        entityId: cs.caseId,
        entityReference: cs.case?.caseNumber,
        description: `Case transitioned to ${cs.newStatus}${cs.reason ? `: ${cs.reason}` : ''}`,
        result: 'SUCCESS',
      });
    }

    // Incident status changes
    for (const is of incidentStatusEvents) {
      normalizedItems.push({
        id: is.id,
        timestamp: is.createdAt.toISOString(),
        type: 'INCIDENT_STATUS_CHANGED',
        actor: {
          id: is.changedBy.id,
          name: `${is.changedBy.firstName} ${is.changedBy.lastName}`.trim(),
        },
        entityType: 'INCIDENT',
        entityId: is.incidentId,
        entityReference: is.incident?.incidentNumber,
        description: `Incident transitioned to ${is.newStatus}${is.reason ? `: ${is.reason}` : ''}`,
        result: 'SUCCESS',
      });
    }

    // Sort descending by timestamp
    normalizedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by type if provided
    let filtered = normalizedItems;
    if (query.type) {
      const targetType = query.type.toUpperCase();
      filtered = filtered.filter((i) => i.type.toUpperCase().includes(targetType));
    }

    const total = filtered.length;
    const skip = (query.page - 1) * query.limit;
    const paginated = filtered.slice(skip, skip + query.limit);

    return {
      items: paginated,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  /**
   * 4. GET /api/dashboard/incidents
   * Filterable incident intelligence enriched with evidence count and AI classification.
   */
  async getIncidentIntelligence(query: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    priority?: IncidentPriority;
    incidentType?: IncidentType;
    category?: IncidentCategory;
    caseId?: string;
    assignedToId?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }): Promise<IncidentIntelligenceResponse> {
    const where: Prisma.IncidentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.priority) where.priority = query.priority;
    if (query.incidentType) where.incidentType = query.incidentType;
    if (query.category) where.category = query.category;
    if (query.caseId) where.caseId = query.caseId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.from || query.to) {
      where.detectedAt = {};
      if (query.from) where.detectedAt.gte = query.from;
      if (query.to) where.detectedAt.lte = query.to;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, records] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { evidence: true, aiAnalyses: true } },
        },
      }),
    ]);

    const incidentIds = records.map((r) => r.id);
    const latestAIs = await prisma.aIAnalysis.findMany({
      where: {
        incidentId: { in: incidentIds },
        analysisType: AIAnalysisType.INCIDENT_CLASSIFICATION,
        status: AIAnalysisStatus.COMPLETED,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        incidentId: true,
        summary: true,
        confidence: true,
        result: true,
      },
    });

    const aiClassificationMap = new Map<
      string,
      { classification: string; confidence: number; summary: string }
    >();
    for (const ai of latestAIs) {
      if (ai.incidentId && !aiClassificationMap.has(ai.incidentId)) {
        const resObj = (ai.result as { classification?: string }) || {};
        aiClassificationMap.set(ai.incidentId, {
          classification: resObj.classification || 'CLASSIFIED',
          confidence: ai.confidence || 0.9,
          summary: ai.summary || '',
        });
      }
    }

    const items: IncidentIntelligenceItem[] = records.map((inc) => ({
      id: inc.id,
      incidentNumber: inc.incidentNumber,
      title: inc.title,
      case: inc.case,
      type: inc.incidentType,
      category: inc.category,
      severity: inc.severity,
      priority: inc.priority,
      status: inc.status,
      assignedInvestigator: inc.assignedTo
        ? {
            id: inc.assignedTo.id,
            name: `${inc.assignedTo.firstName} ${inc.assignedTo.lastName}`.trim(),
          }
        : null,
      detectedAt: inc.detectedAt ? inc.detectedAt.toISOString() : null,
      updatedAt: inc.updatedAt.toISOString(),
      evidenceCount: inc._count.evidence,
      aiAnalysisCount: inc._count.aiAnalyses,
      latestAIClassification: aiClassificationMap.get(inc.id) || null,
    }));

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  /**
   * 5. GET /api/dashboard/evidence
   * Filterable evidence intelligence with latest integrity and custody state.
   * STRICT SECURITY GUARANTEE: Does NOT leak internal filesystem storage paths.
   */
  async getEvidenceIntelligence(query: {
    caseId?: string;
    incidentId?: string;
    evidenceType?: EvidenceType;
    source?: EvidenceSource;
    integrityStatus?: 'VALID' | 'MISMATCH' | 'UNVERIFIED';
    uploadedById?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }): Promise<EvidenceIntelligenceResponse> {
    const where: Prisma.EvidenceWhereInput = {};
    if (query.caseId) where.caseId = query.caseId;
    if (query.incidentId) where.incidentId = query.incidentId;
    if (query.evidenceType) where.evidenceType = query.evidenceType;
    if (query.source) where.source = query.source;
    if (query.uploadedById) where.uploadedById = query.uploadedById;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = query.from;
      if (query.to) where.createdAt.lte = query.to;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, records] = await Promise.all([
      prisma.evidence.count({ where }),
      prisma.evidence.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          incident: { select: { id: true, incidentNumber: true, title: true } },
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { aiAnalyses: true } },
        },
      }),
    ]);

    const evidenceIds = records.map((r) => r.id);

    // Latest integrity check audit log per evidence
    const integrityLogs = await prisma.evidenceAuditLog.findMany({
      where: {
        evidenceId: { in: evidenceIds },
        action: EvidenceAuditAction.INTEGRITY_CHECKED,
      },
      orderBy: { createdAt: 'desc' },
      select: { evidenceId: true, result: true },
    });

    const integrityMap = new Map<string, 'VALID' | 'MISMATCH'>();
    for (const log of integrityLogs) {
      if (!integrityMap.has(log.evidenceId)) {
        integrityMap.set(
          log.evidenceId,
          log.result === AuditResult.SUCCESS ? 'VALID' : 'MISMATCH'
        );
      }
    }

    // Custody state derivation
    const custodyStates = await Promise.all(
      records.map((r) => custodyService.getCurrentCustodian(r.id))
    );
    const custodyMap = new Map<string, typeof custodyStates[0]>();
    custodyStates.forEach((c) => custodyMap.set(c.evidenceId, c));

    let items: EvidenceIntelligenceItem[] = records.map((ev) => {
      const cust = custodyMap.get(ev.id);
      return {
        id: ev.id,
        evidenceNumber: ev.evidenceNumber,
        filename: ev.originalFilename,
        evidenceType: ev.evidenceType,
        source: ev.source,
        case: ev.case,
        incident: ev.incident,
        fileSize: Number(ev.fileSize),
        uploadedBy: {
          id: ev.uploadedBy.id,
          name: `${ev.uploadedBy.firstName} ${ev.uploadedBy.lastName}`.trim(),
        },
        createdAt: ev.createdAt.toISOString(),
        sha256: ev.sha256,
        latestIntegrityResult: integrityMap.get(ev.id) || 'UNVERIFIED',
        currentCustody: {
          custodianId: cust?.custodianId || null,
          custodianName: cust?.custodian
            ? `${cust.custodian.firstName} ${cust.custodian.lastName}`.trim()
            : null,
          isSealed: cust?.isSealed || false,
          isReleased: cust?.isReleased || false,
        },
        aiAnalysisCount: ev._count.aiAnalyses,
      };
    });

    if (query.integrityStatus) {
      items = items.filter((i) => i.latestIntegrityResult === query.integrityStatus);
    }

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  /**
   * 6. GET /api/dashboard/ai
   * Aggregate AI intelligence, advisory findings, and indicator breakdown.
   */
  async getAIIntelligence(): Promise<AIIntelligenceResponse> {
    const [totalAnalyses, typeGroups, statusGroups, avgConfidence, recentAnalyses] =
      await Promise.all([
        prisma.aIAnalysis.count(),
        prisma.aIAnalysis.groupBy({ by: ['analysisType'], _count: { id: true } }),
        prisma.aIAnalysis.groupBy({ by: ['status'], _count: { id: true } }),
        prisma.aIAnalysis.aggregate({
          _avg: { confidence: true },
          where: { status: AIAnalysisStatus.COMPLETED },
        }),
        prisma.aIAnalysis.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            evidence: { select: { evidenceNumber: true } },
          },
        }),
      ]);

    const analysesByType: Record<string, number> = {};
    for (const t of typeGroups) {
      analysesByType[t.analysisType] = t._count.id;
    }

    const analysesByStatus: Record<string, number> = {};
    for (const s of statusGroups) {
      analysesByStatus[s.status] = s._count.id;
    }

    const commonIndicatorTypes: Record<string, number> = {};
    const recentFindings: Array<{
      title: string;
      description: string;
      severity: string;
      confidence: number;
      evidenceId?: string;
      evidenceNumber?: string;
    }> = [];

    // Extract findings and indicators from completed analyses
    const completedAnalyses = await prisma.aIAnalysis.findMany({
      where: { status: AIAnalysisStatus.COMPLETED },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        evidence: { select: { id: true, evidenceNumber: true } },
      },
    });

    for (const a of completedAnalyses) {
      if (a.result && typeof a.result === 'object') {
        const resObj = a.result as {
          findings?: Array<{
            title: string;
            description: string;
            severity: string;
            confidence: number;
          }>;
          indicators?: Array<{ type: string }>;
        };

        if (Array.isArray(resObj.findings)) {
          for (const f of resObj.findings) {
            if (recentFindings.length < 10) {
              recentFindings.push({
                title: f.title,
                description: f.description,
                severity: f.severity,
                confidence: f.confidence,
                evidenceId: a.evidence?.id,
                evidenceNumber: a.evidence?.evidenceNumber,
              });
            }
          }
        }

        if (Array.isArray(resObj.indicators)) {
          for (const ind of resObj.indicators) {
            commonIndicatorTypes[ind.type] = (commonIndicatorTypes[ind.type] || 0) + 1;
          }
        }
      }
    }

    return {
      totalAnalyses,
      analysesByType,
      analysesByStatus,
      averageConfidence: avgConfidence._avg.confidence
        ? Number(avgConfidence._avg.confidence.toFixed(2))
        : null,
      commonIndicatorTypes,
      recentAnalyses: recentAnalyses.map((r) => ({
        id: r.id,
        evidenceId: r.evidenceId,
        evidenceNumber: r.evidence?.evidenceNumber,
        analysisType: r.analysisType,
        status: r.status,
        confidence: r.confidence,
        createdAt: r.createdAt.toISOString(),
      })),
      recentFindings,
    };
  }

  /**
   * 7. GET /api/dashboard/alerts
   * Returns actionable, deterministic alerts derived from actual system state.
   */
  async getInvestigationAlerts(): Promise<InvestigationAlertsResponse> {
    const alerts: InvestigationAlertItem[] = [];

    // 1. Evidence integrity verification failures (CRITICAL)
    const integrityFailures = await prisma.evidenceAuditLog.findMany({
      where: {
        action: EvidenceAuditAction.INTEGRITY_CHECKED,
        result: AuditResult.FAILURE,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { evidence: { select: { evidenceNumber: true } } },
    });

    for (const fail of integrityFailures) {
      alerts.push({
        id: `alert-integrity-${fail.id}`,
        severity: 'CRITICAL',
        type: 'INTEGRITY_MISMATCH',
        message: `Physical SHA-256 verification failed for evidence ${fail.evidence?.evidenceNumber || fail.evidenceId}. Potential tampering detected.`,
        entityType: 'EVIDENCE',
        entityId: fail.evidenceId,
        createdAt: fail.createdAt.toISOString(),
      });
    }

    // 2. Critical unresolved incidents (HIGH)
    const criticalIncidents = await prisma.incident.findMany({
      where: {
        severity: IncidentSeverity.CRITICAL,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING] },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    for (const inc of criticalIncidents) {
      alerts.push({
        id: `alert-incident-${inc.id}`,
        severity: 'HIGH',
        type: 'UNRESOLVED_CRITICAL_INCIDENT',
        message: `Critical incident ${inc.incidentNumber} ("${inc.title}") is currently ${inc.status}. Requires immediate attention.`,
        entityType: 'INCIDENT',
        entityId: inc.id,
        createdAt: inc.createdAt.toISOString(),
      });
    }

    // 3. Failed AI analyses (WARNING)
    const failedAI = await prisma.aIAnalysis.findMany({
      where: { status: AIAnalysisStatus.FAILED },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    for (const ai of failedAI) {
      alerts.push({
        id: `alert-ai-${ai.id}`,
        severity: 'WARNING',
        type: 'AI_ANALYSIS_FAILED',
        message: `AI ${ai.analysisType} failed: ${ai.errorMessage || 'Unknown error'}. Review artifact formatting.`,
        entityType: 'AI_ANALYSIS',
        entityId: ai.id,
        createdAt: ai.createdAt.toISOString(),
      });
    }

    // 4. Evidence without an associated incident (INFO)
    const unlinkedEvidence = await prisma.evidence.findMany({
      where: { incidentId: null },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    for (const ev of unlinkedEvidence) {
      alerts.push({
        id: `alert-unlinked-${ev.id}`,
        severity: 'INFO',
        type: 'UNLINKED_EVIDENCE',
        message: `Evidence ${ev.evidenceNumber} is uploaded under a case but not linked to a specific incident.`,
        entityType: 'EVIDENCE',
        entityId: ev.id,
        createdAt: ev.createdAt.toISOString(),
      });
    }

    return {
      alerts,
      total: alerts.length,
    };
  }

  /**
   * 8. GET /api/dashboard/search?q=
   * Unified search across Cases, Incidents, and Evidence.
   */
  async searchEntities(q: string, limit: number = 10): Promise<UnifiedSearchResponse> {
    const trimmed = q.trim();
    if (!trimmed) {
      return { cases: [], incidents: [], evidence: [] };
    }

    const [cases, incidents, evidence] = await Promise.all([
      prisma.case.findMany({
        where: {
          OR: [
            { caseNumber: { contains: trimmed, mode: 'insensitive' } },
            { title: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          caseNumber: true,
          title: true,
          status: true,
          priority: true,
        },
      }),

      prisma.incident.findMany({
        where: {
          OR: [
            { incidentNumber: { contains: trimmed, mode: 'insensitive' } },
            { title: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          incidentNumber: true,
          title: true,
          status: true,
          severity: true,
          case: { select: { caseNumber: true } },
        },
      }),

      prisma.evidence.findMany({
        where: {
          OR: [
            { evidenceNumber: { contains: trimmed, mode: 'insensitive' } },
            { originalFilename: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          evidenceNumber: true,
          originalFilename: true,
          evidenceType: true,
          case: { select: { caseNumber: true } },
        },
      }),
    ]);

    return {
      cases,
      incidents: incidents.map((i) => ({
        id: i.id,
        incidentNumber: i.incidentNumber,
        title: i.title,
        status: i.status,
        severity: i.severity,
        caseNumber: i.case.caseNumber,
      })),
      evidence: evidence.map((e) => ({
        id: e.id,
        evidenceNumber: e.evidenceNumber,
        originalFilename: e.originalFilename,
        evidenceType: e.evidenceType,
        caseNumber: e.case.caseNumber,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
