import { AIProviderInput, AIIncidentInput, AIProviderResult } from '../../types/ai.types';

/**
 * Common abstraction for AI analysis providers (Gemini, OpenAI, Mock, etc.).
 * Ensures the application is loosely coupled to any single AI vendor.
 */
export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  /**
   * Performs controlled analysis on sanitized evidence text content.
   */
  analyzeEvidence(input: AIProviderInput): Promise<AIProviderResult>;

  /**
   * Performs advisory incident classification using sanitized incident context.
   */
  classifyIncident(input: AIIncidentInput): Promise<AIProviderResult>;
}
