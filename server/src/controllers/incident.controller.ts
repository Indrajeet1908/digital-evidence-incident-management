import { Request, Response, NextFunction } from 'express';
import {
  createIncidentSchema,
  updateIncidentSchema,
  updateIncidentStatusSchema,
  listIncidentsQuerySchema,
} from '../validators/incident.validator';
import { incidentService } from '../services/incident.service';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

export class IncidentController {
  /**
   * POST /api/incidents
   * Creates an incident linked to an existing Case.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parseResult = createIncidentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const created = await incidentService.createIncident(
        parseResult.data,
        req.user.id
      );

      res.status(201).json({
        message: 'Incident created successfully',
        incident: created,
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
   * GET /api/incidents
   * Lists incidents with filtering and pagination.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parseResult = listIncidentsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await incidentService.listIncidents(parseResult.data, req.user);
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
   * GET /api/incidents/:id
   * Retrieves an incident by ID.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idParam = uuidParamSchema.safeParse(req.params.id);
      if (!idParam.success) {
        res.status(400).json({
          error: 'Invalid parameter',
          message: 'Incident ID must be a valid UUID',
        });
        return;
      }

      const incident = await incidentService.getIncidentById(idParam.data);
      res.status(200).json(incident);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * PATCH /api/incidents/:id
   * Updates non-critical metadata of an incident.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = uuidParamSchema.safeParse(req.params.id);
      if (!idParam.success) {
        res.status(400).json({
          error: 'Invalid parameter',
          message: 'Incident ID must be a valid UUID',
        });
        return;
      }

      const parseResult = updateIncidentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const updated = await incidentService.updateIncident(
        idParam.data,
        parseResult.data
      );

      res.status(200).json({
        message: 'Incident updated successfully',
        incident: updated,
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
   * PATCH /api/incidents/:id/status
   * Transitions an incident status and records audit history.
   */
  async changeStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const idParam = uuidParamSchema.safeParse(req.params.id);
      if (!idParam.success) {
        res.status(400).json({
          error: 'Invalid parameter',
          message: 'Incident ID must be a valid UUID',
        });
        return;
      }

      const parseResult = updateIncidentStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const updated = await incidentService.changeStatus(
        idParam.data,
        parseResult.data,
        req.user.id
      );

      res.status(200).json({
        message: 'Incident status transitioned successfully',
        incident: updated,
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

export const incidentController = new IncidentController();
