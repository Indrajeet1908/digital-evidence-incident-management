import { Request, Response, NextFunction } from 'express';
import config from '../config/environment';
import { getClientIp } from '../utils/security.utils';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

interface RequestRecord {
  timestamps: number[];
}

/**
 * Creates an in-memory sliding-window rate limiter middleware.
 *
 * Security Design:
 * 1. Safe IP identity resolution (does not blindly trust arbitrary client-spoofed headers).
 * 2. Sliding window prevents burst spikes at window boundary boundaries.
 * 3. Self-cleaning memory map prevents memory leaks.
 * 4. In test mode (NODE_ENV === 'test'), limits can be configured server-side
 *    without relying on any client-controlled bypass headers.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please try again later.',
    keyPrefix = 'rl',
  } = options;

  const hits = new Map<string, RequestRecord>();

  // Periodic cleanup of expired entries every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 60000));

  // Allow Node process to exit without waiting for this timer
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, server-side configuration grants high ceiling to prevent
    // false positives during rapid sequential regression testing, unless a specific
    // test-rate-limiter is explicitly instantiated with custom options.
    const isTestEnvironment =
      config.nodeEnv === 'test' || process.env.NODE_ENV === 'test';

    const effectiveMax =
      isTestEnvironment && !options.keyPrefix?.startsWith('test_')
        ? 10000
        : max;

    const clientIp = getClientIp(req);
    // Combine IP with authenticated user ID when available for targeted fairness
    const identityKey = `${keyPrefix}:${req.user?.id || clientIp}`;
    const now = Date.now();

    let record = hits.get(identityKey);
    if (!record) {
      record = { timestamps: [] };
      hits.set(identityKey, record);
    }

    // Filter out timestamps outside the active sliding window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= effectiveMax) {
      const oldestHit = record.timestamps[0] ?? now;
      const retryAfterSeconds = Math.ceil((oldestHit + windowMs - now) / 1000);

      res.setHeader('Retry-After', Math.max(1, retryAfterSeconds));
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

// ──────────────────────────────────────────────
// Pre-configured rate limiters for route groups
// ──────────────────────────────────────────────

/**
 * Auth rate limiter: 10 attempts per 15 minutes.
 * Protects against credential stuffing and brute-force attacks on login/registration.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyPrefix: 'auth',
});

/**
 * AI analysis rate limiter: 20 requests per 15 minutes.
 * Protects against excessive token consumption, LLM API quota exhaustion, and financial drain.
 */
export const aiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'AI analysis request limit reached. Please wait before submitting additional analyses.',
  keyPrefix: 'ai',
});

/**
 * Report rate limiter: 30 requests per 15 minutes.
 * Protects against CPU exhaustion from repeated intensive PDF rendering and large exports.
 */
export const reportRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Report generation limit reached. Please wait before generating additional reports.',
  keyPrefix: 'report',
});

/**
 * Search rate limiter: 60 requests per minute.
 * Prevents search database exhaustion and ReDoS on wildcard queries.
 */
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Search query limit reached. Please slow down your requests.',
  keyPrefix: 'search',
});

/**
 * General API rate limiter: 500 requests per 15 minutes per IP.
 */
export const generalApiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests to the platform API. Please try again later.',
  keyPrefix: 'api',
});
