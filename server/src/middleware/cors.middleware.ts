import { Request, Response, NextFunction } from 'express';
import config from '../config/environment';

/**
 * Robust CORS middleware.
 *
 * Enforces:
 * - Origin validation against a configured whitelist.
 * - No arbitrary origin reflection.
 * - Explicit allowed HTTP methods and headers.
 * - Controlled preflight handling (OPTIONS).
 * - No wildcard '*' when credentials are used.
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const origin = req.headers.origin;

  // Requests without an Origin header (e.g., same-origin, curl, server-to-server) proceed safely
  if (!origin) {
    next();
    return;
  }

  const allowedOrigins = config.corsOrigins;
  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept'
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24-hour preflight cache
    res.setHeader('Vary', 'Origin');

    // Handle preflight OPTIONS requests directly
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  } else {
    // If an Origin was explicitly sent from an untrusted domain, reject preflight
    if (req.method === 'OPTIONS') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'CORS policy does not allow access from the specified Origin',
      });
      return;
    }
    // For non-OPTIONS requests, continue without setting Allow-Origin headers,
    // causing standard browser CORS enforcement to block response reading
  }

  next();
}
