/**
 * Report generation service.
 * Orchestrates data fetching from Prisma and delegates to ReportBuilder
 * for structured report assembly.
 *
 * STATELESS: No database writes. Reports are generated on demand.
 * PRIVACY: Excludes storagePath, storedFilename, passwords, JWTs.
 */

import prisma from '../../config/database';
import { AppError } from '../../utils/errors';
import { reportBuilder } from './report.builder';
import type {
  ReportGenerationInput,
  InvestigationReport,
  ReportMetadata,
  ReportType,
} from '../../types/report.types';
import { REPORT_TYPES, REPORT_DISCLAIMER } from '../../types/report.types';

// Common user select to avoid exposing password hashes
const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
};

interface ReportUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export class ReportService {
  /**
   * Main entry point: generates a structured investigation report.
   */
  async generateReport(
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    switch (input.reportType) {
      case REPORT_TYPES.INVESTIGATION_SUMMARY:
        return this.generateInvestigationSummary(input.caseId!, input, user);

      case REPORT_TYPES.DETAILED_CASE_REPORT:
        return this.generateCaseReport(input.caseId!, input, user);

      case REPORT_TYPES.INCIDENT_REPORT:
        return this.generateIncidentReport(input.incidentId!, input, user);

      case REPORT_TYPES.EVIDENCE_REPORT:
        return this.generateEvidenceReport(input.evidenceId!, input, user);

      case REPORT_TYPES.CHAIN_OF_CUSTODY_REPORT:
        return this.generateCustodyReport(input.evidenceId!, input, user);

      case REPORT_TYPES.AI_ANALYSIS_REPORT:
        return this.generateAIReport(input, user);

      default:
        throw new AppError('Unsupported report type', 400);
    }
  }

