import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

/**
 * GET /api/health
 *
 * Health check endpoint.
 * Returns the server status, database connectivity, and current timestamp.
 * Used by monitoring tools, load balancers, and developers to verify
 * that both the API and database are running.
 */
router.get('/', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';

  try {
    // Simple query to verify the database connection is alive
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
  });
});

export default router;
