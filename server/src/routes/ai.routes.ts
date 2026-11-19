import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All AI endpoints require authentication
router.use(authenticate);

/**
 * GET /api/ai/analyses/:analysisId
 * Retrieves detailed structured results for a specific AI analysis by ID.
 * Permitted: All authenticated roles
 */
router.get('/analyses/:analysisId', (req, res, next) => {
  aiController.getAnalysisById(req, res, next);
});

export default router;
