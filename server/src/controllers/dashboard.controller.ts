import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { dashboardService } from '../services/dashboard.service';
import {
  listActivityQuerySchema,
  listIncidentIntelligenceQuerySchema,
  listEvidenceIntelligenceQuerySchema,
  searchQuerySchema,
} from '../validators/dashboard.validator';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

export class DashboardController {
  /**
   * GET /api/dashboard/overview
   * Platform-wide aggregated metrics, breakdowns, and recent activity.
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const overview = await dashboardService.getOverview();
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/cases/:caseId
   * Consolidated single-case investigation summary.
   */
  async getCaseInvestigation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const rawId = Array.isArray(req.params.caseId) ? req.params.caseId[0] : req.params.caseId;
      const paramResult = uuidParamSchema.safeParse(rawId);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Invalid case ID format',
          message: 'Case ID must be a valid UUID',
        });
        return;
      }

      const summary = await dashboardService.getCaseInvestigation(paramResult.data);
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/activity
   * Normalized chronological activity timeline with filtering and pagination.
   */
  async getActivityTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const queryResult = listActivityQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const timeline = await dashboardService.getActivityTimeline(queryResult.data);
      res.status(200).json(timeline);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/incidents
   * Filterable incident intelligence enriched with evidence/AI counts and latest classification.
   */
  async getIncidentIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const queryResult = listIncidentIntelligenceQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const incidents = await dashboardService.getIncidentIntelligence(queryResult.data);
      res.status(200).json(incidents);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/evidence
   * Filterable evidence intelligence with latest integrity status and custody state.
   */
  async getEvidenceIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const queryResult = listEvidenceIntelligenceQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const evidence = await dashboardService.getEvidenceIntelligence(queryResult.data);
      res.status(200).json(evidence);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/ai
   * Aggregated AI intelligence, status breakdowns, average confidence, top indicators.
   */
  async getAIIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const ai = await dashboardService.getAIIntelligence();
      res.status(200).json(ai);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/alerts
   * Platform-state investigation health alerts.
   */
  async getInvestigationAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const alerts = await dashboardService.getInvestigationAlerts();
      res.status(200).json(alerts);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/search?q=
   * Multi-entity search across cases, incidents, and evidence.
   */
  async searchEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const queryResult = searchQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const results = await dashboardService.searchEntities(
        queryResult.data.q,
        queryResult.data.limit
      );
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