  /**
   * INVESTIGATION_SUMMARY: High-level summary combining case, incidents, evidence overview.
   */
  private async generateInvestigationSummary(
    caseId: string,
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    const caseRecord = await this.fetchCase(caseId);

    const evidenceRecords = await prisma.evidence.findMany({
      where: { caseId },
      include: {
        uploadedBy: { select: userSelect },
        case: { select: { caseNumber: true } },
        incident: { select: { incidentNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build report sections
    const caseSection = reportBuilder.buildCaseSection(caseRecord);
    const incidents = reportBuilder.buildIncidentSections(
      caseRecord.incidents ?? [],
      input.includeAI !== false
    );
    const evidence = reportBuilder.buildEvidenceInventory(evidenceRecords, caseRecord);

    // Minimal integrity, custody, audit, AI for summary
    const reportContent = {
      case: caseSection,
      incidents,
      evidence,
      integrity: [] as InvestigationReport['integrity'],
      custody: [] as InvestigationReport['custody'],
      audit: [] as InvestigationReport['audit'],
      aiAnalysis: [] as InvestigationReport['aiAnalysis'],
      activityTimeline: [] as InvestigationReport['activityTimeline'],
      summary: '',
      limitations: [] as string[],
      disclaimer: REPORT_DISCLAIMER,
    };

    reportContent.summary = reportBuilder.buildSummary(reportContent);
    reportContent.limitations = reportBuilder.buildLimitations(reportContent);

    return this.finalizeReport(
      reportContent,
      REPORT_TYPES.INVESTIGATION_SUMMARY,
      user,
      caseRecord.caseNumber
    );
  }

  /**
   * DETAILED_CASE_REPORT: Full case report with all sections populated.
   */
  private async generateCaseReport(
    caseId: string,
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    const caseRecord = await this.fetchCase(caseId);

    const evidenceRecords = await prisma.evidence.findMany({
      where: { caseId },
      include: {
        uploadedBy: { select: userSelect },
        case: { select: { caseNumber: true } },
        incident: { select: { incidentNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const evidenceIds = evidenceRecords.map((e) => e.id);

    // Fetch custody events if requested
    const custodyEvents =
      input.includeCustody !== false
        ? await prisma.evidenceCustodyEvent.findMany({
            where: { evidenceId: { in: evidenceIds } },
            include: {
              fromUser: { select: userSelect },
              toUser: { select: userSelect },
              actorUser: { select: userSelect },
            },
            orderBy: { eventAt: 'asc' },
          })
        : [];

    // Fetch audit logs if requested
    const auditLogs =
      input.includeAudit !== false
        ? await prisma.evidenceAuditLog.findMany({
            where: { evidenceId: { in: evidenceIds } },
            include: {
              actorUser: { select: userSelect },
            },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    // Fetch AI analyses if requested
    const aiAnalyses =
      input.includeAI !== false
        ? await prisma.aIAnalysis.findMany({
            where: { caseId },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    // Build all sections
    const caseSection = reportBuilder.buildCaseSection(caseRecord);
    const incidents = reportBuilder.buildIncidentSections(
      caseRecord.incidents ?? [],
      input.includeAI !== false
    );
    const evidence = reportBuilder.buildEvidenceInventory(evidenceRecords, caseRecord);
    const integrity = reportBuilder.buildIntegritySection(evidenceRecords, auditLogs);
    const custody = reportBuilder.buildCustodySection(custodyEvents);
    const audit = reportBuilder.buildAuditSection(auditLogs);
    const aiSection = reportBuilder.buildAISection(aiAnalyses);
    const activityTimeline = reportBuilder.buildActivityTimeline(auditLogs, custodyEvents);

    const reportContent = {
      case: caseSection,
      incidents,
      evidence,
      integrity,
      custody,
      audit,
      aiAnalysis: aiSection,
      activityTimeline,
      summary: '',
      limitations: [] as string[],
      disclaimer: REPORT_DISCLAIMER,
    };

    reportContent.summary = reportBuilder.buildSummary(reportContent);
    reportContent.limitations = reportBuilder.buildLimitations(reportContent);

    return this.finalizeReport(
      reportContent,
      REPORT_TYPES.DETAILED_CASE_REPORT,
      user,
      caseRecord.caseNumber
    );
  }

  /**
   * INCIDENT_REPORT: Focused incident report with parent case context.
   */
  private async generateIncidentReport(
    incidentId: string,
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        case: {
          include: {
            leadInvestigator: { select: userSelect },
            members: { include: { user: { select: userSelect } } },
          },
        },
        assignedTo: { select: userSelect },
        aiAnalyses: input.includeAI !== false ? true : false,
        evidence: {
          include: {
            uploadedBy: { select: userSelect },
            case: { select: { caseNumber: true } },
            incident: { select: { incidentNumber: true } },
          },
        },
      },
    });

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    const caseSection = reportBuilder.buildCaseSection(incident.case);
    const incidents = reportBuilder.buildIncidentSections(
      [incident],
      input.includeAI !== false
    );
    const evidence = reportBuilder.buildEvidenceInventory(
      incident.evidence ?? [],
      incident.case
    );

    const reportContent = {
      case: caseSection,
      incidents,
      evidence,
      integrity: [] as InvestigationReport['integrity'],
      custody: [] as InvestigationReport['custody'],
      audit: [] as InvestigationReport['audit'],
      aiAnalysis: [] as InvestigationReport['aiAnalysis'],
      activityTimeline: [] as InvestigationReport['activityTimeline'],
      summary: '',
      limitations: [] as string[],
      disclaimer: REPORT_DISCLAIMER,
    };

    // Include AI analysis if available
    if (input.includeAI !== false && incident.aiAnalyses) {
      reportContent.aiAnalysis = reportBuilder.buildAISection(incident.aiAnalyses);
    }

    reportContent.summary = reportBuilder.buildSummary(reportContent);
    reportContent.limitations = reportBuilder.buildLimitations(reportContent);

    return this.finalizeReport(
      reportContent,
      REPORT_TYPES.INCIDENT_REPORT,
      user,
      incident.case.caseNumber,
      incident.incidentNumber
    );
  }

  /**
   * EVIDENCE_REPORT: Detailed single-evidence report with integrity, custody, audit, AI.
   */
  private async generateEvidenceReport(
    evidenceId: string,
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    const evidenceRecord = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        uploadedBy: { select: userSelect },
        case: {
          include: {
            leadInvestigator: { select: userSelect },
            members: { include: { user: { select: userSelect } } },
          },
        },
        incident: { select: { incidentNumber: true } },
        custodyEvents:
          input.includeCustody !== false
            ? {
                include: {
                  fromUser: { select: userSelect },
                  toUser: { select: userSelect },
                  actorUser: { select: userSelect },
                },
                orderBy: { eventAt: 'asc' as const },
              }
            : false,
        auditLogs:
          input.includeAudit !== false
            ? {
                include: {
                  actorUser: { select: userSelect },
                },
                orderBy: { createdAt: 'asc' as const },
              }
            : false,
        aiAnalyses: input.includeAI !== false ? true : false,
      },
    });

    if (!evidenceRecord) {
      throw new AppError('Evidence not found', 404);
    }

    const caseSection = reportBuilder.buildCaseSection(evidenceRecord.case);
    const evidence = reportBuilder.buildEvidenceInventory(
      [evidenceRecord],
      evidenceRecord.case
    );
    const integrity = reportBuilder.buildIntegritySection(
      [evidenceRecord],
      evidenceRecord.auditLogs || []
    );
    const custody = reportBuilder.buildCustodySection(
      evidenceRecord.custodyEvents || []
    );
    const audit = reportBuilder.buildAuditSection(
      evidenceRecord.auditLogs || []
    );
    const aiSection = reportBuilder.buildAISection(
      evidenceRecord.aiAnalyses || []
    );
    const activityTimeline = reportBuilder.buildActivityTimeline(
      evidenceRecord.auditLogs || [],
      evidenceRecord.custodyEvents || []
    );

    const reportContent = {
      case: caseSection,
      incidents: [] as InvestigationReport['incidents'],
      evidence,
      integrity,
      custody,
      audit,
      aiAnalysis: aiSection,
      activityTimeline,
      summary: '',
      limitations: [] as string[],
      disclaimer: REPORT_DISCLAIMER,
    };

    reportContent.summary = reportBuilder.buildSummary(reportContent);
    reportContent.limitations = reportBuilder.buildLimitations(reportContent);

    return this.finalizeReport(
      reportContent,
      REPORT_TYPES.EVIDENCE_REPORT,
      user,
      evidenceRecord.case.caseNumber,
      undefined,
      evidenceRecord.evidenceNumber
    );
  }

  /**
   * CHAIN_OF_CUSTODY_REPORT: Full custody chain for a single evidence item.
   */
  private async generateCustodyReport(
    evidenceId: string,
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    const evidenceRecord = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        uploadedBy: { select: userSelect },
        case: {
          include: {
            leadInvestigator: { select: userSelect },
            members: { include: { user: { select: userSelect } } },
          },
        },
        incident: { select: { incidentNumber: true } },
        custodyEvents: {
          include: {
            fromUser: { select: userSelect },
            toUser: { select: userSelect },
            actorUser: { select: userSelect },
          },
          orderBy: { eventAt: 'asc' },
        },
      },
    });

    if (!evidenceRecord) {
      throw new AppError('Evidence not found', 404);
    }

    const caseSection = reportBuilder.buildCaseSection(evidenceRecord.case);
    const evidence = reportBuilder.buildEvidenceInventory(
      [evidenceRecord],
      evidenceRecord.case
    );
    const custody = reportBuilder.buildCustodySection(evidenceRecord.custodyEvents);

    const reportContent = {
      case: caseSection,
      incidents: [] as InvestigationReport['incidents'],
      evidence,
      integrity: [] as InvestigationReport['integrity'],
      custody,
      audit: [] as InvestigationReport['audit'],
      aiAnalysis: [] as InvestigationReport['aiAnalysis'],
      activityTimeline: [] as InvestigationReport['activityTimeline'],
      summary: '',
      limitations: [] as string[],
      disclaimer: REPORT_DISCLAIMER,
    };

    reportContent.summary = reportBuilder.buildSummary(reportContent);
    reportContent.limitations = reportBuilder.buildLimitations(reportContent);

    return this.finalizeReport(
      reportContent,
      REPORT_TYPES.CHAIN_OF_CUSTODY_REPORT,
      user,
      evidenceRecord.case.caseNumber,
      undefined,
      evidenceRecord.evidenceNumber
    );
  }

  /**
   * AI_ANALYSIS_REPORT: All AI analyses for evidence or incident with related case, evidence, custody, and audit context.
   */
  private async generateAIReport(
    input: ReportGenerationInput,
    user: ReportUser
  ): Promise<InvestigationReport> {
    const where: { evidenceId?: string; incidentId?: string } = {};
    if (input.evidenceId) where.evidenceId = input.evidenceId;
    if (input.incidentId) where.incidentId = input.incidentId;

    const analyses = await prisma.aIAnalysis.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (analyses.length === 0) {
      throw new AppError('No AI analyses found for the specified entity', 404);
    }

    // Fetch parent context and associated entities
    let caseNumber: string | undefined;
    let evidenceNumber: string | undefined;
    let incidentNumber: string | undefined;

    let caseSection: InvestigationReport['case'] = null;
    let incidents: InvestigationReport['incidents'] = [];
    let evidence: InvestigationReport['evidence'] = [];
    let integrity: InvestigationReport['integrity'] = [];
    let custody: InvestigationReport['custody'] = [];
    let audit: InvestigationReport['audit'] = [];
    let activityTimeline: InvestigationReport['activityTimeline'] = [];

    if (input.evidenceId) {
      const ev = await prisma.evidence.findUnique({
        where: { id: input.evidenceId },
        include: {
          uploadedBy: { select: userSelect },
          case: {
            include: {
              leadInvestigator: { select: userSelect },
              members: { include: { user: { select: userSelect } } },
            },
          },
          incident: {
            include: {
              assignedTo: { select: userSelect },
            },
          },
          custodyEvents:
            input.includeCustody !== false
              ? {
                  include: {
                    fromUser: { select: userSelect },
                    toUser: { select: userSelect },
                    actorUser: { select: userSelect },
                  },
                  orderBy: { eventAt: 'asc' as const },
                }
              : false,
          auditLogs:
            input.includeAudit !== false
              ? {
                  include: {
                    actorUser: { select: userSelect },
                  },
                  orderBy: { createdAt: 'asc' as const },
                }
              : false,
        },
      });

      if (!ev) {
        throw new AppError('Evidence not found', 404);
      }

      caseNumber = ev.case.caseNumber;
      evidenceNumber = ev.evidenceNumber;
      if (ev.incident) {
        incidentNumber = ev.incident.incidentNumber;
        incidents = reportBuilder.buildIncidentSections([ev.incident], false);
      }

      caseSection = reportBuilder.buildCaseSection(ev.case);
      evidence = reportBuilder.buildEvidenceInventory([ev], ev.case);
      integrity = reportBuilder.buildIntegritySection([ev], ev.auditLogs || []);

      if (input.includeCustody !== false && ev.custodyEvents) {
        custody = reportBuilder.buildCustodySection(ev.custodyEvents);
      }

      if (input.includeAudit !== false && ev.auditLogs) {
        audit = reportBuilder.buildAuditSection(ev.auditLogs);
      }

      activityTimeline = reportBuilder.buildActivityTimeline(
        ev.auditLogs || [],
        ev.custodyEvents || []
      );
    }

    if (input.incidentId && !input.evidenceId) {
      const inc = await prisma.incident.findUnique({
        where: { id: input.incidentId },
        include: {
          case: {
            include: {
              leadInvestigator: { select: userSelect },
              members: { include: { user: { select: userSelect } } },
            },
          },
          assignedTo: { select: userSelect },
          evidence: {
            include: {
              uploadedBy: { select: userSelect },
              case: { select: { caseNumber: true } },
              incident: { select: { incidentNumber: true } },
              custodyEvents:
                input.includeCustody !== false
                  ? {
                      include: {
                        fromUser: { select: userSelect },
                        toUser: { select: userSelect },
                        actorUser: { select: userSelect },
                      },
                      orderBy: { eventAt: 'asc' as const },
                    }
                  : false,
              auditLogs:
                input.includeAudit !== false
                  ? {
                      include: {
                        actorUser: { select: userSelect },
                      },
                      orderBy: { createdAt: 'asc' as const },
                    }
                  : false,
            },
          },
        },
      });

      if (!inc) {
        throw new AppError('Incident not found', 404);
      }

      caseNumber = inc.case.caseNumber;
      incidentNumber = inc.incidentNumber;

      caseSection = reportBuilder.buildCaseSection(inc.case);
      incidents = reportBuilder.buildIncidentSections([inc], false);

      if (inc.evidence && inc.evidence.length > 0) {
        evidence = reportBuilder.buildEvidenceInventory(inc.evidence, inc.case);
        const allAuditLogs = inc.evidence.flatMap((e) => e.auditLogs || []);
        const allCustodyEvents = inc.evidence.flatMap((e) => e.custodyEvents || []);

        integrity = reportBuilder.buildIntegritySection(inc.evidence, allAuditLogs);

        if (input.includeCustody !== false) {
          custody = reportBuilder.buildCustodySection(allCustodyEvents);
        }

        if (input.includeAudit !== false) {
          audit = reportBuilder.buildAuditSection(allAuditLogs);
        }

        activityTimeline = reportBuilder.buildActivityTimeline(
          allAuditLogs,
          allCustodyEvents
        );
      }
    }

    const aiSection = reportBuilder.buildAISection(analyses);

    const reportContent = {
      case: caseSection,
      incidents,
      evidence,
      integrity,
      custody,
      audit,
      aiAnalysis: aiSection,
      activityTimeline,
      summary: '',
      limitations: [] as string[],
      disclaimer: REPORT_DISCLAIMER,
    };

    reportContent.summary = reportBuilder.buildSummary(reportContent);
    reportContent.limitations = reportBuilder.buildLimitations(reportContent);

    return this.finalizeReport(
      reportContent,
      REPORT_TYPES.AI_ANALYSIS_REPORT,
      user,
      caseNumber,
      incidentNumber,
      evidenceNumber
    );
  }

  // ─── Private Helpers ────────────────────────────────────────

  /**
   * Fetch a case with all relations needed for reporting.
   */
  private async fetchCase(caseId: string) {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        leadInvestigator: { select: userSelect },
        members: { include: { user: { select: userSelect } } },
        incidents: {
          include: {
            assignedTo: { select: userSelect },
            aiAnalyses: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!caseRecord) {
      throw new AppError('Case not found', 404);
    }

    return caseRecord;
  }

  /**
   * Finalize report: compute hash, attach metadata, return complete report.
   */
  private finalizeReport(
    content: Omit<InvestigationReport, 'reportMetadata'>,
    reportType: ReportType,
    user: ReportUser,
    caseNumber?: string,
    incidentNumber?: string,
    evidenceNumber?: string
  ): InvestigationReport {
    const metadataWithoutHash = {
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
      },
      ...(caseNumber ? { caseNumber } : {}),
      ...(incidentNumber ? { incidentNumber } : {}),
      ...(evidenceNumber ? { evidenceNumber } : {}),
      classification: content.case?.classification ?? 'INTERNAL',
    };

    // Compute report hash from content + metadata (without reportHash itself)
    const reportHash = reportBuilder.computeReportHash({
      ...content,
      reportMetadata: metadataWithoutHash,
    });

    return {
      reportMetadata: {
        ...metadataWithoutHash,
        reportHash,
      },
      ...content,
    };
  }
}

export const reportService = new ReportService();
