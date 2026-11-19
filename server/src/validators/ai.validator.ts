import { z } from 'zod';
import { AIAnalysisType, AIAnalysisStatus } from '@prisma/client';

/**
 * Validation schema for initiating evidence analysis.
 * Strict validation ensures clients cannot supply arbitrary models,
 * custom providers, or unauthorized parameters.
 */
export const analyzeEvidenceSchema = z
  .object({
    analysisType: z.nativeEnum(AIAnalysisType, {
      message: 'Invalid AI analysis type. Allowed types: EVIDENCE_SUMMARY, INCIDENT_CLASSIFICATION, IOC_EXTRACTION, THREAT_ANALYSIS, INVESTIGATION_SUMMARY',
    }),
    force: z.boolean().optional().default(false),
    provider: z.enum(['gemini', 'openai', 'mock'], {
      message: 'Invalid AI provider. Allowed providers: gemini, openai',
    }).optional(),
  })
  .strict();

/**
 * Validation schema for incident classification.
 */
export const classifyIncidentSchema = z
  .object({
    force: z.boolean().optional().default(false),
    provider: z.enum(['gemini', 'openai', 'mock'], {
      message: 'Invalid AI provider. Allowed providers: gemini, openai',
    }).optional(),
  })
  .strict();

/**
 * Query schema for listing AI analyses.
 */
export const listAIAnalysesQuerySchema = z.object({
  analysisType: z.nativeEnum(AIAnalysisType).optional(),
  status: z.nativeEnum(AIAnalysisStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Strict schema for validating AI-generated findings.
 */
export const findingSchema = z
  .object({
    title: z.string().min(1, 'Finding title cannot be empty').max(255),
    description: z.string().min(1, 'Finding description cannot be empty').max(2000),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']),
    confidence: z.number().min(0).max(1),
  })
  .strict();

/**
 * Strict schema for validating AI-extracted indicators of compromise (IOCs).
 */
export const indicatorSchema = z
  .object({
    type: z.enum(['IP', 'DOMAIN', 'URL', 'EMAIL', 'HASH', 'FILE', 'OTHER']),
    value: z.string().min(1, 'Indicator value cannot be empty').max(500),
    confidence: z.number().min(0).max(1),
  })
  .strict();

/**
 * Strict schema for validating structured AI provider responses before saving to database.
 * If AI output violates this schema, the analysis is marked FAILED and never stored as successful.
 */
export const structuredAIOutputSchema = z
  .object({
    summary: z.string().min(1, 'Analysis summary cannot be empty').max(5000),
    classification: z.string().min(1, 'Analysis classification cannot be empty').max(100),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']),
    confidence: z.number().min(0).max(1),
    findings: z.array(findingSchema),
    indicators: z.array(indicatorSchema),
    recommendedActions: z.array(z.string().min(1).max(1000)),
  })
  .strict();
