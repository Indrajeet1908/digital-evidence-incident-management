/**
 * Report routes.
 * All report endpoints require authentication.
 * Generation/preview/export restricted to ADMIN, INVESTIGATOR, ANALYST.
 */

import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../types/rbac.types';

const router = Router();

/**
 * All Report endpoints require valid JWT authentication.
 */
router.use(authenticate);

/**
 * POST /api/reports
 * Generate a structured investigation report.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 * Denied: VIEWER (403 Forbidden)
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    reportController.generateReport(req, res, next);
  }
);

/**
 * POST /api/reports/preview
 * Preview a report without persistence.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 * Denied: VIEWER (403 Forbidden)
 */
router.post(
  '/preview',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    reportController.previewReport(req, res, next);
  }
);

/**
 * POST /api/reports/export
 * Export a report as PDF.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 * Denied: VIEWER (403 Forbidden)
 */
router.post(
  '/export',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    reportController.exportReport(req, res, next);
  }
);

export default router;
