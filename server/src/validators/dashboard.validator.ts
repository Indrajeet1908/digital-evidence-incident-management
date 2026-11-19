import { z } from 'zod';
import {
  IncidentStatus,
  IncidentSeverity,
  IncidentPriority,
  IncidentType,
  IncidentCategory,
  EvidenceType,
  EvidenceSource,
} from '@prisma/client';

/**
 * Validation schema for querying the normalized activity timeline.
 */
export const listActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().trim().optional(),
  caseId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  evidenceId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.date().optional()),
  to: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.date().optional()),
});

/**
 * Validation schema for incident intelligence queries.
 */
export const listIncidentIntelligenceQuerySchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  priority: z.nativeEnum(IncidentPriority).optional(),
  incidentType: z.nativeEnum(IncidentType).optional(),
  category: z.nativeEnum(IncidentCategory).optional(),
  caseId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  from: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.date().optional()),
  to: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.date().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Validation schema for evidence intelligence queries.
 */
export const listEvidenceIntelligenceQuerySchema = z.object({
  caseId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  evidenceType: z.nativeEnum(EvidenceType).optional(),
  source: z.nativeEnum(EvidenceSource).optional(),
  integrityStatus: z.enum(['VALID', 'MISMATCH', 'UNVERIFIED']).optional(),
  uploadedById: z.string().uuid().optional(),
  from: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.date().optional()),
  to: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.date().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Validation schema for unified multi-entity search.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty').max(100, 'Search query too long'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
