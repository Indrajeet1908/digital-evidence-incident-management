import { Request, Response, NextFunction } from 'express';
import config from '../config/environment';

/**
 * Middleware that sets robust HTTP security headers on all responses.
 *
 * Implements:
 * - Content-Security-Policy (Environment-aware: strict in production, HMR/Vite compatible in development)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: camera=(), microphone=(), geolocation=()
 * - Strict-Transport-Security (HSTS in production)
 * - Explicit removal of X-Powered-By
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Remove revealing server header
  res.removeHeader('X-Powered-By');

  // 2. Fundamental protection headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers prefer CSP over deprecated auditor
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // 3. HSTS — strictly in production or secure connections
  if (config.nodeEnv === 'production' || req.secure) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // 4. Environment-aware Content-Security-Policy
  if (config.nodeEnv === 'production') {
    // Strict production CSP
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // Tailwind inline utility styles
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  } else {
    // Development CSP: permits Vite HMR websockets (ws:, wss:) and local connectivity
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }

  next();
}
