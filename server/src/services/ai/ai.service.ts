import prisma from '../../config/database';
import {
  AIAnalysisType,
  AIAnalysisStatus,
  EvidenceAuditAction,
  AuditResult,
  Prisma,
} from '@prisma/client';
import {
  AIAnalysisRequestInput,
  AIIncidentClassifyInput,
  AIAnalysisResponse,
  AIStructuredOutput,
} from '../../types/ai.types';
import { structuredAIOutputSchema } from '../../validators/ai.validator';
import { preprocessEvidenceFile } from './evidence-preprocessor';
import { getAIProvider } from './ai-provider.factory';
import { custodyService, AuditContext } from '../custody.service';
import { AppError } from '../../utils/errors';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAIAnalysisResponse(analysis: any): AIAnalysisResponse {
  return {
    id: analysis.id,
    evidenceId: analysis.evidenceId ?? null,
    incidentId: analysis.incidentId ?? null,
    caseId: analysis.caseId,
    analysisType: analysis.analysisType,
    provider: analysis.provider,
    model: analysis.model,
    status: analysis.status,
    inputHash: analysis.inputHash,
    result: (analysis.result as AIStructuredOutput) ?? null,
    summary: analysis.summary ?? null,
    confidence: analysis.confidence ?? null,
    createdAt: new Date(analysis.createdAt).toISOString(),
    completedAt: analysis.completedAt ? new Date(analysis.completedAt).toISOString() : null,
    errorMessage: analysis.errorMessage ?? null,
    createdBy: analysis.createdBy
      ? {
          id: analysis.createdBy.id,
          firstName: analysis.createdBy.firstName,
          lastName: analysis.createdBy.lastName,
          email: analysis.createdBy.email,
        }
      : undefined,
    evidence: analysis.evidence
      ? {
          id: analysis.evidence.id,
          evidenceNumber: analysis.evidence.evidenceNumber,
          originalFilename: analysis.evidence.originalFilename,
          evidenceType: analysis.evidence.evidenceType,
        }
      : null,
    incident: analysis.incident
      ? {
          id: analysis.incident.id,
          incidentNumber: analysis.incident.incidentNumber,
          title: analysis.incident.title,
          severity: analysis.incident.severity,
        }
      : null,
    case: analysis.case
      ? {
          id: analysis.case.id,
          caseNumber: analysis.case.caseNumber,
          title: analysis.case.title,
        }
      : undefined,
  };
}

