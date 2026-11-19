import { Router, Request, Response } from 'express';
import fs from 'fs';
import prisma from '../config/database';
import { getEvidenceStorageDir } from '../middleware/upload.middleware';

const router = Router();

/**
 * GET /api/ready
 *
 * Readiness probe endpoint for container orchestrators, load balancers,
 * and monitoring systems.
 *
 * Verifies critical operational dependencies before traffic is routed:
 * 1. PostgreSQL database connectivity (SELECT 1 query)
 * 2. Evidence storage directory accessibility (read/write check)
 *
 * Status Contract:
 * - 200 OK: All dependencies operational; ready to accept user traffic.
 * - 503 Service Unavailable: One or more dependencies down; stop routing traffic.
 *
 * Security:
 * - Omits internal filesystem paths, hostnames, and credentials.
 */
router.get('/', async (_req: Request, res: Response) => {
  let dbConnected = false;
  let storageAccessible = false;

  // 1. Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  // 2. Check evidence storage accessibility
  try {
    const storageDir = getEvidenceStorageDir();
    fs.accessSync(storageDir, fs.constants.R_OK | fs.constants.W_OK);
    storageAccessible = true;
  } catch {
    storageAccessible = false;
  }

  const isReady = dbConnected && storageAccessible;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      storage: storageAccessible ? 'accessible' : 'inaccessible',
    },
  });
});

export default router;
