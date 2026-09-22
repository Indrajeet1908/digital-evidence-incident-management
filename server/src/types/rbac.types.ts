/**
 * Role-Based Access Control (RBAC) definitions and permission matrix.
 *
 * System roles:
 * - ADMIN: Full administrative access, user & role management, system administration
 * - INVESTIGATOR: Create and manage investigations, incidents, and associated evidence
 * - ANALYST: View investigations, analyze evidence, add findings
 * - VIEWER: Read-only access to permitted resources (default for self-registration)
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  INVESTIGATOR: 'INVESTIGATOR',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export interface RolePermissions {
  description: string;
  capabilities: readonly string[];
}

/**
 * Role Permission Matrix documenting the logical capabilities of each role.
 * Enforces the Principle of Least Privilege across the platform.
 */
export const ROLE_PERMISSION_MATRIX: Record<UserRole, RolePermissions> = {
  [ROLES.ADMIN]: {
    description: 'Full administrative access, user management, role management, and audit log inspection',
    capabilities: [
      'users:create',
      'users:read',
      'users:update',
      'users:deactivate',
      'roles:manage',
      'cases:all:manage',
      'evidence:all:manage',
      'audit:read',
      'system:configure',
    ],
  },
  [ROLES.INVESTIGATOR]: {
    description: 'Create and manage investigations, incidents, upload/manage evidence, and manage tasks',
    capabilities: [
      'cases:create',
      'cases:assigned:manage',
      'incidents:create',
      'incidents:manage',
      'evidence:upload',
      'evidence:manage',
      'evidence:analyze',
      'findings:manage',
      'tasks:manage',
    ],
  },
  [ROLES.ANALYST]: {
    description: 'View assigned investigations, analyze digital evidence, and document findings',
    capabilities: [
      'cases:assigned:read',
      'evidence:analyze',
      'evidence:read',
      'findings:create',
      'findings:update',
    ],
  },
  [ROLES.VIEWER]: {
    description: 'Read-only access to permitted investigations and evidence',
    capabilities: [
      'cases:assigned:read',
      'evidence:read',
    ],
  },
};
