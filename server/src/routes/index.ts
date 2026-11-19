import { Router } from 'express';
import healthRoutes from './health.routes';
import readyRoutes from './ready.routes';
import authRoutes from './auth.routes';
import rbacRoutes from './rbac.routes';
import caseRoutes from './case.routes';
import incidentRoutes from './incident.routes';
import evidenceRoutes from './evidence.routes';
import aiRoutes from './ai.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';

/**
 * Main router — mounts all route groups.
 *
 * As we add features (cases, incidents, evidence, etc.),
 * each will get its own route file and be mounted here.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/ready', readyRoutes);
router.use('/auth', authRoutes);
router.use('/rbac', rbacRoutes);
router.use('/cases', caseRoutes);
router.use('/incidents', incidentRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/ai', aiRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);

export default router;
