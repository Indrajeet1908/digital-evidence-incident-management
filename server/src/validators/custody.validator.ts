import { z } from 'zod';
import { EvidenceAuditAction, AuditResult } from '@prisma/client';

/**
 * Validation schema for transferring evidence custody.
 */
export const transferCustodySchema = z
  .object({
    toUserId: z.string().uuid('Target recipient user ID must be a valid UUID'),
    reason: z
      .string()
      .trim()
      .min(3, 'Transfer reason must be at least 3 characters long')
      .max(1000, 'Transfer reason must not exceed 1000 characters'),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes must not exceed 2000 characters')
      .optional(),
    location: z
      .string()
      .trim()
      .max(255, 'Location must not exceed 255 characters')
      .optional(),
  })
  .strict();

/**
 * Validation schema for receiving evidence custody.
 */
export const receiveCustodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(1000, 'Reason must not exceed 1000 characters')
      .optional(),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes must not exceed 2000 characters')
      .optional(),
    location: z
      .string()
      .trim()
      .max(255, 'Location must not exceed 255 characters')
      .optional(),
  })
  .strict();

/**
 * Validation schema for sealing evidence.
 */
export const sealCustodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'Sealing reason must be at least 3 characters long')
      .max(1000, 'Sealing reason must not exceed 1000 characters'),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes must not exceed 2000 characters')
      .optional(),
  })
  .strict();

/**
 * Validation schema for unsealing evidence.
 */
export const unsealCustodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'Unsealing reason must be at least 3 characters long')
      .max(1000, 'Unsealing reason must not exceed 1000 characters'),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes must not exceed 2000 characters')
      .optional(),
  })
  .strict();

/**
 * Validation schema for releasing evidence.
 */
export const releaseCustodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'Release reason must be at least 3 characters long')
      .max(1000, 'Release reason must not exceed 1000 characters'),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes must not exceed 2000 characters')
      .optional(),
    location: z
      .string()
      .trim()
      .max(255, 'Release destination must not exceed 255 characters')
      .optional(),
  })
  .strict();

/**
 * Query schema for listing custody history with pagination.
 */
export const listCustodyHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Query schema for listing audit history with filters and pagination.
 */
export const listAuditHistoryQuerySchema = z.object({
  action: z.nativeEnum(EvidenceAuditAction).optional(),
  result: z.nativeEnum(AuditResult).optional(),
  actorUserId: z.string().uuid('Actor user ID must be a valid UUID').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransferCustodyInput = z.infer<typeof transferCustodySchema>;
export type ReceiveCustodyInput = z.infer<typeof receiveCustodySchema>;
export type SealCustodyInput = z.infer<typeof sealCustodySchema>;
export type UnsealCustodyInput = z.infer<typeof unsealCustodySchema>;
export type ReleaseCustodyInput = z.infer<typeof releaseCustodySchema>;
export type ListCustodyHistoryQueryInput = z.infer<typeof listCustodyHistoryQuerySchema>;
export type ListAuditHistoryQueryInput = z.infer<typeof listAuditHistoryQuerySchema>;
