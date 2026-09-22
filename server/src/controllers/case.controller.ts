import { Request, Response, NextFunction } from 'express';
import {
  createCaseSchema,
  updateCaseSchema,
  updateCaseStatusSchema,
  addCaseMemberSchema,
  listCasesQuerySchema,
} from '../validators/case.validator';
import { caseService } from '../services/case.service';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

export class CaseController {
  /**
   * POST /api/cases
   * Creates a new investigation case.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parseResult = createCaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const createdCase = await caseService.createCase(
        parseResult.data,
        req.user.id
      );

      res.status(201).json({
        message: 'Case created successfully',
        case: createdCase,
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
   * GET /api/cases
   * Lists cases with filtering and pagination.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parseResult = listCasesQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await caseService.listCases(parseResult.data, req.user);
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
   * GET /api/cases/:id
   * Retrieves case by ID.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idParam = uuidParamSchema.safeParse(req.params.id);
      if (!idParam.success) {
        res.status(400).json({
          error: 'Invalid parameter',
          message: 'Case ID must be a valid UUID',
        });
        return;
      }

      const caseDetails = await caseService.getCaseById(idParam.data);
      res.status(200).json(caseDetails);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * PATCH /api/cases/:id
   * Updates non-critical case metadata.
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
          message: 'Case ID must be a valid UUID',
        });
        return;
      }

      const parseResult = updateCaseSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const updatedCase = await caseService.updateCase(
        idParam.data,
        parseResult.data
      );

      res.status(200).json({
        message: 'Case updated successfully',
        case: updatedCase,
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
   * PATCH /api/cases/:id/status
   * Transitions case status with audit trail history.
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
          message: 'Case ID must be a valid UUID',
        });
        return;
      }

      const parseResult = updateCaseStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const updatedCase = await caseService.changeStatus(
        idParam.data,
        parseResult.data,
        req.user.id
      );

      res.status(200).json({
        message: 'Case status transitioned successfully',
        case: updatedCase,
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
   * POST /api/cases/:id/members
   * Assigns an active user as a case member.
   */
  async addMember(
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
          message: 'Case ID must be a valid UUID',
        });
        return;
      }

      const parseResult = addCaseMemberSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const member = await caseService.addMember(
        idParam.data,
        parseResult.data,
        req.user.id
      );

      res.status(201).json({
        message: 'Member assigned to case successfully',
        member,
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
   * DELETE /api/cases/:id/members/:userId
   * Removes a member from the case.
   */
  async removeMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const caseIdParam = uuidParamSchema.safeParse(req.params.id);
      const userIdParam = uuidParamSchema.safeParse(req.params.userId);

      if (!caseIdParam.success || !userIdParam.success) {
        res.status(400).json({
          error: 'Invalid parameter',
          message: 'Case ID and User ID must both be valid UUIDs',
        });
        return;
      }

      const result = await caseService.removeMember(
        caseIdParam.data,
        userIdParam.data,
        req.user.id
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const caseController = new CaseController();
