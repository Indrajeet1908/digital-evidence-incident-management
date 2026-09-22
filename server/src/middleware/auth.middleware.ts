import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/database';
import { AppError } from '../utils/errors';

/**
 * Authentication middleware.
 *
 * Verifies JWT token from Authorization header (Bearer <token>).
 * Loads current user from PostgreSQL to verify identity and active status.
 * Attaches authenticated user object to req.user.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is missing or malformed',
      });
      return;
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is missing',
      });
      return;
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token has expired',
        });
        return;
      }
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is invalid',
      });
      return;
    }

    // Verify user exists and is active in database (do not trust stale token data)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User belonging to this token no longer exists',
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is deactivated',
      });
      return;
    }

    // Attach authenticated user to request context
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
}
