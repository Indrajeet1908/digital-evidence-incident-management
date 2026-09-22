import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/auth/register
 * Public endpoint for user registration (default role: VIEWER).
 */
router.post('/register', (req, res, next) => {
  authController.register(req, res, next);
});

/**
 * POST /api/auth/login
 * Public endpoint for user authentication.
 */
router.post('/login', (req, res, next) => {
  authController.login(req, res, next);
});

/**
 * GET /api/auth/me
 * Protected endpoint to retrieve authenticated user profile.
 */
router.get('/me', authenticate, (req, res, next) => {
  authController.getMe(req, res, next);
});

export default router;
