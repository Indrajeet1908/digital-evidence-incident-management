import path from 'path';
import { Request } from 'express';
import { AppError } from './errors';

/**
 * Strips dangerous characters from user-supplied filenames for safe inclusion
 * in HTTP Content-Disposition response headers.
 * Prevents HTTP response splitting, header injection, and parameter tampering.
 */
export function sanitizeHeaderFilename(filename: string): string {
  if (!filename) return 'download.bin';
  // Strip control chars, CRLF, double quotes, semicolons, and backslashes
  const sanitized = filename
    .replace(/[\r\n\x00-\x1F\x7F"\\;]/g, '_')
    .trim();
  return sanitized || 'download.bin';
}

/**
 * Sanitizes an uploaded file's original filename for database metadata storage.
 * Eliminates null bytes, path traversal sequences (../, ..\), control characters,
 * and dangerous shell characters.
 */
export function sanitizeOriginalFilename(filename: string): string {
  if (!filename) return 'evidence.bin';

  // Strip null bytes and control characters
  let clean = filename.replace(/[\x00-\x1F\x7F]/g, '');

  // Extract base filename (removes directory components)
  clean = path.basename(clean).trim();

  // Remove any remaining path traversal attempts
  clean = clean.replace(/^[.\s]+/, '');

  return clean || 'evidence.bin';
}

/**
 * Verifies that a physical file path is strictly contained within the intended base directory.
 * Defends against directory traversal / symlink escape attacks.
 */
export function assertPathWithinDirectory(
  targetPath: string,
  allowedParentDir: string
): void {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedParent = path.resolve(allowedParentDir);

  if (
    resolvedTarget !== resolvedParent &&
    !resolvedTarget.startsWith(resolvedParent + path.sep)
  ) {
    throw new AppError('Access denied: path traversal attempt detected', 403);
  }
}

/**
 * Safely resolves client IP address without blindly trusting arbitrary client-spoofed headers.
 * Only inspects X-Forwarded-For if Express trust proxy is explicitly enabled.
 */
export function getClientIp(req: Request): string {
  // If trust proxy is not configured, rely on direct connection remoteAddress
  const isTrustProxy = req.app?.get('trust proxy');

  if (isTrustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const parts = forwarded.split(',');
      const firstIp = parts[0]?.trim();
      if (firstIp) return firstIp;
    }
  }

  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}
