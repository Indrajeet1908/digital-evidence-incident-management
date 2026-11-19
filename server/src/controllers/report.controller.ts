/**
 * Report controller.
 * Handles HTTP requests for report generation, preview, and export.
 */

import { Request, Response, NextFunction } from 'express';
import { generateReportSchema } from '../validators/report.validator';
import { reportService } from '../services/reporting/report.service';
import { reportRenderer } from '../services/reporting/report.renderer';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid('Invalid UUID identifier');

export class ReportController {
  /**
   * POST /api/reports
   * Generate a structured investigation report as JSON.
   */
  async generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parsed = generateReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const report = await reportService.generateReport(parsed.data, {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
      });

      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/reports/preview
   * Preview a report without persistence (same as generate, labeled as preview).
   */
  async previewReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parsed = generateReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const report = await reportService.generateReport(parsed.data, {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
      });

      res.status(200).json({ ...report, isPreview: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/reports/export
   * Generate a report and export as PDF.
   */
  async exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const parsed = generateReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const report = await reportService.generateReport(parsed.data, {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
      });

      const pdfBuffer = await reportRenderer.renderPDF(report);

      const filename = `report-${parsed.data.reportType.toLowerCase()}-${Date.now()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/cases/:id/report
   * Shortcut for generating a detailed case report preview.
   */
  async getCaseReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const caseId = uuidParamSchema.safeParse(req.params.id);
      if (!caseId.success) {
        res.status(400).json({ error: 'Invalid case ID' });
        return;
      }

      const report = await reportService.generateReport(
        {
          reportType: 'DETAILED_CASE_REPORT',
          caseId: caseId.data,
          includeAI: true,
          includeAudit: true,
          includeCustody: true,
        },
        {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
        }
      );

      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/incidents/:id/report
   * Shortcut for generating an incident report preview.
   */
  async getIncidentReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const incidentId = uuidParamSchema.safeParse(req.params.id);
      if (!incidentId.success) {
        res.status(400).json({ error: 'Invalid incident ID' });
        return;
      }

      const report = await reportService.generateReport(
        {
          reportType: 'INCIDENT_REPORT',
          incidentId: incidentId.data,
          includeAI: true,
          includeAudit: true,
          includeCustody: true,
        },
        {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
        }
      );

      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/evidence/:id/report
   * Shortcut for generating an evidence report preview.
   */
  async getEvidenceReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const evidenceId = uuidParamSchema.safeParse(req.params.id);
      if (!evidenceId.success) {
        res.status(400).json({ error: 'Invalid evidence ID' });
        return;
      }

      const report = await reportService.generateReport(
        {
          reportType: 'EVIDENCE_REPORT',
          evidenceId: evidenceId.data,
          includeAI: true,
          includeAudit: true,
          includeCustody: true,
        },
        {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
        }
      );

      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
