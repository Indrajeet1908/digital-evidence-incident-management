import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Request correlation ID middleware.
 *
 * Checks incoming 'x-request-id' header or generates a new RFC 4122 UUID.
 * Propagates the correlation ID to the response header 'X-Request-Id'
 * and attaches it to req.id for downstream structured logging and audit tracing.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.headers['x-request-id'];

  // Validate format if provided by client/proxy (alphanumeric with hyphens, max 64 chars)
  let requestId: string;
  if (
    typeof incomingId === 'string' &&
    incomingId.length > 0 &&
    incomingId.length <= 64 &&
    /^[a-zA-Z0-9_-]+$/.test(incomingId)
  ) {
    requestId = incomingId;
  } else {
    requestId = randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
