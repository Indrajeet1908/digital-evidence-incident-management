import { Router } from 'express';
import healthRoutes from './health.routes';

/**
 * Main router — mounts all route groups.
 *
 * As we add features (cases, incidents, evidence, etc.),
 * each will get its own route file and be mounted here.
 *
 * Example (future):
 *   router.use('/cases', caseRoutes);
 *   router.use('/incidents', incidentRoutes);
 */
const router = Router();

router.use('/health', healthRoutes);

export default router;
