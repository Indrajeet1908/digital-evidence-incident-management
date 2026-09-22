import { Router } from 'express';
import { evidenceController } from '../controllers/evidence.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { uploadEvidenceFile } from '../middleware/upload.middleware';
import { ROLES } from '../types/rbac.types';

const router = Router();

/**
 * All Evidence endpoints require valid JWT authentication.
 */
router.use(authenticate);

/**
 * POST /api/evidence
 * Uploads evidence file with associated metadata and case/incident linking.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  uploadEvidenceFile,
  (req, res, next) => {
    evidenceController.create(req, res, next);
  }
);

/**
 * GET /api/evidence
 * Lists evidence records with search, filtering, and pagination.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/', (req, res, next) => {
  evidenceController.list(req, res, next);
});

/**
 * GET /api/evidence/:id
 * Retrieves metadata for a specific evidence record.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id', (req, res, next) => {
  evidenceController.getById(req, res, next);
});

/**
 * GET /api/evidence/:id/download
 * Downloads the physical evidence file with Content-Disposition headers.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 * Denied: VIEWER (403 Forbidden)
 */
router.get(
  '/:id/download',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req, res, next) => {
    evidenceController.download(req, res, next);
  }
);

/**
 * GET /api/evidence/:id/integrity
 * Verifies on-disk physical file SHA-256 against stored database hash.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id/integrity', (req, res, next) => {
  evidenceController.verifyIntegrity(req, res, next);
});

/**
 * PATCH /api/evidence/:id
 * Updates mutable evidence metadata (description, evidenceType, source, collectedAt).
 * Permitted: ADMIN, INVESTIGATOR
 * Denied: ANALYST, VIEWER (403 Forbidden)
 */
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    evidenceController.update(req, res, next);
  }
);

export default router;
