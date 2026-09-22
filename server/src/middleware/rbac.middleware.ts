import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/rbac.types';

/**
 * Role-Based Access Control (RBAC) Authorization Middleware.
 *
 * Enforces that the authenticated user possesses one of the allowed roles.
 * Must be preceded by the `authenticate` middleware in the route chain.
 *
 * SECURITY GUARANTEES:
 * 1. Checks ONLY the server-verified `req.user.role` extracted from the database.
 * 2. Completely ignores any client-supplied role values (body, query, headers).
 * 3. Returns HTTP 401 if unauthenticated.
 * 4. Returns HTTP 403 Forbidden if user lacks the required role.
 *
 * @param allowedRoles List of roles permitted to access the endpoint.
 *
 * Example usage:
 *   router.get('/admin-only', authenticate, requireRole(ROLES.ADMIN), handler);
 *   router.get('/cases', authenticate, requireRole(ROLES.ADMIN, ROLES.INVESTIGATOR), handler);
 */
export function requireRole(...allowedRoles: (UserRole | string)[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Ensure user is authenticated
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required before checking permissions',
      });
      return;
    }

    // 2. Validate user role against permitted roles list
    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: insufficient permissions for this resource',
      });
      return;
    }

    // 3. User is authorized
    next();
  };
}
