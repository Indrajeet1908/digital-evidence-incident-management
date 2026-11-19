/**
 * Report request validation schemas.
 * Validates report generation input with cross-field rules.
 */

import { z } from 'zod';
import { REPORT_TYPES } from '../types/report.types';

const reportTypeEnum = z.enum([
  REPORT_TYPES.INVESTIGATION_SUMMARY,
  REPORT_TYPES.DETAILED_CASE_REPORT,
  REPORT_TYPES.INCIDENT_REPORT,
  REPORT_TYPES.EVIDENCE_REPORT,
  REPORT_TYPES.CHAIN_OF_CUSTODY_REPORT,
  REPORT_TYPES.AI_ANALYSIS_REPORT,
], { message: 'Invalid report type' });

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Generates a report request schema with cross-field validation rules:
 * - INVESTIGATION_SUMMARY / DETAILED_CASE_REPORT require caseId
 * - INCIDENT_REPORT requires incidentId
 * - EVIDENCE_REPORT / CHAIN_OF_CUSTODY_REPORT require evidenceId
 * - AI_ANALYSIS_REPORT requires evidenceId or incidentId
 */
export const generateReportSchema = z.object({
  reportType: reportTypeEnum,
  caseId: uuidSchema.optional(),
  incidentId: uuidSchema.optional(),
  evidenceId: uuidSchema.optional(),
  includeAI: z.boolean().optional().default(true),
  includeAudit: z.boolean().optional().default(true),
  includeCustody: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  const { reportType, caseId, incidentId, evidenceId } = data;

  switch (reportType) {
    case REPORT_TYPES.INVESTIGATION_SUMMARY:
    case REPORT_TYPES.DETAILED_CASE_REPORT:
      if (!caseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'caseId is required for this report type',
          path: ['caseId'],
        });
      }
      break;

    case REPORT_TYPES.INCIDENT_REPORT:
      if (!incidentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'incidentId is required for this report type',
          path: ['incidentId'],
        });
      }
      break;

    case REPORT_TYPES.EVIDENCE_REPORT:
    case REPORT_TYPES.CHAIN_OF_CUSTODY_REPORT:
      if (!evidenceId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'evidenceId is required for this report type',
          path: ['evidenceId'],
        });
      }
      break;

    case REPORT_TYPES.AI_ANALYSIS_REPORT:
      if (!evidenceId && !incidentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'evidenceId or incidentId is required for AI analysis report',
          path: ['evidenceId'],
        });
      }
      break;
  }
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
