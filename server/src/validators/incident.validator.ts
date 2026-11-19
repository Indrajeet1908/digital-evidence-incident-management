import { z } from 'zod';
import {
  IncidentStatus,
  IncidentPriority,
  IncidentSeverity,
  IncidentType,
  IncidentCategory,
  IncidentSource,
} from '@prisma/client';

/**
 * Validation schema for creating a new Incident.
 * An incident must be linked to a valid Case.
 */
export const createIncidentSchema = z
  .object({
    caseId: z.string().uuid('Case ID must be a valid UUID'),
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
    incidentType: z
      .nativeEnum(IncidentType, {
        message: 'Invalid incident type',
      })
      .default(IncidentType.OTHER),
    category: z
      .nativeEnum(IncidentCategory, {
        message: 'Invalid incident category',
      })
      .default(IncidentCategory.OTHER),
    severity: z
      .nativeEnum(IncidentSeverity, {
        message: 'Invalid severity level',
      })
      .default(IncidentSeverity.MEDIUM),
    priority: z
      .nativeEnum(IncidentPriority, {
        message: 'Invalid priority level',
      })
      .default(IncidentPriority.MEDIUM),
    source: z
      .nativeEnum(IncidentSource, {
        message: 'Invalid incident source',
      })
      .default(IncidentSource.OTHER),
    detectedAt: z.coerce.date().optional(),
    occurredAt: z.coerce.date().optional(),
    reportedAt: z.coerce.date().optional(),
    assignedToId: z
      .string()
      .uuid('Assigned user ID must be a valid UUID')
      .optional(),
  })
  .strict();

/**
 * Validation schema for updating Incident details.
 */
export const updateIncidentSchema = z
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
    incidentType: z.nativeEnum(IncidentType).optional(),
    category: z.nativeEnum(IncidentCategory).optional(),
    severity: z.nativeEnum(IncidentSeverity).optional(),
    priority: z.nativeEnum(IncidentPriority).optional(),
    source: z.nativeEnum(IncidentSource).optional(),
    detectedAt: z.coerce.date().nullable().optional(),
    occurredAt: z.coerce.date().nullable().optional(),
    reportedAt: z.coerce.date().nullable().optional(),
    assignedToId: z
      .string()
      .uuid('Assigned user ID must be a valid UUID')
      .nullable()
      .optional(),
    resolution: z
      .string()
      .trim()
      .max(5000, 'Resolution must not exceed 5000 characters')
      .nullable()
      .optional(),
  })
  .strict();

/**
 * Validation schema for transitioning Incident status.
 * Requires a closure reason when transitioning to CLOSED.
 */
export const updateIncidentStatusSchema = z
  .object({
    status: z.nativeEnum(IncidentStatus, {
      message: 'Invalid incident status',
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
      if (data.status === IncidentStatus.CLOSED) {
        return Boolean(data.reason && data.reason.trim().length > 0);
      }
      return true;
    },
    {
      message: 'A closure reason or resolution note is required when closing an incident',
      path: ['reason'],
    }
  );

/**
 * Validation schema for query parameters when listing incidents.
 */
export const listIncidentsQuerySchema = z
  .object({
    caseId: z.string().uuid().optional(),
    status: z.nativeEnum(IncidentStatus).optional(),
    severity: z.nativeEnum(IncidentSeverity).optional(),
    priority: z.nativeEnum(IncidentPriority).optional(),
    incidentType: z.nativeEnum(IncidentType).optional(),
    category: z.nativeEnum(IncidentCategory).optional(),
    assignedToId: z.string().uuid().optional(),
    search: z.string().trim().max(100, 'Search query must not exceed 100 characters').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type UpdateIncidentStatusInput = z.infer<typeof updateIncidentStatusSchema>;
export type ListIncidentsQueryInput = z.infer<typeof listIncidentsQuerySchema>;
