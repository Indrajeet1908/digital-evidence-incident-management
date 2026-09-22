import jwt from 'jsonwebtoken';
import config from '../config/environment';
import { JwtTokenPayload } from '../types/auth.types';

/**
 * Generates a signed JWT for an authenticated user.
 * Contains only the minimum necessary claims (sub: user id, role: user role).
 * Never includes sensitive information like password hashes.
 */
export function signToken(payload: { sub: string; role: string }): string {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured in the environment');
  }

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies a JWT token signature and expiration.
 * Returns the decoded token payload or throws an error if invalid/expired.
 */
export function verifyToken(token: string): JwtTokenPayload {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured in the environment');
  }

  return jwt.verify(token, config.jwtSecret) as JwtTokenPayload;
}
