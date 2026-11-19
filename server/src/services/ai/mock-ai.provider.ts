import { AIProvider } from './ai-provider.interface';
import {
  AIProviderInput,
  AIIncidentInput,
  AIProviderResult,
  AIStructuredOutput,
  AIStructuredIndicator,
  AIStructuredFinding,
  FindingSeverity,
} from '../../types/ai.types';
import { structuredAIOutputSchema } from '../../validators/ai.validator';

/**
 * Deterministic Mock AI Provider used for automated tests and offline development.
 * Guarantees schema-compliant results without requiring third-party API keys or internet access.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-deterministic-v1';

  async analyzeEvidence(input: AIProviderInput): Promise<AIProviderResult> {
    // 1. Edge-case test simulation triggers
    if (input.content.includes('__TRIGGER_MOCK_PROVIDER_ERROR__')) {
      throw new Error('Simulated upstream AI provider service unavailable');
    }

    if (input.content.includes('__TRIGGER_MOCK_INVALID_JSON__')) {
      // Return raw string that fails JSON validation / schema parsing
      return {
        provider: this.name,
        model: this.defaultModel,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        structuredOutput: 'INVALID_RAW_NON_JSON_RESPONSE' as any,
      };
    }

    if (input.content.includes('__TRIGGER_MOCK_SCHEMA_ERROR__')) {
      return {
        provider: this.name,
        model: this.defaultModel,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        structuredOutput: {
          summary: 'Missing required classification and findings',
          confidence: 99.9, // Invalid: exceeds 1.0
        } as any,
      };
    }

    // 2. Extract real indicators from content if present
    const indicators: AIStructuredIndicator[] = [];

    // IP address regex
    const ipMatches = input.content.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g);
    if (ipMatches) {
      for (const ip of Array.from(new Set(ipMatches)).slice(0, 5)) {
        indicators.push({ type: 'IP', value: ip, confidence: 0.95 });
      }
    }

    // Domain regex
    const domainMatches = input.content.match(/\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|edu|gov|xyz|biz|local)\b/gi);
    if (domainMatches) {
      for (const dom of Array.from(new Set(domainMatches)).slice(0, 5)) {
        if (!dom.includes('evidence-platform.local')) {
          indicators.push({ type: 'DOMAIN', value: dom.toLowerCase(), confidence: 0.90 });
        }
      }
    }

    // SHA-256 / MD5 hashes
    const hashMatches = input.content.match(/\b[a-fA-F0-9]{32,64}\b/g);
    if (hashMatches) {
      for (const hash of Array.from(new Set(hashMatches)).slice(0, 3)) {
        indicators.push({ type: 'HASH', value: hash.toLowerCase(), confidence: 0.98 });
      }
    }

    // Default indicator if none extracted
    if (indicators.length === 0) {
      indicators.push({
        type: 'FILE',
        value: input.contextDescription || 'unknown-artifact',
        confidence: 0.85,
      });
    }

    // 3. Generate findings based on analysis type
    const findings: AIStructuredFinding[] = [];
    let classification = 'SUSPICIOUS_ARTIFACT';
    let severity: FindingSeverity = 'MEDIUM';
    let summary = `Automated ${input.analysisType} generated for evidence.`;

    switch (input.analysisType) {
      case 'IOC_EXTRACTION':
        classification = 'INDICATOR_DISCOVERY';
        severity = indicators.some((i) => i.type === 'IP' || i.type === 'DOMAIN') ? 'HIGH' : 'LOW';
        summary = `Extracted ${indicators.length} observable indicator(s) from evidence content.`;
        findings.push({
          title: 'Extracted Network & File Indicators',
          description: `Identified ${indicators.length} unique observable indicator(s) requiring threat correlation.`,
          severity,
          confidence: 0.92,
        });
        break;

      case 'THREAT_ANALYSIS':
        classification = 'THREAT_VECTOR_IDENTIFIED';
        severity = 'HIGH';
        summary = 'Threat analysis identified potential unauthorized access vector or suspicious execution.';
        findings.push({
          title: 'Potential Threat Vector Activity',
          description: 'Observed patterns consistent with automated reconnaissance or credential staging.',
          severity: 'HIGH',
          confidence: 0.88,
        });
        break;

      case 'INVESTIGATION_SUMMARY':
        classification = 'INVESTIGATION_OVERVIEW';
        severity = 'MEDIUM';
        summary = 'Synthesized investigation context and evidence artifacts for lead investigator review.';
        findings.push({
          title: 'Evidence Correlation Review',
          description: 'Artifact context aligns with reported incident parameters.',
          severity: 'MEDIUM',
          confidence: 0.85,
        });
        break;

      case 'EVIDENCE_SUMMARY':
      default:
        classification = 'ARTIFACT_CONTENT_SUMMARY';
        severity = 'LOW';
        summary = `Safe text content extracted and summarized (${input.content.length} characters examined).`;
        findings.push({
          title: 'Baseline Content Characterization',
          description: 'Digital evidence artifact contains text-readable configuration or event records.',
          severity: 'LOW',
          confidence: 0.90,
        });
        break;
    }

    const structuredOutput: AIStructuredOutput = {
      summary,
      classification,
      severity,
      confidence: 0.89,
      findings,
      indicators,
      recommendedActions: [
        'Correlate identified network indicators with perimeter firewall telemetry.',
        'Preserve chain of custody and inspect adjacent server access logs.',
        'Review finding confidence before updating investigation findings.',
      ],
    };

    // Self-validate output structure
    structuredAIOutputSchema.parse(structuredOutput);

    return {
      provider: this.name,
      model: this.defaultModel,
      structuredOutput,
    };
  }

  async classifyIncident(input: AIIncidentInput): Promise<AIProviderResult> {
    const findings: AIStructuredFinding[] = [
      {
        title: `Categorization for ${input.title}`,
        description: `Incident evaluated under category ${input.category} with reported priority ${input.priority}.`,
        severity: (input.severity as FindingSeverity) || 'MEDIUM',
        confidence: 0.91,
      },
    ];

    const structuredOutput: AIStructuredOutput = {
      summary: `AI advisory classification for incident: "${input.title}". Assessed as potential ${input.category} security event.`,
      classification: input.incidentType || 'SUSPICIOUS_ACTIVITY',
      severity: (input.severity as FindingSeverity) || 'MEDIUM',
      confidence: 0.91,
      findings,
      indicators: [
        {
          type: 'OTHER',
          value: `Source: ${input.source}`,
          confidence: 0.80,
        },
      ],
      recommendedActions: [
        'Verify compromised endpoints or affected user accounts.',
        'Collect relevant host and network evidence before taking remediation actions.',
        'Maintain advisory note: Incident severity was not automatically modified by AI.',
      ],
    };

    structuredAIOutputSchema.parse(structuredOutput);

    return {
      provider: this.name,
      model: this.defaultModel,
      structuredOutput,
    };
  }
}
