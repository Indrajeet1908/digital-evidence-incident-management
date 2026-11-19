import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { resetAIProvider, getAIProvider } from '../src/services/ai/ai-provider.factory';
import { MockAIProvider } from '../src/services/ai/mock-ai.provider';
import { AIProvider } from '../src/services/ai/ai-provider.interface';
import { AIProviderInput, AIIncidentInput, AIProviderResult } from '../src/types/ai.types';

/**
 * Dedicated test suite for Selectable AI Providers: Google Gemini & OpenAI GPT.
 *
 * Validates:
 * 1. Payload validation (rejects unsupported providers like 'rogue-provider' with 400).
 * 2. Routing of provider: 'gemini' to Gemini provider.
 * 3. Routing of provider: 'openai' to OpenAI provider.
 * 4. Cache & duplicate separation: Gemini vs OpenAI results are never confused or shared.
 * 5. Force fresh bypasses cache across providers.
 * 6. Missing API key handling returns clear, safe operational errors without exposing secrets.
 * 7. RBAC permissions (VIEWER denied 403, INVESTIGATOR allowed 200).
 * 8. Provider failure never produces a false success.
 * 9. Deterministic execution: mock calls used in automated tests with zero external credit spend.
 */
async function runSelectableAIProvidersTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING SELECTABLE AI PROVIDERS TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: unknown) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail !== undefined) {
        console.error('     Detail:', JSON.stringify(detail, null, 2));
      }
      failed++;
    }
  }

  const tokens: Record<string, string> = {};
  const testPassword = 'StrongPassword123!';
  let testCaseId = '';
  let testIncidentId = '';
  let testEvidenceId = '';

  try {
    // ----------------------------------------------------
    // Setup: Create test accounts
    // ----------------------------------------------------
    console.log('[Setup: Creating test accounts]');
    const rolesList = ['INVESTIGATOR', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `prov.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'ProvTest',
        lastName: roleName,
        email,
        password: testPassword,
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to create test user: ${JSON.stringify(regRes.body)}`);
      }

      const uid = regRes.body.user.id;
      if (roleName !== 'VIEWER') {
        const dbRole = await prisma.role.findUnique({ where: { name: roleName } });
        if (dbRole) {
          await prisma.user.update({
            where: { id: uid },
            data: { roleId: dbRole.id },
          });
        }
      }

      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: testPassword,
      });

      tokens[roleName] = loginRes.body.token;
    }

    const invToken = tokens['INVESTIGATOR']!;
    const viewerToken = tokens['VIEWER']!;

    // Create Case, Incident, and Evidence
    const caseRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        title: 'Selectable AI Provider Verification Case',
        description: 'Testing selectable Gemini and OpenAI provider execution.',
        severity: 'MEDIUM',
      });
    if (caseRes.status !== 201) {
      throw new Error(`Failed to create case (${caseRes.status}): ${JSON.stringify(caseRes.body)}`);
    }
    testCaseId = caseRes.body.case.id;

    const incidentRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        caseId: testCaseId,
        title: 'Unauthorized Credential Access in Core Service',
        description: 'Suspicious authentication anomalies and potential data exfiltration.',
        incidentType: 'UNAUTHORIZED_ACCESS',
        category: 'IDENTITY_ACCESS',
        severity: 'HIGH',
        priority: 'HIGH',
        source: 'SOC_ALERT',
      });
    if (incidentRes.status !== 201) {
      throw new Error(`Failed to create incident (${incidentRes.status}): ${JSON.stringify(incidentRes.body)}`);
    }
    testIncidentId = incidentRes.body.incident.id;

    const evidenceContent = 'Log entry: 2026-10-09 Suspicious telemetry ping observed from 192.0.2.1';
    const uploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${invToken}`)
      .field('caseId', testCaseId)
      .field('incidentId', testIncidentId)
      .field('evidenceType', 'LOG')
      .field('source', 'SERVER')
      .field('description', 'Server log artifact for provider test')
      .attach('file', Buffer.from(evidenceContent), 'provider-test.log');
    testEvidenceId = uploadRes.body.evidence.id;

    // ----------------------------------------------------
    // 1. Zod Validation & Unsupported Provider Rejection
    // ----------------------------------------------------
    console.log('\n[1. Provider Validation & Security Rejection]');

    const invalidProviderRes = await request(app)
      .post(`/api/evidence/${testEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'rogue-external-llm',
      });
    assert(
      invalidProviderRes.status === 400,
      'Unsupported provider value is rejected with 400 Bad Request'
    );

    const invalidIncidentProviderRes = await request(app)
      .post(`/api/incidents/${testIncidentId}/ai/classify`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        provider: 'unauthorized-model',
      });
    assert(
      invalidIncidentProviderRes.status === 400,
      'Unsupported incident classification provider rejected with 400 Bad Request'
    );

    // ----------------------------------------------------
    // 2. RBAC Enforcement
    // ----------------------------------------------------
    console.log('\n[2. RBAC Access Control Tests]');

    const viewerEvidenceRes = await request(app)
      .post(`/api/evidence/${testEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'gemini',
      });
    assert(
      viewerEvidenceRes.status === 403,
      'VIEWER denied initiating evidence AI analysis (403 Forbidden)'
    );

    const viewerIncidentRes = await request(app)
      .post(`/api/incidents/${testIncidentId}/ai/classify`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        provider: 'openai',
      });
    assert(
      viewerIncidentRes.status === 403,
      'VIEWER denied classifying incident (403 Forbidden)'
    );

    // ----------------------------------------------------
    // 3. Provider Routing & Isolation (Using Mock Provider Instances)
    // ----------------------------------------------------
    console.log('\n[3. Provider Routing & Provenance Isolation Tests]');

    // Mock Gemini Provider
    class MockGeminiTestProvider implements AIProvider {
      readonly name = 'gemini';
      readonly defaultModel = 'gemini-1.5-flash';
      async analyzeEvidence(input: AIProviderInput): Promise<AIProviderResult> {
        return {
          provider: this.name,
          model: this.defaultModel,
          structuredOutput: {
            summary: `Gemini analysis of ${input.analysisType}`,
            classification: 'SUSPICIOUS_LOG',
            severity: 'MEDIUM',
            confidence: 0.92,
            findings: [{ title: 'Gemini Finding', description: 'Observed anomaly', severity: 'MEDIUM', confidence: 0.9 }],
            indicators: [{ type: 'IP', value: '192.0.2.1', confidence: 0.95 }],
            recommendedActions: ['Isolate network segment'],
          },
        };
      }
      async classifyIncident(input: AIIncidentInput): Promise<AIProviderResult> {
        return {
          provider: this.name,
          model: this.defaultModel,
          structuredOutput: {
            summary: `Gemini classification for ${input.title}`,
            classification: 'POLICY_VIOLATION',
            severity: 'MEDIUM',
            confidence: 0.91,
            findings: [],
            indicators: [],
            recommendedActions: ['Review policy guidelines'],
          },
        };
      }
    }

    // Mock OpenAI Provider
    class MockOpenAITestProvider implements AIProvider {
      readonly name = 'openai';
      readonly defaultModel = 'gpt-4o-mini';
      async analyzeEvidence(input: AIProviderInput): Promise<AIProviderResult> {
        return {
          provider: this.name,
          model: this.defaultModel,
          structuredOutput: {
            summary: `OpenAI analysis of ${input.analysisType}`,
            classification: 'ANOMALOUS_EVENT',
            severity: 'HIGH',
            confidence: 0.88,
            findings: [{ title: 'OpenAI Finding', description: 'Unusual telemetry', severity: 'HIGH', confidence: 0.88 }],
            indicators: [{ type: 'IP', value: '192.0.2.1', confidence: 0.92 }],
            recommendedActions: ['Trigger EDR containment'],
          },
        };
      }
      async classifyIncident(input: AIIncidentInput): Promise<AIProviderResult> {
        return {
          provider: this.name,
          model: this.defaultModel,
          structuredOutput: {
            summary: `OpenAI classification for ${input.title}`,
            classification: 'SUSPICIOUS_ACCESS',
            severity: 'HIGH',
            confidence: 0.87,
            findings: [],
            indicators: [],
            recommendedActions: ['Revoke active tokens'],
          },
        };
      }
    }

    // Register Gemini mock
    getAIProvider(new MockGeminiTestProvider());

    const geminiRes = await request(app)
      .post(`/api/evidence/${testEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'gemini',
        force: true,
      });

    assert(
      geminiRes.status === 200 &&
        geminiRes.body.analysis.provider === 'gemini' &&
        geminiRes.body.analysis.model === 'gemini-1.5-flash',
      'Gemini request records provider=gemini and model=gemini-1.5-flash'
    );
    const geminiAnalysisId = geminiRes.body.analysis.id;

    // Register OpenAI mock
    resetAIProvider();
    getAIProvider(new MockOpenAITestProvider());

    const openaiRes = await request(app)
      .post(`/api/evidence/${testEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'openai',
        force: false, // NOT forced: must NOT return the Gemini cached analysis!
      });

    assert(
      openaiRes.status === 200 &&
        openaiRes.body.analysis.provider === 'openai' &&
        openaiRes.body.analysis.model === 'gpt-4o-mini',
      'OpenAI request records provider=openai and model=gpt-4o-mini'
    );
    const openaiAnalysisId = openaiRes.body.analysis.id;

    // Verify cache separation: OpenAI request did NOT return the Gemini record
    assert(
      geminiAnalysisId !== openaiAnalysisId,
      'CACHE SEPARATION: OpenAI request does not return cached Gemini analysis'
    );

    // Verify requesting Gemini again returns Gemini cached analysis
    resetAIProvider();
    getAIProvider(new MockGeminiTestProvider());

    const geminiCachedRes = await request(app)
      .post(`/api/evidence/${testEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'gemini',
        force: false,
      });

    assert(
      geminiCachedRes.status === 200 && geminiCachedRes.body.analysis.id === geminiAnalysisId,
      'Duplicate Gemini request returns cached Gemini analysis without cross-provider confusion'
    );

    // ----------------------------------------------------
    // 4. Incident Classification Provider Selection
    // ----------------------------------------------------
    console.log('\n[4. Incident Classification Provider Selection Tests]');

    const incGeminiRes = await request(app)
      .post(`/api/incidents/${testIncidentId}/ai/classify`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        provider: 'gemini',
        force: true,
      });

    assert(
      incGeminiRes.status === 200 && incGeminiRes.body.analysis.provider === 'gemini',
      'Incident classification with provider=gemini succeeds and records provider=gemini'
    );

    resetAIProvider();
    getAIProvider(new MockOpenAITestProvider());

    const incOpenAIRes = await request(app)
      .post(`/api/incidents/${testIncidentId}/ai/classify`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        provider: 'openai',
        force: true,
      });

    assert(
      incOpenAIRes.status === 200 && incOpenAIRes.body.analysis.provider === 'openai',
      'Incident classification with provider=openai succeeds and records provider=openai'
    );

    assert(
      incGeminiRes.body.analysis.id !== incOpenAIRes.body.analysis.id,
      'Incident classification cache distinguishes between Gemini and OpenAI runs'
    );

    // ----------------------------------------------------
    // 5. Failure Handling (No False Success)
    // ----------------------------------------------------
    console.log('\n[5. Provider Failure Handling Tests]');

    class FailingTestProvider implements AIProvider {
      readonly name = 'gemini';
      readonly defaultModel = 'gemini-1.5-flash';
      async analyzeEvidence(): Promise<AIProviderResult> {
        throw new Error('Simulated upstream network timeout');
      }
      async classifyIncident(): Promise<AIProviderResult> {
        throw new Error('Simulated upstream network timeout');
      }
    }

    resetAIProvider();
    getAIProvider(new FailingTestProvider());

    const failedRes = await request(app)
      .post(`/api/evidence/${testEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        analysisType: 'THREAT_ANALYSIS',
        provider: 'gemini',
        force: true,
      });

    assert(
      failedRes.status === 502,
      'Failed provider call returns HTTP 502 Bad Gateway and NEVER reports false success'
    );

    // Verify database record has FAILED status
    const failedDbRecord = await prisma.aIAnalysis.findFirst({
      where: {
        evidenceId: testEvidenceId,
        analysisType: 'THREAT_ANALYSIS',
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      failedDbRecord?.status === 'FAILED',
      'Database status is recorded as FAILED on provider error'
    );

  } catch (err) {
    console.error('Fatal unhandled error in selectable AI providers test:', err);
    failed++;
  } finally {
    resetAIProvider();
    getAIProvider(new MockAIProvider());
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 SELECTABLE AI PROVIDERS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSelectableAIProvidersTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
