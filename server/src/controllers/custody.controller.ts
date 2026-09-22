import { Request, Response, NextFunction } from 'express';
import {
  transferCustodySchema,
  receiveCustodySchema,
  sealCustodySchema,
  unsealCustodySchema,
  releaseCustodySchema,
  listCustodyHistoryQuerySchema,
  listAuditHistoryQuerySchema,
} from '../validators/custody.validator';
import { custodyService } from '../services/custody.service';
import { extractAuditContext } from './evidence.controller';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

export class CustodyController {
  /**
   * POST /api/evidence/:id/custody/transfer
   * Transfers responsibility for an evidence record to another user.
   * Permitted: ADMIN, INVESTIGATOR
   */
  async transfer(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const bodyResult = transferCustodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const event = await custodyService.transferCustody(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(201).json({
        message: 'Custody transferred successfully',
        event,
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
   * POST /api/evidence/:id/custody/receive
   * Designated recipient acknowledges receipt of transferred custody.
   * Permitted: ADMIN, INVESTIGATOR
   */
  async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const bodyResult = receiveCustodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const event = await custodyService.receiveCustody(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(200).json({
        message: 'Custody received and acknowledged',
        event,
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
   * POST /api/evidence/:id/custody/seal
   * Seals evidence with an immutable SEALED event.
   * Permitted: ADMIN, INVESTIGATOR
   */
  async seal(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const bodyResult = sealCustodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const event = await custodyService.sealEvidence(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(200).json({
        message: 'Evidence sealed successfully',
        event,
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
   * POST /api/evidence/:id/custody/unseal
   * Unseals evidence with an immutable UNSEALED event.
   * Permitted: ADMIN, INVESTIGATOR
   */
  async unseal(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const bodyResult = unsealCustodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const event = await custodyService.unsealEvidence(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(200).json({
        message: 'Evidence unsealed successfully',
        event,
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
   * POST /api/evidence/:id/custody/release
   * Releases evidence lifecycle with an immutable RELEASED event.
   * Permitted: ADMIN only
   */
  async release(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const bodyResult = releaseCustodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const ctx = extractAuditContext(req);
      const event = await custodyService.releaseEvidence(
        paramResult.data,
        bodyResult.data,
        req.user.id,
        ctx
      );

      res.status(200).json({
        message: 'Evidence released from custody',
        event,
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
   * GET /api/evidence/:id/custody/integrity
   * Verifies tamper-evident cryptographic hash chain of custody events.
   * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
   */
  async verifyCustodyIntegrity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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

      const result = await custodyService.verifyCustodyIntegrity(paramResult.data);
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
   * GET /api/evidence/:id/audit/integrity
   * Verifies tamper-evident cryptographic hash chain of audit log events.
   * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
   */
  async verifyAuditIntegrity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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

      const result = await custodyService.verifyAuditIntegrity(paramResult.data);
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
   * GET /api/evidence/:id/custody
   * Lists chronological custody events with pagination.
   * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
   */
  async listCustodyHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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

      const queryResult = listCustodyHistoryQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await custodyService.listCustodyHistory(
        paramResult.data,
        queryResult.data
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

  /**
   * GET /api/evidence/:id/audit
   * Lists chronological audit log entries with filters and pagination.
   * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
   */
  async listAuditHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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

      const queryResult = listAuditHistoryQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await custodyService.listAuditHistory(
        paramResult.data,
        queryResult.data
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

export const custodyController = new CustodyController();