export class AIService {
  /**
   * Initiates controlled AI analysis on an evidence artifact.
   *
   * Security & Integrity Pipeline:
   * 1. Authenticate & Authorize (ADMIN, INVESTIGATOR, ANALYST)
   * 2. Verify physical file presence on disk
   * 3. Pre-flight SHA-256 integrity check against stored checksum
   * 4. Preprocess and truncate text content safely
   * 5. Compute inputHash (SHA-256 of normalized text)
   * 6. Check duplicate completed analysis (reuse cached result unless force: true)
   * 7. Track state transitions: PENDING -> PROCESSING -> COMPLETED/FAILED
   * 8. Validate output strictly with Zod schema
   * 9. Append tamper-evident audit log
   */
  async analyzeEvidence(
    evidenceId: string,
    input: AIAnalysisRequestInput,
    actorId: string,
    ctx?: AuditContext
  ): Promise<AIAnalysisResponse> {
    // 1. Fetch evidence record
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        incident: { select: { id: true, incidentNumber: true, title: true } },
      },
    });

    if (!evidence) {
      throw new AppError('Evidence record not found', 404);
    }

    // 2. Preprocess & verify physical SHA-256
    let preprocessed;
    try {
      preprocessed = await preprocessEvidenceFile(evidence);
    } catch (err) {
      // If integrity mismatch or file error, record an audit event for forensic accountability
      if (err instanceof AppError && err.statusCode === 409) {
        await custodyService.appendAuditLog(prisma, {
          evidenceId,
          actorUserId: actorId,
          action: EvidenceAuditAction.AI_ANALYSIS_FAILED,
          result: AuditResult.FAILURE,
          ipAddress: ctx?.ipAddress,
          userAgent: ctx?.userAgent,
          metadata: {
            reason: 'Physical file SHA-256 mismatch detected before AI submission',
            analysisType: input.analysisType,
          },
        });
      }
      throw err;
    }

    const { content, inputHash } = preprocessed;

    // 3. Resolve AI provider first to ensure provider provenance and configuration check
    const provider = getAIProvider(input.provider);

    // 4. Duplicate check: If identical inputHash, analysisType, and provider was completed and !force, return existing
    if (!input.force) {
      const existing = await prisma.aIAnalysis.findFirst({
        where: {
          evidenceId,
          analysisType: input.analysisType,
          provider: provider.name,
          inputHash,
          status: AIAnalysisStatus.COMPLETED,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          evidence: { select: { id: true, evidenceNumber: true, originalFilename: true, evidenceType: true } },
          incident: { select: { id: true, incidentNumber: true, title: true, severity: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      if (existing) {
        return formatAIAnalysisResponse(existing);
      }
    }

    // 5. Create AIAnalysis in PROCESSING state
    const analysisRecord = await prisma.aIAnalysis.create({
      data: {
        evidenceId,
        incidentId: evidence.incidentId,
        caseId: evidence.caseId,
        analysisType: input.analysisType,
        provider: provider.name,
        model: provider.defaultModel,
        status: AIAnalysisStatus.PROCESSING,
        inputHash,
        createdById: actorId,
      },
    });

    // 6. Record audit log for analysis initiation
    await custodyService.appendAuditLog(prisma, {
      evidenceId,
      actorUserId: actorId,
      action: EvidenceAuditAction.AI_ANALYSIS_REQUESTED,
      result: AuditResult.SUCCESS,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      metadata: {
        analysisId: analysisRecord.id,
        analysisType: input.analysisType,
        provider: provider.name,
        model: provider.defaultModel,
        inputHash,
      },
    });

    // 7. Invoke provider and validate response
    try {
      const providerResult = await provider.analyzeEvidence({
        analysisType: input.analysisType,
        contextDescription: `Evidence ${evidence.evidenceNumber} (${evidence.originalFilename}) under Case ${evidence.case.caseNumber}`,
        content,
      });

      // Strict Zod schema validation
      const validatedOutput = structuredAIOutputSchema.parse(providerResult.structuredOutput);

      // 8. Update to COMPLETED
      const updated = await prisma.aIAnalysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: AIAnalysisStatus.COMPLETED,
          result: validatedOutput as unknown as Prisma.InputJsonValue,
          summary: validatedOutput.summary,
          confidence: validatedOutput.confidence,
          completedAt: new Date(),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          evidence: { select: { id: true, evidenceNumber: true, originalFilename: true, evidenceType: true } },
          incident: { select: { id: true, incidentNumber: true, title: true, severity: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      // 9. Record completion in audit log
      await custodyService.appendAuditLog(prisma, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.AI_ANALYSIS_COMPLETED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          analysisId: analysisRecord.id,
          analysisType: input.analysisType,
          confidence: validatedOutput.confidence,
          findingsCount: validatedOutput.findings.length,
          indicatorsCount: validatedOutput.indicators.length,
        },
      });

      return formatAIAnalysisResponse(updated);
    } catch (error) {
      // 10. Handle provider error or schema mismatch safely
      const safeMessage = error instanceof Error ? error.message : 'Unknown AI processing error';

      await prisma.aIAnalysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: AIAnalysisStatus.FAILED,
          errorMessage: safeMessage,
          completedAt: new Date(),
        },
      });

      await custodyService.appendAuditLog(prisma, {
        evidenceId,
        actorUserId: actorId,
        action: EvidenceAuditAction.AI_ANALYSIS_FAILED,
        result: AuditResult.FAILURE,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          analysisId: analysisRecord.id,
          analysisType: input.analysisType,
          errorMessage: safeMessage,
        },
      });

      throw new AppError(`AI analysis failed: ${safeMessage}`, 502);
    }
  }

  /**
   * Performs advisory incident classification.
   * Note: The incident's status and severity in the database are NOT modified.
   */
  async classifyIncident(
    incidentId: string,
    input: AIIncidentClassifyInput,
    actorId: string,
    _ctx?: AuditContext
  ): Promise<AIAnalysisResponse> {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        evidence: {
          select: {
            id: true,
            evidenceNumber: true,
            evidenceType: true,
            description: true,
          },
          take: 5,
        },
      },
    });

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    // Build sanitized incident representation
    const evidenceSummaries = incident.evidence.map(
      (e) => `[${e.evidenceNumber}] (${e.evidenceType}): ${e.description || 'No description'}`
    );

    const contextPayload = JSON.stringify({
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      description: incident.description || '',
      incidentType: incident.incidentType,
      category: incident.category,
      severity: incident.severity,
      priority: incident.priority,
      source: incident.source,
      evidenceSummaries,
    });

    const inputHash = crypto.createHash('sha256').update(contextPayload, 'utf8').digest('hex');

    // Resolve AI provider first to ensure provider provenance and configuration check
    const provider = getAIProvider(input.provider);

    // Duplicate check: If identical inputHash, analysisType, and provider was completed and !force, return existing
    if (!input.force) {
      const existing = await prisma.aIAnalysis.findFirst({
        where: {
          incidentId,
          analysisType: AIAnalysisType.INCIDENT_CLASSIFICATION,
          provider: provider.name,
          inputHash,
          status: AIAnalysisStatus.COMPLETED,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          evidence: { select: { id: true, evidenceNumber: true, originalFilename: true, evidenceType: true } },
          incident: { select: { id: true, incidentNumber: true, title: true, severity: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      if (existing) {
        return formatAIAnalysisResponse(existing);
      }
    }

    const analysisRecord = await prisma.aIAnalysis.create({
      data: {
        incidentId,
        caseId: incident.caseId,
        analysisType: AIAnalysisType.INCIDENT_CLASSIFICATION,
        provider: provider.name,
        model: provider.defaultModel,
        status: AIAnalysisStatus.PROCESSING,
        inputHash,
        createdById: actorId,
      },
    });

    try {
      const providerResult = await provider.classifyIncident({
        title: incident.title,
        description: incident.description,
        incidentType: incident.incidentType,
        category: incident.category,
        severity: incident.severity,
        priority: incident.priority,
        source: incident.source,
        evidenceSummaries,
      });

      const validatedOutput = structuredAIOutputSchema.parse(providerResult.structuredOutput);

      const updated = await prisma.aIAnalysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: AIAnalysisStatus.COMPLETED,
          result: validatedOutput as unknown as Prisma.InputJsonValue,
          summary: validatedOutput.summary,
          confidence: validatedOutput.confidence,
          completedAt: new Date(),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          evidence: { select: { id: true, evidenceNumber: true, originalFilename: true, evidenceType: true } },
          incident: { select: { id: true, incidentNumber: true, title: true, severity: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      });

      return formatAIAnalysisResponse(updated);
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Unknown incident classification error';

      await prisma.aIAnalysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: AIAnalysisStatus.FAILED,
          errorMessage: safeMessage,
          completedAt: new Date(),
        },
      });

      throw new AppError(`Incident classification failed: ${safeMessage}`, 502);
    }
  }

  /**
   * Retrieves paginated AI analysis history for an evidence record.
   */
  async listEvidenceAnalyses(
    evidenceId: string,
    query: {
      analysisType?: AIAnalysisType;
      status?: AIAnalysisStatus;
      page: number;
      limit: number;
    }
  ): Promise<{ data: AIAnalysisResponse[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const evidenceExists = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true },
    });

    if (!evidenceExists) {
      throw new AppError('Evidence record not found', 404);
    }

    const where: Prisma.AIAnalysisWhereInput = {
      evidenceId,
    };

    if (query.analysisType) {
      where.analysisType = query.analysisType;
    }
    if (query.status) {
      where.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, records] = await Promise.all([
      prisma.aIAnalysis.count({ where }),
      prisma.aIAnalysis.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          evidence: { select: { id: true, evidenceNumber: true, originalFilename: true, evidenceType: true } },
          incident: { select: { id: true, incidentNumber: true, title: true, severity: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: records.map(formatAIAnalysisResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves details of a single AI analysis by UUID.
   */
  async getAnalysisById(analysisId: string): Promise<AIAnalysisResponse> {
    const analysis = await prisma.aIAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        evidence: { select: { id: true, evidenceNumber: true, originalFilename: true, evidenceType: true } },
        incident: { select: { id: true, incidentNumber: true, title: true, severity: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    if (!analysis) {
      throw new AppError('AI analysis record not found', 404);
    }

    return formatAIAnalysisResponse(analysis);
  }
}

export const aiService = new AIService();
