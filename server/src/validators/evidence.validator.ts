import { z } from 'zod';
import { EvidenceType, EvidenceSource } from '@prisma/client';

/**
 * Validation schema for uploading evidence metadata (received as multipart/form-data text fields).
 * Strict validation ensures no client can inject system or integrity fields (sha256, evidenceNumber, etc.).
 */
export const createEvidenceSchema = z
  .object({
    caseId: z.string().uuid('Case ID must be a valid UUID'),
    incidentId: z
      .string()
      .uuid('Incident ID must be a valid UUID')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    evidenceType: z.nativeEnum(EvidenceType, {
      message: 'Invalid evidence type',
    }),
    description: z
      .string()
      .trim()
      .max(5000, 'Description must not exceed 5000 characters')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    source: z.nativeEnum(EvidenceSource, {
      message: 'Invalid evidence source',
    }),
    collectedAt: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? undefined : val),
      z.coerce.date().optional()
    ),
  })
  .strict();

/**
 * Validation schema for updating evidence metadata.
 * Only non-immutable metadata can be updated.
 * System fields (sha256, storagePath, fileSize, evidenceNumber, etc.) are strictly rejected.
 */
export const updateEvidenceMetadataSchema = z
  .object({
    description: z
      .string()
      .trim()
      .max(5000, 'Description must not exceed 5000 characters')
      .nullable()
      .optional(),
    evidenceType: z
      .nativeEnum(EvidenceType, {
        message: 'Invalid evidence type',
      })
      .optional(),
    source: z
      .nativeEnum(EvidenceSource, {
        message: 'Invalid evidence source',
      })
      .optional(),
    collectedAt: z.coerce.date().nullable().optional(),
  })
  .strict();

/**
 * Query schema for listing and searching evidence records with pagination and filters.
 */
export const listEvidenceQuerySchema = z.object({
  caseId: z.string().uuid('Case ID must be a valid UUID').optional(),
  incidentId: z.string().uuid('Incident ID must be a valid UUID').optional(),
  evidenceType: z.nativeEnum(EvidenceType).optional(),
  source: z.nativeEnum(EvidenceSource).optional(),
  uploadedById: z.string().uuid('UploadedBy ID must be a valid UUID').optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceMetadataInput = z.infer<typeof updateEvidenceMetadataSchema>;
export type ListEvidenceQueryInput = z.infer<typeof listEvidenceQuerySchema>;
