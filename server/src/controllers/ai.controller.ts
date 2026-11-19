import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  analyzeEvidenceSchema,
  classifyIncidentSchema,
  listAIAnalysesQuerySchema,
} from '../validators/ai.validator';
import { aiService } from '../services/ai/ai.service';
import { extractAuditContext } from './evidence.controller';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

export class AIController {
  /**
   * POST /api/evidence/:id/ai/analyze
   * Initiates controlled AI analysis on evidence artifact.
   * Permitted: ADMIN, INVESTIGATOR, ANALYST
   * Denied: VIEWER (403 Forbidden)
   */
  async analyzeEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const bodyResult = analyzeEvidenceSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const analysis = await aiService.analyzeEvidence(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(200).json({
        message: 'AI analysis completed successfully',
        analysis,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/evidence/:id/ai
   * Retrieves AI analysis history for evidence record.
   * Permitted: All authenticated roles
   */
  async listEvidenceAnalyses(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const queryResult = listAIAnalysesQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await aiService.listEvidenceAnalyses(paramResult.data, queryResult.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/ai/analyses/:analysisId
   * Retrieves single AI analysis details by ID.
   * Permitted: All authenticated roles
   */
  async getAnalysisById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = Array.isArray(req.params.analysisId)
        ? req.params.analysisId[0]
        : req.params.analysisId;
      const paramResult = uuidParamSchema.safeParse(idParam);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid analysis ID format',
          message: 'Analysis ID must be a valid UUID',
        });
        return;
      }

      const analysis = await aiService.getAnalysisById(paramResult.data);
      res.status(200).json({ analysis });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/incidents/:id/ai/classify
   * Performs advisory incident classification.
   * Permitted: ADMIN, INVESTIGATOR, ANALYST
   * Denied: VIEWER (403 Forbidden)
   */
  async classifyIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const paramResult = uuidParamSchema.safeParse(idParam);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid incident ID format',
          message: 'Incident ID must be a valid UUID',
        });
        return;
      }

      const bodyResult = classifyIncidentSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const analysis = await aiService.classifyIncident(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(200).json({
        message: 'Incident classification completed successfully',
        analysis,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AIController();
