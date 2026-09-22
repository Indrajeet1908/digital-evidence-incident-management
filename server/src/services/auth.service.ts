import prisma from '../config/database';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { SafeUser, AuthResponse } from '../types/auth.types';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError } from '../utils/errors';

export class AuthService {
  /**
   * Registers a new user with the default VIEWER role.
   * Enforces duplicate email checking and Argon2 password hashing.
   * Client-supplied roles are rejected by Zod schema and overridden by system policy.
   */
  async register(input: RegisterInput): Promise<SafeUser> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('An account with this email address already exists', 409);
    }

    // Default self-registration role: VIEWER (principle of least privilege)
    const viewerRole = await prisma.role.findUnique({
      where: { name: 'VIEWER' },
    });

    if (!viewerRole) {
      throw new AppError(
        'Default VIEWER role is missing from the database. Please ensure seeds have run.',
        500
      );
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // Create user in PostgreSQL
    const user = await prisma.user.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail,
        passwordHash,
        roleId: viewerRole.id,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * Authenticates a user by email and password.
   * Uses generic error messages to prevent user enumeration attacks.
   * Respects account isActive status.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
      },
    });

    // Generic error message prevents account enumeration
    const genericAuthError = new AppError('Invalid email or password', 401);

    if (!user) {
      throw genericAuthError;
    }

    // Verify account active status
    if (!user.isActive) {
      throw genericAuthError;
    }

    // Verify password against Argon2 hash
    const isPasswordValid = await verifyPassword(
      user.passwordHash,
      input.password
    );

    if (!isPasswordValid) {
      throw genericAuthError;
    }

    // Generate signed JWT
    const token = signToken({
      sub: user.id,
      role: user.role.name,
    });

    return {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Retrieves current authenticated user profile by ID.
   */
  async getProfile(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or account is deactivated', 401);
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
