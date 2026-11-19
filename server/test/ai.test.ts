import request from 'supertest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import app from '../src/app';
import prisma from '../src/config/database';
import { getAIProvider, resetAIProvider } from '../src/services/ai/ai-provider.factory';
import { MockAIProvider } from '../src/services/ai/mock-ai.provider';
import config from '../src/config/environment';

/**
 * Automated test suite for Milestone 9: AI-Assisted Evidence Analysis.
 * Validates provider abstraction, pre-flight SHA-256 integrity verification,
 * safe text preprocessing, strict Zod schema validation, duplicate protection,
 * incident classification, audit logging, and RBAC authorization boundaries.
 */
async function runAITests() {
  console.log('====================================================');
  console.log('🤖 RUNNING MILESTONE 9: AI-ASSISTED ANALYSIS TEST SUITE');
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
  const userIds: Record<string, string> = {};
  const testPassword = 'StrongPassword123!';

  let testCaseId = '';
  let testIncidentId = '';
  let docEvidenceId = '';
  let logEvidenceId = '';
  let binaryEvidenceId = '';
  let tamperedEvidenceId = '';
  let tamperedFilePath = '';
  let originalTamperedBuffer: Buffer;

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated accounts for all roles
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `ai.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Test',
        lastName: roleName,
        email,
        password: testPassword,
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to register ${roleName}: ${JSON.stringify(regRes.body)}`);
      }

      const uid = regRes.body.user.id;
      userIds[roleName] = uid;

      if (roleName !== 'VIEWER') {
        const dbRole = await prisma.role.findUnique({ where: { name: roleName } });
        if (!dbRole) throw new Error(`Role ${roleName} not found`);
        await prisma.user.update({
          where: { id: uid },
          data: { roleId: dbRole.id },
        });
      }

      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: testPassword,
      });

      tokens[roleName] = loginRes.body.token;
    }

    const adminToken = tokens['ADMIN']!;
    const invToken = tokens['INVESTIGATOR']!;
    const analystToken = tokens['ANALYST']!;
    const viewerToken = tokens['VIEWER']!;

    // ----------------------------------------------------
    // Setup: Create parent Case, Incident, and Evidence records
    // ----------------------------------------------------
    console.log('[Setup: Creating test Case, Incident, and Evidence]');

    const caseRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        title: 'Project Apex AI Investigation',
        description: 'Case container for AI-assisted digital evidence analysis testing.',
        severity: 'HIGH',
      });
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
    testIncidentId = incidentRes.body.incident.id;

    // 1. Text Document Evidence with indicators
    const docPayload = [
      'Incident Forensics Report',
      'At 03:14 UTC, remote host 198.51.100.45 established outbound TCP connection to malicious-command-node.com.',
      'A suspicious file transfer was initiated with SHA256: 8f4b2a9e1d3c5b7a9e0f2d4c6b8a1e3f5a7c9b1d3e5f7a9b1c3d5e7f9a1b3c5d.',
      'Alert forwarded by analyst@security-ops.com.',
    ].join('\n');

    const docUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${invToken}`)
      .field('caseId', testCaseId)
      .field('incidentId', testIncidentId)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .field('description', 'Suspicious outbound connection report')
      .attach('file', Buffer.from(docPayload), 'forensic-report.txt');
    docEvidenceId = docUploadRes.body.evidence.id;

    // 2. Server Log Evidence
    const logPayload = [
      '2026-09-25T14:22:01Z core-auth[1402]: Failed password for invalid user admin from 203.0.113.19 port 54122 ssh2',
      '2026-09-25T14:22:04Z core-auth[1402]: Failed password for invalid user admin from 203.0.113.19 port 54124 ssh2',
      '2026-09-25T14:22:10Z core-auth[1405]: Accepted password for deploy from 203.0.113.19 port 54130 ssh2',
    ].join('\n');

    const logUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${invToken}`)
      .field('caseId', testCaseId)
      .field('incidentId', testIncidentId)
      .field('evidenceType', 'LOG')
      .field('source', 'SERVER')
      .field('description', 'SSH authentication log snippet')
      .attach('file', Buffer.from(logPayload), 'auth.log');
    logEvidenceId = logUploadRes.body.evidence.id;

    // 3. Binary Evidence (DISK_IMAGE)
    const binaryUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${invToken}`)
      .field('caseId', testCaseId)
      .field('evidenceType', 'DISK_IMAGE')
      .field('source', 'ENDPOINT')
      .field('description', 'Raw disk image header')
      .attach('file', Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x42]), 'disk.img');
    binaryEvidenceId = binaryUploadRes.body.evidence.id;

    // 4. Evidence to be tampered
    originalTamperedBuffer = Buffer.from('AUTHENTIC EVIDENCE CONTENT BEFORE TAMPERING');
    const tamperedUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${invToken}`)
      .field('caseId', testCaseId)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .field('description', 'Tamper detection evidence file')
      .attach('file', originalTamperedBuffer, 'tamper-target.txt');
    tamperedEvidenceId = tamperedUploadRes.body.evidence.id;

    // Retrieve storagePath from database for tampered file
    const tamperedDbRecord = await prisma.evidence.findUnique({
      where: { id: tamperedEvidenceId },
      select: { storagePath: true },
    });
    tamperedFilePath = tamperedDbRecord!.storagePath;

    // Ensure Mock provider is active
    getAIProvider(new MockAIProvider());

    // ----------------------------------------------------
    // Phase 1: Environment & Provider Configuration Tests
    // ----------------------------------------------------
    console.log('\n[Phase 1: Environment & Provider Configuration Tests]');

    const activeProv = getAIProvider();
    assert(
      activeProv.name === 'mock' && activeProv.defaultModel === 'mock-deterministic-v1',
      'AI Provider abstraction successfully instantiates mock provider for testing'
    );

    assert(
      config.aiProvider !== undefined && typeof config.maxAiInputCharacters === 'number',
      'Environment configuration exposes AI settings with safe defaults'
    );

    // ----------------------------------------------------
    // Phase 2: RBAC & Authorization Tests
    // ----------------------------------------------------
    console.log('\n[Phase 2: RBAC & Authorization Tests]');

    // 1. Unauthenticated request returns 401
    const unauthRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });
    assert(unauthRes.status === 401, 'Unauthenticated AI analysis request returns 401 Unauthorized');

    // 2. VIEWER cannot initiate AI analysis (403 Forbidden)
    const viewerRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });
    assert(viewerRes.status === 403, 'VIEWER cannot initiate AI analysis (403 Forbidden enforced)');

    // 3. INVESTIGATOR can initiate AI analysis
    const invRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });
    assert(invRes.status === 200, 'INVESTIGATOR can successfully initiate AI analysis (200 OK)', invRes.body);

    // 4. ANALYST can initiate AI analysis
    const analystRes = await request(app)
      .post(`/api/evidence/${logEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ analysisType: 'THREAT_ANALYSIS' });
    assert(analystRes.status === 200, 'ANALYST can successfully initiate AI analysis (200 OK)');

    // 5. ADMIN can initiate AI analysis
    const adminRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ analysisType: 'IOC_EXTRACTION', force: true });
    assert(adminRes.status === 200, 'ADMIN can initiate AI analysis (200 OK)');

    // ----------------------------------------------------
    // Phase 3: SHA-256 Pre-Flight Evidence Integrity Tests
    // ----------------------------------------------------
    console.log('\n[Phase 3: SHA-256 Pre-Flight Integrity Tests]');

    // Tamper with the physical file on disk directly
    fs.writeFileSync(tamperedFilePath, 'TAMPERED AND CORRUPTED CONTENT INJECTED BY ATTACKER');

    const tamperedAnalysisRes = await request(app)
      .post(`/api/evidence/${tamperedEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });

    assert(
      tamperedAnalysisRes.status === 409,
      'Pre-flight physical SHA-256 mismatch halts AI execution with 409 Conflict',
      tamperedAnalysisRes.body
    );

    // Verify audit log recorded the failure
    const tamperedAuditRes = await request(app)
      .get(`/api/evidence/${tamperedEvidenceId}/audit`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      tamperedAuditRes.body.data.some(
        (l: { action: string; result: string }) =>
          l.action === 'AI_ANALYSIS_FAILED' && l.result === 'FAILURE'
      ),
      'Tampered evidence pre-flight failure recorded in tamper-evident audit log'
    );

    // Restore original file content
    fs.writeFileSync(tamperedFilePath, originalTamperedBuffer);

    const restoredAnalysisRes = await request(app)
      .post(`/api/evidence/${tamperedEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });
    assert(restoredAnalysisRes.status === 200, 'Restored authentic evidence passes SHA-256 pre-flight check');

    // ----------------------------------------------------
    // Phase 4: Preprocessing & Unsupported Media Handling
    // ----------------------------------------------------
    console.log('\n[Phase 4: Preprocessing & Unsupported Media Tests]');

    // Binary / unsupported evidence type rejected safely
    const binaryAnalysisRes = await request(app)
      .post(`/api/evidence/${binaryEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });

    assert(
      binaryAnalysisRes.status === 422,
      'Unsupported binary evidence (DISK_IMAGE) rejected with controlled 422 Unprocessable Entity',
      binaryAnalysisRes.body
    );

    // Non-existent evidence returns 404
    const nonExistentRes = await request(app)
      .post('/api/evidence/00000000-0000-0000-0000-000000000000/ai/analyze')
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });
    assert(nonExistentRes.status === 404, 'Non-existent evidence ID rejected with 404 Not Found');

    // ----------------------------------------------------
    // Phase 5: Structured AI Schema & Zod Validation Tests
    // ----------------------------------------------------
    console.log('\n[Phase 5: Structured AI Schema Validation Tests]');

    const iocRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'IOC_EXTRACTION', force: true });

    assert(
      iocRes.status === 200 &&
        iocRes.body.analysis.result !== null &&
        Array.isArray(iocRes.body.analysis.result.findings) &&
        Array.isArray(iocRes.body.analysis.result.indicators) &&
        Array.isArray(iocRes.body.analysis.result.recommendedActions),
      'AI response conforms to structured output schema with findings, indicators, and recommended actions'
    );

    const result = iocRes.body.analysis.result;
    assert(
      result.indicators.some((i: { type: string; value: string }) => i.type === 'IP' && i.value === '198.51.100.45'),
      'IOC Extraction identifies IP indicator: 198.51.100.45'
    );

    assert(
      result.indicators.some(
        (i: { type: string; value: string }) => i.type === 'DOMAIN' && i.value.includes('malicious-command-node.com')
      ),
      'IOC Extraction identifies domain indicator: malicious-command-node.com'
    );

    assert(
      result.indicators.some(
        (i: { type: string; value: string }) =>
          i.type === 'HASH' && i.value === '8f4b2a9e1d3c5b7a9e0f2d4c6b8a1e3f5a7c9b1d3e5f7a9b1c3d5e7f9a1b3c5d'
      ),
      'IOC Extraction identifies SHA-256 file hash indicator'
    );

    // ----------------------------------------------------
    // Phase 6: Lifecycle State Transitions & inputHash Tests
    // ----------------------------------------------------
    console.log('\n[Phase 6: Analysis Lifecycle & Hashing Tests]');

    const analysis = iocRes.body.analysis;
    assert(analysis.status === 'COMPLETED', 'Successful analysis transitions to COMPLETED status');
    assert(analysis.completedAt !== null, 'completedAt timestamp is populated on completion');
    assert(
      typeof analysis.inputHash === 'string' && analysis.inputHash.length === 64,
      'inputHash is calculated as a 64-character SHA-256 hexadecimal hash'
    );
    assert(
      analysis.provider === 'mock' && analysis.model === 'mock-deterministic-v1',
      'AI analysis records provider and model metadata'
    );

    // ----------------------------------------------------
    // Phase 7: Duplicate Analysis Caching & Force Re-Analysis Tests
    // ----------------------------------------------------
    console.log('\n[Phase 7: Duplicate Analysis & Force Re-Analysis Tests]');

    // Requesting identical analysis without force returns existing record
    const dupRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'IOC_EXTRACTION', force: false });

    assert(
      dupRes.status === 200 && dupRes.body.analysis.id === analysis.id,
      'Duplicate analysis request returns existing completed analysis without redundant provider calls'
    );

    // Requesting with force: true creates a new analysis record
    const forceRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ analysisType: 'IOC_EXTRACTION', force: true });

    assert(
      forceRes.status === 200 && forceRes.body.analysis.id !== analysis.id,
      'Explicit force: true flag initiates fresh analysis record'
    );

    // ----------------------------------------------------
    // Phase 8: Incident Classification Tests (Advisory Only)
    // ----------------------------------------------------
    console.log('\n[Phase 8: Incident Classification Tests]');

    // 1. VIEWER cannot classify incident (403 Forbidden)
    const viewerIncRes = await request(app)
      .post(`/api/incidents/${testIncidentId}/ai/classify`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert(viewerIncRes.status === 403, 'VIEWER cannot classify incident (403 Forbidden)');

    // 2. INVESTIGATOR classifies incident
    const incClassifyRes = await request(app)
      .post(`/api/incidents/${testIncidentId}/ai/classify`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({});

    assert(
      incClassifyRes.status === 200 &&
        incClassifyRes.body.analysis.status === 'COMPLETED' &&
        incClassifyRes.body.analysis.analysisType === 'INCIDENT_CLASSIFICATION',
      'INVESTIGATOR can classify incident with structured advisory output',
      incClassifyRes.body
    );

    // 3. Verify incident in DB was NOT automatically mutated (Advisory rule)
    const dbIncident = await prisma.incident.findUnique({
      where: { id: testIncidentId },
      select: { status: true, severity: true },
    });

    assert(
      dbIncident!.status === 'OPEN' && dbIncident!.severity === 'HIGH',
      'AI Incident classification did NOT modify database incident status or severity (strictly advisory)'
    );

    // ----------------------------------------------------
    // Phase 9: Querying & History Endpoints Tests
    // ----------------------------------------------------
    console.log('\n[Phase 9: Querying & History Tests]');

    // 1. GET /api/evidence/:id/ai
    const listRes = await request(app)
      .get(`/api/evidence/${docEvidenceId}/ai`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      listRes.status === 200 && listRes.body.data.length >= 2 && listRes.body.pagination.total >= 2,
      'VIEWER can view paginated AI analysis history for evidence record'
    );

    // 2. GET /api/ai/analyses/:analysisId
    const singleRes = await request(app)
      .get(`/api/ai/analyses/${analysis.id}`)
      .set('Authorization', `Bearer ${analystToken}`);

    assert(
      singleRes.status === 200 && singleRes.body.analysis.id === analysis.id,
      'GET /api/ai/analyses/:analysisId returns detailed single analysis'
    );

    // ----------------------------------------------------
    // Phase 10: Security, Privacy & Audit Verification Tests
    // ----------------------------------------------------
    console.log('\n[Phase 10: Security, Privacy & Audit Verification Tests]');

    // 1. Client injection of arbitrary provider or model rejected by strict Zod schema
    const spoofProviderRes = await request(app)
      .post(`/api/evidence/${docEvidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'rogue-provider',
        model: 'rogue-model',
        apiKey: 'attacker-stolen-key',
      });

    assert(
      spoofProviderRes.status === 400,
      'Client injection of provider, model, or apiKey rejected with 400 Bad Request'
    );

    // 2. Evidence Audit Trail captures AI_ANALYSIS_REQUESTED and AI_ANALYSIS_COMPLETED
    const auditRes = await request(app)
      .get(`/api/evidence/${docEvidenceId}/audit`)
      .set('Authorization', `Bearer ${viewerToken}`);

    const hasRequested = auditRes.body.data.some(
      (l: { action: string; result: string }) => l.action === 'AI_ANALYSIS_REQUESTED' && l.result === 'SUCCESS'
    );
    const hasCompleted = auditRes.body.data.some(
      (l: { action: string; result: string }) => l.action === 'AI_ANALYSIS_COMPLETED' && l.result === 'SUCCESS'
    );

    assert(
      hasRequested && hasCompleted,
      'Evidence audit log records AI_ANALYSIS_REQUESTED and AI_ANALYSIS_COMPLETED entries'
    );

    // 3. API responses strictly exclude passwordHash, secrets, and API keys
    const rawAnalysisJson = JSON.stringify(singleRes.body);
    assert(
      !rawAnalysisJson.includes('passwordHash') &&
        !rawAnalysisJson.includes('JWT_SECRET') &&
        !rawAnalysisJson.includes('api_key') &&
        !rawAnalysisJson.includes('apiKey'),
      'AI API responses strictly protect credentials, tokens, and API secrets'
    );
  } catch (err) {
    console.error('Fatal unhandled error during AI test execution:', err);
    failed++;
  } finally {
    resetAIProvider();
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 AI ANALYSIS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAITests().catch((e) => {
  console.error(e);
  process.exit(1);
});
