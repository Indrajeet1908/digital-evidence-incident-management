import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/health
 *
 * Health check endpoint.
 * Returns the server status and current timestamp.
 * Used by monitoring tools, load balancers, and developers to verify the API is running.
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
