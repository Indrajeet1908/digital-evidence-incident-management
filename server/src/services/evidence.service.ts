import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { generateEvidenceNumber } from '../utils/evidence-number';
import { calculateFileSha256 } from '../utils/file-hash';
import {
  CreateEvidenceInput,
  UpdateEvidenceMetadataInput,
  ListEvidenceQueryInput,
} from '../validators/evidence.validator';
import {
  EvidenceResponse,
  EvidenceIntegrityResponse,
} from '../types/evidence.types';
import {
  CustodyEventType,
  EvidenceAuditAction,
  AuditResult,
} from '../types/custody.types';
import { custodyService, AuditContext } from './custody.service';
import { Prisma } from '@prisma/client';

/**
 * Safely removes a file from disk if it exists, logging any cleanup errors.
 */
function safeDeleteFile(filePath?: string): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Failed to clean up file at ${filePath}:`, err);
  }
}

/**
 * Formats an Evidence Prisma model into a sanitized EvidenceResponse.
 * Omits internal filesystem paths and stored filenames to prevent leakage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatEvidenceResponse(evidence: any): EvidenceResponse {
  return {
    id: evidence.id,
    evidenceNumber: evidence.evidenceNumber,
    caseId: evidence.caseId,
    incidentId: evidence.incidentId ?? null,
    originalFilename: evidence.originalFilename,
    fileSize: Number(evidence.fileSize),
    mimeType: evidence.mimeType,
    sha256: evidence.sha256,
    evidenceType: evidence.evidenceType,
    description: evidence.description ?? null,
    source: evidence.source,
    collectedAt: evidence.collectedAt
      ? new Date(evidence.collectedAt).toISOString()
      : null,
    uploadedById: evidence.uploadedById,
    createdAt: new Date(evidence.createdAt).toISOString(),
    updatedAt: new Date(evidence.updatedAt).toISOString(),
    case: evidence.case
      ? {
          id: evidence.case.id,
          caseNumber: evidence.case.caseNumber,
          title: evidence.case.title,
          status: evidence.case.status,
        }
      : undefined,
    incident:
      evidence.incident !== undefined
        ? evidence.incident
          ? {
              id: evidence.incident.id,
              incidentNumber: evidence.incident.incidentNumber,
              title: evidence.incident.title,
              status: evidence.incident.status,
            }
          : null
        : undefined,
    uploadedBy: evidence.uploadedBy
      ? {
          id: evidence.uploadedBy.id,
          firstName: evidence.uploadedBy.firstName,
          lastName: evidence.uploadedBy.lastName,
          email: evidence.uploadedBy.email,
        }
      : undefined,
  };
}

export class EvidenceService {
  /**
   * Securely ingests and registers an uploaded evidence file.
   * Calculates streaming SHA-256 hash, links Case and optional Incident,
   * stores metadata in PostgreSQL, initializes the initial Chain of Custody event (UPLOADED),
   * records the initial Audit Log entry, and cleans up the stored file if insertion fails.
   */
  async createEvidence(
    input: CreateEvidenceInput,
    file: Express.Multer.File | undefined,
    uploaderId: string,
    ctx?: AuditContext
  ): Promise<EvidenceResponse> {
    if (!file) {
      throw new AppError('Evidence file is required', 400);
    }

    // Sanitize original filename (prevent path traversal characters in metadata)
    const sanitizedFilename = path.basename(file.originalname).trim() || 'evidence.bin';

    // 1. Verify Case exists
    const existingCase = await prisma.case.findUnique({
      where: { id: input.caseId },
    });

    if (!existingCase) {
      safeDeleteFile(file.path);
      throw new AppError('Case not found', 404);
    }

    // 2. Verify Incident if supplied
    if (input.incidentId) {
      const existingIncident = await prisma.incident.findUnique({
        where: { id: input.incidentId },
      });

      if (!existingIncident) {
        safeDeleteFile(file.path);
        throw new AppError('Incident not found', 404);
      }

      if (existingIncident.caseId !== input.caseId) {
        safeDeleteFile(file.path);
        throw new AppError(
          'Incident does not belong to the specified Case',
          400
        );
      }
    }

    // 3. Compute SHA-256 streaming hash from the stored file
    let sha256: string;
    try {
      sha256 = await calculateFileSha256(file.path);
    } catch (hashErr) {
      safeDeleteFile(file.path);
      throw new AppError('Failed to compute evidence SHA-256 hash', 500, hashErr);
    }

    // 4. Generate unique evidence number server-side
    const evidenceNumber = await generateEvidenceNumber();

    // 5. Transactionally create Evidence record, initial UPLOADED custody event, and initial audit log
    try {
      const createdEvidence = await prisma.$transaction(async (tx) => {
        const evidence = await tx.evidence.create({
          data: {
            evidenceNumber,
            caseId: input.caseId,
            incidentId: input.incidentId ?? null,
            originalFilename: sanitizedFilename,
            storedFilename: file.filename,
            storagePath: file.path,
            fileSize: BigInt(file.size),
            mimeType: file.mimetype || 'application/octet-stream',
            sha256,
            evidenceType: input.evidenceType,
            description: input.description ?? null,
            source: input.source,
            collectedAt: input.collectedAt ?? null,
            uploadedById: uploaderId,
          },
          include: {
            case: {
              select: { id: true, caseNumber: true, title: true, status: true },
            },
            incident: {
              select: { id: true, incidentNumber: true, title: true, status: true },
            },
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        });

        // Initial Custody Event: UPLOADED
        await custodyService.appendCustodyEvent(tx, {
          evidenceId: evidence.id,
          eventType: CustodyEventType.UPLOADED,
          fromUserId: null,
          toUserId: uploaderId,
          actorUserId: uploaderId,
          reason: 'Initial evidence ingestion and secure storage',
          location: 'Digital Evidence Storage Repository',
          eventAt: new Date(),
        });

        // Initial Audit Log: UPLOADED
        await custodyService.appendAuditLog(tx, {
          evidenceId: evidence.id,
          actorUserId: uploaderId,
          action: EvidenceAuditAction.UPLOADED,
          result: AuditResult.SUCCESS,
          ipAddress: ctx?.ipAddress,
          userAgent: ctx?.userAgent,
          metadata: {
            evidenceNumber: evidence.evidenceNumber,
            originalFilename: sanitizedFilename,
            fileSize: file.size,
            mimeType: file.mimetype || 'application/octet-stream',
            sha256,
          },
        });

        return evidence;
      });

      return formatEvidenceResponse(createdEvidence);
    } catch (dbErr) {
      safeDeleteFile(file.path);
      throw dbErr;
    }
  }

  /**
   * Lists evidence records with search, filtering, and pagination.
   */
  async listEvidence(query: ListEvidenceQueryInput) {
    const {
      caseId,
      incidentId,
      evidenceType,
      source,
      uploadedById,
      search,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.EvidenceWhereInput = {};

    if (caseId) where.caseId = caseId;
    if (incidentId) where.incidentId = incidentId;
    if (evidenceType) where.evidenceType = evidenceType;
    if (source) where.source = source;
    if (uploadedById) where.uploadedById = uploadedById;

    if (search) {
      where.OR = [
        { evidenceNumber: { contains: search, mode: 'insensitive' } },
        { originalFilename: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      prisma.evidence.count({ where }),
      prisma.evidence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case: {
            select: { id: true, caseNumber: true, title: true, status: true },
          },
          incident: {
            select: { id: true, incidentNumber: true, title: true, status: true },
          },
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: records.map(formatEvidenceResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves full evidence metadata by ID and records a VIEWED audit log.
   */
  async getEvidenceById(
    id: string,
    actorId?: string,
    ctx?: AuditContext
  ): Promise<EvidenceResponse> {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: {
        case: {
          select: { id: true, caseNumber: true, title: true, status: true },
        },
        incident: {
          select: { id: true, incidentNumber: true, title: true, status: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    if (actorId) {
      await custodyService.appendAuditLog(prisma, {
        evidenceId: id,
        actorUserId: actorId,
        action: EvidenceAuditAction.VIEWED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
      });
    }

    return formatEvidenceResponse(evidence);
  }

  /**
   * Retrieves physical file metadata, verifies file presence on disk for secure download,
   * and records a DOWNLOADED audit log.
   */
  async getEvidenceDownload(
    id: string,
    actorId?: string,
    ctx?: AuditContext
  ) {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      select: {
        id: true,
        originalFilename: true,
        storedFilename: true,
        storagePath: true,
        mimeType: true,
        fileSize: true,
      },
    });

    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    if (!fs.existsSync(evidence.storagePath)) {
      throw new AppError('Evidence physical file is missing from storage', 500);
    }

    if (actorId) {
      await custodyService.appendAuditLog(prisma, {
        evidenceId: id,
        actorUserId: actorId,
        action: EvidenceAuditAction.DOWNLOADED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          originalFilename: evidence.originalFilename,
          fileSize: Number(evidence.fileSize),
        },
      });
    }

    return {
      filePath: evidence.storagePath,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      fileSize: Number(evidence.fileSize),
    };
  }

  /**
   * Records an audit log for an unauthorized/denied operation (e.g. VIEWER download attempt).
   */
  async recordDeniedAccess(
    evidenceId: string,
    actorId: string,
    action: EvidenceAuditAction,
    ctx?: AuditContext
  ): Promise<void> {
    try {
      const exists = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        select: { id: true },
      });
      if (exists) {
        await custodyService.appendAuditLog(prisma, {
          evidenceId,
          actorUserId: actorId,
          action,
          result: AuditResult.DENIED,
          ipAddress: ctx?.ipAddress,
          userAgent: ctx?.userAgent,
        });
      }
    } catch (err) {
      console.error('Failed to record denied access audit log:', err);
    }
  }

  /**
   * Performs on-demand SHA-256 integrity verification against the physical file on disk
   * and records an INTEGRITY_CHECKED audit log.
   */
  async verifyIntegrity(
    id: string,
    actorId?: string,
    ctx?: AuditContext
  ): Promise<EvidenceIntegrityResponse> {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      select: {
        id: true,
        sha256: true,
        storagePath: true,
      },
    });

    if (!evidence) {
      throw new AppError('Evidence not found', 404);
    }

    if (!fs.existsSync(evidence.storagePath)) {
      throw new AppError('Evidence physical file is missing from storage', 500);
    }

    const currentHash = await calculateFileSha256(evidence.storagePath);
    const matches = currentHash.toLowerCase() === evidence.sha256.toLowerCase();

    if (actorId) {
      await custodyService.appendAuditLog(prisma, {
        evidenceId: id,
        actorUserId: actorId,
        action: EvidenceAuditAction.INTEGRITY_CHECKED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          integrity: matches ? 'VALID' : 'MISMATCH',
          storedHash: evidence.sha256,
          currentHash,
        },
      });
    }

    return {
      evidenceId: evidence.id,
      storedHash: evidence.sha256,
      currentHash,
      integrity: matches ? 'VALID' : 'MISMATCH',
    };
  }

  /**
   * Updates non-immutable evidence metadata and records a METADATA_UPDATED audit log.
   */
  async updateMetadata(
    id: string,
    input: UpdateEvidenceMetadataInput,
    actorId?: string,
    ctx?: AuditContext
  ): Promise<EvidenceResponse> {
    const existing = await prisma.evidence.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Evidence not found', 404);
    }

    const updated = await prisma.evidence.update({
      where: { id },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.evidenceType !== undefined && { evidenceType: input.evidenceType }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.collectedAt !== undefined && { collectedAt: input.collectedAt }),
      },
      include: {
        case: {
          select: { id: true, caseNumber: true, title: true, status: true },
        },
        incident: {
          select: { id: true, incidentNumber: true, title: true, status: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (actorId) {
      await custodyService.appendAuditLog(prisma, {
        evidenceId: id,
        actorUserId: actorId,
        action: EvidenceAuditAction.METADATA_UPDATED,
        result: AuditResult.SUCCESS,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        metadata: {
          updatedFields: Object.keys(input),
        },
      });
    }

    return formatEvidenceResponse(updated);
  }
}

export const evidenceService = new EvidenceService();
