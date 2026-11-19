import { Router } from 'express';
import { caseController } from '../controllers/case.controller';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../types/rbac.types';

const router = Router();

/**
 * All Case routes require valid JWT authentication.
 */
router.use(authenticate);

/**
 * POST /api/cases
 * Create a new case.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    caseController.create(req, res, next);
  }
);

/**
 * GET /api/cases
 * List cases with search, filtering, and pagination.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/', (req, res, next) => {
  caseController.list(req, res, next);
});

/**
 * GET /api/cases/:id
 * Retrieve case details by ID.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id', (req, res, next) => {
  caseController.getById(req, res, next);
});

/**
 * PATCH /api/cases/:id
 * Update case metadata.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    caseController.update(req, res, next);
  }
);

/**
 * PATCH /api/cases/:id/status
 * Transition case status with audit trail.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.patch(
  '/:id/status',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    caseController.changeStatus(req, res, next);
  }
);

/**
 * POST /api/cases/:id/members
 * Add a member to the case.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/:id/members',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    caseController.addMember(req, res, next);
  }
);

/**
 * DELETE /api/cases/:id/members/:userId
 * Remove a member from the case.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.delete(
  '/:id/members/:userId',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    caseController.removeMember(req, res, next);
  }
);

/**
 * GET /api/cases/:id/report
 * Generate a detailed case report preview.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 */
router.get(
  '/:id/report',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    reportController.getCaseReport(req, res, next);
  }
);

export default router;
