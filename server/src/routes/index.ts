import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import rbacRoutes from './rbac.routes';

/**
 * Main router — mounts all route groups.
 *
 * As we add features (cases, incidents, evidence, etc.),
 * each will get its own route file and be mounted here.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/rbac', rbacRoutes);

export default router;
