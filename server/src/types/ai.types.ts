import { AIAnalysisType, AIAnalysisStatus } from '@prisma/client';

export { AIAnalysisType, AIAnalysisStatus };

export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export type IndicatorType = 'IP' | 'DOMAIN' | 'URL' | 'EMAIL' | 'HASH' | 'FILE' | 'OTHER';

export interface AIStructuredFinding {
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
}

export interface AIStructuredIndicator {
  type: IndicatorType;
  value: string;
  confidence: number;
}

export interface AIStructuredOutput {
  summary: string;
  classification: string;
  severity: FindingSeverity;
  confidence: number;
  findings: AIStructuredFinding[];
  indicators: AIStructuredIndicator[];
  recommendedActions: string[];
}

export type AIProviderName = 'gemini' | 'openai' | 'mock';

export interface AIAnalysisRequestInput {
  analysisType: AIAnalysisType;
  force?: boolean;
  provider?: AIProviderName;
}

export interface AIIncidentClassifyInput {
  force?: boolean;
  provider?: AIProviderName;
}

export interface AIAnalysisResponse {
  id: string;
  evidenceId: string | null;
  incidentId: string | null;
  caseId: string;
  analysisType: AIAnalysisType;
  provider: string;
  model: string;
  status: AIAnalysisStatus;
  inputHash: string;
  result: AIStructuredOutput | null;
  summary: string | null;
  confidence: number | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  evidence?: {
    id: string;
    evidenceNumber: string;
    originalFilename: string;
    evidenceType: string;
  } | null;
  incident?: {
    id: string;
    incidentNumber: string;
    title: string;
    severity: string;
  } | null;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  };
}

export interface AIProviderInput {
  analysisType: AIAnalysisType;
  contextDescription: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AIIncidentInput {
  title: string;
  description?: string | null;
  incidentType: string;
  category: string;
  severity: string;
  priority: string;
  source: string;
  evidenceSummaries?: string[];
}

export interface AIProviderResult {
  provider: string;
  model: string;
  structuredOutput: AIStructuredOutput;
}
