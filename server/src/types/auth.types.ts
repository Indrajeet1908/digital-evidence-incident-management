/**
 * Authentication-related TypeScript interfaces and types.
 */

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

export interface JwtTokenPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  token: string;
  user: SafeUser;
}
