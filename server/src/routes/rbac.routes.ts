import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { ROLES } from '../types/rbac.types';

const router = Router();

/**
 * =====================================================================
 * RBAC DEMONSTRATION & VERIFICATION ENDPOINTS
 *
 * NOTE: These endpoints exist exclusively for RBAC testing and verification.
 * They contain no business logic and will be superseded by functional
 * domain endpoints in later milestones (Cases, Incidents, Evidence).
 * =====================================================================
 */

/**
 * GET /api/rbac/admin
 * RBAC Policy: ADMIN only.
 */
router.get(
  '/admin',
  authenticate,
  requireRole(ROLES.ADMIN),
  (req: Request, res: Response) => {
    res.status(200).json({
      message: 'Access granted: Administrator access verified',
      endpoint: '/api/rbac/admin',
      user: {
        id: req.user?.id,
        role: req.user?.role,
      },
    });
  }
);

/**
 * GET /api/rbac/investigator
 * RBAC Policy: ADMIN and INVESTIGATOR.
 */
router.get(
  '/investigator',
  authenticate,
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR),
  (req: Request, res: Response) => {
    res.status(200).json({
      message: 'Access granted: Investigator access verified',
      endpoint: '/api/rbac/investigator',
      user: {
        id: req.user?.id,
        role: req.user?.role,
      },
    });
  }
);

/**
 * GET /api/rbac/analyst
 * RBAC Policy: ADMIN, INVESTIGATOR, and ANALYST.
 */
router.get(
  '/analyst',
  authenticate,
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST),
  (req: Request, res: Response) => {
    res.status(200).json({
      message: 'Access granted: Analyst access verified',
      endpoint: '/api/rbac/analyst',
      user: {
        id: req.user?.id,
        role: req.user?.role,
      },
    });
  }
);

/**
 * GET /api/rbac/viewer
 * RBAC Policy: ADMIN, INVESTIGATOR, ANALYST, and VIEWER.
 */
router.get(
  '/viewer',
  authenticate,
  requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR, ROLES.ANALYST, ROLES.VIEWER),
  (req: Request, res: Response) => {
    res.status(200).json({
      message: 'Access granted: Viewer access verified',
      endpoint: '/api/rbac/viewer',
      user: {
        id: req.user?.id,
        role: req.user?.role,
      },
    });
  }
);

export default router;
