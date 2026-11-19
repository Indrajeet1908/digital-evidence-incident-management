import { z } from 'zod';
import {
  CaseStatus,
  CasePriority,
  CaseSeverity,
  CaseConfidentiality,
  CaseType,
  CaseCategory,
  CaseMemberRole,
} from '@prisma/client';

/**
 * Validation schema for creating a new Case.
 * Strict mode prevents client tampering with ownership, status, or system fields.
 */
export const createCaseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters long')
      .max(255, 'Title must not exceed 255 characters'),
    description: z
      .string()
      .trim()
      .max(5000, 'Description must not exceed 5000 characters')
      .optional(),
    caseType: z
      .nativeEnum(CaseType, {
        message: 'Invalid case type',
      })
      .default(CaseType.CYBERSECURITY_INCIDENT),
    category: z
      .nativeEnum(CaseCategory, {
        message: 'Invalid category',
      })
      .default(CaseCategory.OTHER),
    severity: z
      .nativeEnum(CaseSeverity, {
        message: 'Invalid severity',
      })
      .default(CaseSeverity.MEDIUM),
    priority: z
      .nativeEnum(CasePriority, {
        message: 'Invalid priority',
      })
      .default(CasePriority.MEDIUM),
    confidentiality: z
      .nativeEnum(CaseConfidentiality, {
        message: 'Invalid confidentiality level',
      })
      .default(CaseConfidentiality.INTERNAL),
    incidentDate: z.coerce.date().optional(),
    detectedAt: z.coerce.date().optional(),
    reportedAt: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    leadInvestigatorId: z
      .string()
      .uuid('Lead investigator ID must be a valid UUID')
      .optional(),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(20, 'Cannot exceed 20 tags')
      .default([]),
  })
  .strict();

/**
 * Validation schema for updating Case metadata.
 */
export const updateCaseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters long')
      .max(255, 'Title must not exceed 255 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, 'Description must not exceed 5000 characters')
      .nullable()
      .optional(),
    caseType: z.nativeEnum(CaseType).optional(),
    category: z.nativeEnum(CaseCategory).optional(),
    severity: z.nativeEnum(CaseSeverity).optional(),
    priority: z.nativeEnum(CasePriority).optional(),
    confidentiality: z.nativeEnum(CaseConfidentiality).optional(),
    incidentDate: z.coerce.date().nullable().optional(),
    detectedAt: z.coerce.date().nullable().optional(),
    reportedAt: z.coerce.date().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    leadInvestigatorId: z
      .string()
      .uuid('Lead investigator ID must be a valid UUID')
      .nullable()
      .optional(),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(20, 'Cannot exceed 20 tags')
      .optional(),
  })
  .strict();

/**
 * Validation schema for changing Case status.
 * Enforces closureReason when status transition is to CLOSED.
 */
export const updateCaseStatusSchema = z
  .object({
    status: z.nativeEnum(CaseStatus, {
      message: 'Invalid case status',
    }),
    reason: z
      .string()
      .trim()
      .max(1000, 'Reason must not exceed 1000 characters')
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.status === CaseStatus.CLOSED) {
        return Boolean(data.reason && data.reason.trim().length > 0);
      }
      return true;
    },
    {
      message: 'A closure reason is required when closing a case',
      path: ['reason'],
    }
  );

/**
 * Validation schema for adding a member to a Case.
 */
export const addCaseMemberSchema = z
  .object({
    userId: z.string().uuid('User ID must be a valid UUID'),
    role: z.nativeEnum(CaseMemberRole, {
      message: 'Invalid case member role',
    }),
  })
  .strict();

/**
 * Validation schema for listing / searching cases.
 */
export const listCasesQuerySchema = z
  .object({
    status: z.nativeEnum(CaseStatus).optional(),
    priority: z.nativeEnum(CasePriority).optional(),
    severity: z.nativeEnum(CaseSeverity).optional(),
    caseType: z.nativeEnum(CaseType).optional(),
    category: z.nativeEnum(CaseCategory).optional(),
    search: z.string().trim().max(100, 'Search query must not exceed 100 characters').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>;
export type AddCaseMemberInput = z.infer<typeof addCaseMemberSchema>;
export type ListCasesQueryInput = z.infer<typeof listCasesQuerySchema>;
