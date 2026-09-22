import { Router } from 'express';
import { evidenceController } from '../controllers/evidence.controller';
import { custodyController } from '../controllers/custody.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { uploadEvidenceFile } from '../middleware/upload.middleware';
import { ROLES } from '../types/rbac.types';

const router = Router();

/**
 * All Evidence, Custody, and Audit endpoints require valid JWT authentication.
 */
router.use(authenticate);

// ──────────────────────────────────────────────
// Evidence Management Endpoints (Milestone 7)
// ──────────────────────────────────────────────

/**
 * POST /api/evidence
 * Ingests evidence file with metadata and creates initial custody event & audit log.
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
 * Retrieves metadata for a specific evidence record and records a VIEWED audit log.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id', (req, res, next) => {
  evidenceController.getById(req, res, next);
});

/**
 * GET /api/evidence/:id/download
 * Downloads physical evidence file.
 * Permitted: ADMIN, INVESTIGATOR, ANALYST
 * Denied: VIEWER (403 Forbidden with audit logging)
 */
router.get('/:id/download', (req, res, next) => {
  evidenceController.download(req, res, next);
});

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
 * Updates mutable evidence metadata.
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

// ──────────────────────────────────────────────
// Chain of Custody Endpoints (Milestone 8)
// ──────────────────────────────────────────────

/**
 * POST /api/evidence/:id/custody/transfer
 * Initiates an evidence custody transfer to another active user.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/:id/custody/transfer',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    custodyController.transfer(req, res, next);
  }
);

/**
 * POST /api/evidence/:id/custody/receive
 * Acknowledges receipt of transferred custody by designated recipient.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/:id/custody/receive',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    custodyController.receive(req, res, next);
  }
);

/**
 * POST /api/evidence/:id/custody/seal
 * Seals evidence with an immutable SEALED event.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/:id/custody/seal',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    custodyController.seal(req, res, next);
  }
);

/**
 * POST /api/evidence/:id/custody/unseal
 * Unseals evidence with an immutable UNSEALED event.
 * Permitted: ADMIN, INVESTIGATOR
 */
router.post(
  '/:id/custody/unseal',
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req, res, next) => {
    custodyController.unseal(req, res, next);
  }
);

/**
 * POST /api/evidence/:id/custody/release
 * Releases evidence from custody lifecycle.
 * Permitted: ADMIN only
 */
router.post(
  '/:id/custody/release',
  requireRole(ROLES.ADMIN),
  (req, res, next) => {
    custodyController.release(req, res, next);
  }
);

/**
 * GET /api/evidence/:id/custody/integrity
 * Verifies tamper-evident cryptographic hash chain of custody events.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id/custody/integrity', (req, res, next) => {
  custodyController.verifyCustodyIntegrity(req, res, next);
});

/**
 * GET /api/evidence/:id/custody
 * Lists chronological custody events with pagination.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id/custody', (req, res, next) => {
  custodyController.listCustodyHistory(req, res, next);
});

// ──────────────────────────────────────────────
// Evidence Audit Trail Endpoints (Milestone 8)
// ──────────────────────────────────────────────

/**
 * GET /api/evidence/:id/audit/integrity
 * Verifies tamper-evident cryptographic hash chain of audit log events.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id/audit/integrity', (req, res, next) => {
  custodyController.verifyAuditIntegrity(req, res, next);
});

/**
 * GET /api/evidence/:id/audit
 * Lists chronological audit log entries with filters and pagination.
 * Permitted: All authenticated roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER)
 */
router.get('/:id/audit', (req, res, next) => {
  custodyController.listAuditHistory(req, res, next);
});

export default router;
