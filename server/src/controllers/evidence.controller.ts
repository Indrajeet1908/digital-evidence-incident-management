import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import {
  createEvidenceSchema,
  updateEvidenceMetadataSchema,
  listEvidenceQuerySchema,
} from '../validators/evidence.validator';
import { evidenceService } from '../services/evidence.service';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

function safeCleanupUploadedFile(file?: Express.Multer.File): void {
  if (file?.path) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup file after validation error:', cleanupErr);
    }
  }
}

export class EvidenceController {
  /**
   * POST /api/evidence
   * Ingests and stores an evidence file along with metadata.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        safeCleanupUploadedFile(req.file);
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'Evidence file is required',
        });
        return;
      }

      const parseResult = createEvidenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        safeCleanupUploadedFile(req.file);
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const created = await evidenceService.createEvidence(
        parseResult.data,
        req.file,
        req.user.id
      );

      res.status(201).json({
        message: 'Evidence uploaded successfully',
        evidence: created,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/evidence
   * Lists evidence records with filtering, search, and pagination.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const queryParse = listEvidenceQuerySchema.safeParse(req.query);
      if (!queryParse.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryParse.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await evidenceService.listEvidence(queryParse.data);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/evidence/:id
   * Retrieves evidence metadata and associated case/incident details.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const paramResult = uuidParamSchema.safeParse(idParam);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid evidence ID format',
          message: 'Evidence ID must be a valid UUID',
        });
        return;
      }

      const evidence = await evidenceService.getEvidenceById(paramResult.data);
      res.status(200).json({ evidence });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/evidence/:id/download
   * Streams the physical evidence file with safe Content-Disposition headers.
   */
  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const paramResult = uuidParamSchema.safeParse(idParam);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid evidence ID format',
          message: 'Evidence ID must be a valid UUID',
        });
        return;
      }

      const downloadInfo = await evidenceService.getEvidenceDownload(paramResult.data);

      res.setHeader('Content-Type', downloadInfo.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', downloadInfo.fileSize);
      res.download(downloadInfo.filePath, downloadInfo.originalFilename, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/evidence/:id/integrity
   * Validates whether the stored evidence file on disk matches its immutable SHA-256 hash.
   */
  async verifyIntegrity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const paramResult = uuidParamSchema.safeParse(idParam);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid evidence ID format',
          message: 'Evidence ID must be a valid UUID',
        });
        return;
      }

      const integrity = await evidenceService.verifyIntegrity(paramResult.data);
      res.status(200).json(integrity);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * PATCH /api/evidence/:id
   * Updates mutable metadata for an evidence record.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const paramResult = uuidParamSchema.safeParse(idParam);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid evidence ID format',
          message: 'Evidence ID must be a valid UUID',
        });
        return;
      }

      const bodyResult = updateEvidenceMetadataSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const updated = await evidenceService.updateMetadata(
        paramResult.data,
        bodyResult.data
      );

      res.status(200).json({
        message: 'Evidence metadata updated successfully',
        evidence: updated,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const evidenceController = new EvidenceController();
