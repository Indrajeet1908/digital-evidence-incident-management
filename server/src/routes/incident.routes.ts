import { Router } from 'express';
import { incidentController } from '../controllers/incident.controller';
import { aiController } from '../controllers/ai.controller';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../types/rbac.types';

const router = Router();

/**
 * All Incident endpoints require valid authentication.
 */
router.use(authenticate);

/**
 * POST /api/incidents
 * Create a new incident associated with a case.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    incidentController.create(req, res, next);
  }
);

/**
 * GET /api/incidents
 * List incidents with search, filtering, and pagination.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/', (req, res, next) => {
  incidentController.list(req, res, next);
});

/**
 * GET /api/incidents/:id
 * Retrieve incident details by ID.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id', (req, res, next) => {
  incidentController.getById(req, res, next);
});

/**
 * PATCH /api/incidents/:id
 * Update incident metadata.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    incidentController.update(req, res, next);
  }
);

/**
 * PATCH /api/incidents/:id/status
 * Transition incident status with audit trail history.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.patch(
  '/:id/status',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    incidentController.changeStatus(req, res, next);
  }
);

/**
 * POST /api/incidents/:id/ai/classify
 * Generates controlled, advisory AI classification for an incident.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 * Denied: VIEWER (403 Forbidden)
 */
router.post(
  '/:id/ai/classify',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    aiController.classifyIncident(req, res, next);
  }
);

/**
 * GET /api/incidents/:id/report
 * Generate an incident report preview.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 */
router.get(
  '/:id/report',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    reportController.getIncidentReport(req, res, next);
  }
);

export default router;
