import express, { Request, Response, NextFunction } from 'express';
import routes from './routes';
import { AppError } from './utils/errors';
import { securityHeadersMiddleware } from './middleware/security-headers.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import {
  authRateLimiter,
  aiRateLimiter,
  reportRateLimiter,
  searchRateLimiter,
  generalApiRateLimiter,
} from './middleware/rate-limiter.middleware';
import config from './config/environment';

/**
 * Creates and configures the Express application.
 *
 * Separated from server.ts so we can:
 * 1. Import the app in tests without starting a real server
 * 2. Keep configuration logic in one place
 */
const app = express();

// ---------- Observability & Request Tracing ----------

// Attach correlation ID to every incoming request and downstream response
app.use(requestIdMiddleware);

// ---------- Security Protections ----------

// Disable revealing server identification header
app.disable('x-powered-by');

// Apply robust security headers (CSP, HSTS, X-Content-Type-Options, etc.)
app.use(securityHeadersMiddleware);

// Apply strict CORS policy
app.use(corsMiddleware);

// ---------- Built-in Middleware with Strict Size Limits ----------

// Parse incoming JSON bodies with bounded maximum size (1MB) to prevent buffer exhaustion DoS
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded form data with bounded limit (1MB)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------- Targeted Rate Limiters ----------

// Protect authentication endpoints from brute force and credential stuffing
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// Protect expensive AI analysis endpoints from quota exhaustion and financial drain
app.use('/api/ai', aiRateLimiter);
app.use('/api/evidence/:id/ai/analyze', aiRateLimiter);
app.use('/api/incidents/:id/ai/classify', aiRateLimiter);

// Protect CPU-intensive reporting and PDF generation endpoints
app.use('/api/reports', reportRateLimiter);

// Protect search endpoint from query exhaustion
app.use('/api/dashboard/search', searchRateLimiter);

// General rate limiter for all other API endpoints
app.use('/api', generalApiRateLimiter);

// ---------- API Routes ----------

// All routes are prefixed with /api
app.use('/api', routes);

// ---------- 404 Handler ----------
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// ---------- Centralized Error Handling Middleware ----------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Handle invalid JSON body syntax or payload too large
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      error: 'Invalid JSON payload format',
    });
    return;
  }

  // Handle request entity too large from body-parser
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request payload exceeds the maximum allowed limit of 1MB',
    });
    return;
  }

  // Handle application operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Log unexpected internal errors securely on the server console without leaking secrets
  console.error('Unhandled internal server error:', err);

  // In production, strictly mask internal error details to prevent information disclosure
  // In development, sanitize any accidental database connection strings or secret patterns
  let devMessage = (err as Error)?.message || 'An internal server error occurred';
  if (config.databaseUrl && devMessage.includes(config.databaseUrl)) {
    devMessage = devMessage.split(config.databaseUrl).join('[REDACTED_DATABASE_URL]');
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      config.nodeEnv === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : devMessage,
  });
});

export default app;
