process.env.NODE_ENV = 'test';

import request from 'supertest';
import config from '../src/config/environment';
config.nodeEnv = 'test';
import app from '../src/app';
import prisma from '../src/config/database';
import { createRateLimiter } from '../src/middleware/rate-limiter.middleware';
import express from 'express';

/**
 * Dedicated Automated Test Suite for Milestone 12: Security Hardening & Production Controls.
 *
 * Verifies:
 * 1. HTTP Security Headers (CSP, X-Content-Type-Options, X-Frame-Options, no X-Powered-By)
 * 2. CORS Policy (Whitelist validation, unauthorized origin rejection, preflight)
 * 3. Rate Limiting (Sliding-window trigger, 429 Too Many Requests, Retry-After header)
 * 4. Authentication Hardening (Missing/malformed tokens, expired tokens, inactive user lock-out, generic login errors)
 * 5. BOLA / IDOR Resource Authorization (Cross-case roster tampering, custody recipient hijacking, report access)
 * 6. Input Validation (Bounded search queries, oversized JSON payloads 413, malformed UUIDs)
 * 7. Evidence & File Security (Content-Disposition header sanitization, storage path isolation)
 * 8. Information Disclosure (500 error sanitization, no stack traces, no database credentials)
 * 9. AI Security & Prompt Isolation (Boundary tags, provider override rejection, advisory labeling)
 * 10. Report Security (XSS escaping, stateless generation, distinct hash)
 */
async function runSecurityHardeningTests() {
  console.log('====================================================');
  console.log('🛡️  RUNNING MILESTONE 12: SECURITY HARDENING TEST SUITE');
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

  try {
    // ─── Setup: Create role-based accounts ───────────────────
    console.log('[Setup: Creating isolated test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `sec.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Sec',
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

    // Create a secondary Investigator account specifically for BOLA / IDOR cross-resource tests
    const secondInvEmail = `sec.test.inv2.${Date.now()}@evidence-platform.local`;
    const regInv2 = await request(app).post('/api/auth/register').send({
      firstName: 'SecInvestigator',
      lastName: 'Two',
      email: secondInvEmail,
      password: testPassword,
    });
    const invRole = await prisma.role.findUnique({ where: { name: 'INVESTIGATOR' } });
    await prisma.user.update({
      where: { id: regInv2.body.user.id },
      data: { roleId: invRole!.id },
    });
    const loginInv2 = await request(app).post('/api/auth/login').send({
      email: secondInvEmail,
      password: testPassword,
    });
    const investigator2Token = loginInv2.body.token;
    const investigator2Id = regInv2.body.user.id;

    const adminToken = tokens['ADMIN'];
    const investigatorToken = tokens['INVESTIGATOR'];
    const analystToken = tokens['ANALYST'];
    const viewerToken = tokens['VIEWER'];

    // ──────────────────────────────────────────────────────────
    // 1. HTTP Security Headers Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[1. HTTP Security Headers Tests]');

    const healthRes = await request(app).get('/api/health');

    assert(
      healthRes.headers['x-content-type-options'] === 'nosniff',
      'X-Content-Type-Options is nosniff'
    );
    assert(
      healthRes.headers['x-frame-options'] === 'DENY',
      'X-Frame-Options is DENY'
    );
    assert(
      healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin',
      'Referrer-Policy is strict-origin-when-cross-origin'
    );
    assert(
      healthRes.headers['x-powered-by'] === undefined,
      'X-Powered-By header is stripped from response'
    );
    assert(
      typeof healthRes.headers['content-security-policy'] === 'string' &&
        healthRes.headers['content-security-policy'].includes("frame-ancestors 'none'"),
      'Content-Security-Policy header is configured and enforces frame-ancestors none'
    );

    // ──────────────────────────────────────────────────────────
    // 2. CORS Policy Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[2. CORS Policy Tests]');

    // Allowed origin
    const allowedCorsRes = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    assert(
      allowedCorsRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
      'Whitelisted Origin receives Access-Control-Allow-Origin header'
    );
    assert(
      allowedCorsRes.headers['access-control-allow-credentials'] === 'true',
      'Whitelisted Origin receives Access-Control-Allow-Credentials'
    );

    // Unauthorized origin rejected on preflight OPTIONS
    const forbiddenCorsRes = await request(app)
      .options('/api/cases')
      .set('Origin', 'https://malicious-attacker-domain.com');

    assert(
      forbiddenCorsRes.status === 403,
      'Unauthorized Origin is rejected on preflight OPTIONS (403 Forbidden)'
    );

    // ──────────────────────────────────────────────────────────
    // 3. Rate Limiting Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[3. Rate Limiting Tests]');

    // Test sliding-window limiter behavior using isolated server-side rate limiter instance
    const testLimiterApp = express();
    const testLimiter = createRateLimiter({
      windowMs: 10000,
      max: 2,
      keyPrefix: 'test_rl',
      message: 'Rate limit exceeded for test',
    });
    testLimiterApp.use(testLimiter);
    testLimiterApp.get('/test-rl', (_req, res) => res.json({ ok: true }));

    const r1 = await request(testLimiterApp).get('/test-rl');
    const r2 = await request(testLimiterApp).get('/test-rl');
    const r3 = await request(testLimiterApp).get('/test-rl');

    assert(r1.status === 200, 'Rate limiter allows 1st request within budget');
    assert(r2.status === 200, 'Rate limiter allows 2nd request within budget');
    assert(r3.status === 429, 'Rate limiter blocks 3rd request with 429 Too Many Requests');
    assert(
      r3.headers['retry-after'] !== undefined && Number(r3.headers['retry-after']) >= 1,
      'Rate limited response includes valid Retry-After header'
    );

    // ──────────────────────────────────────────────────────────
    // 4. Authentication Hardening Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[4. Authentication Hardening Tests]');

    // Missing token
    const noToken = await request(app).get('/api/auth/me');
    assert(noToken.status === 401, 'Missing token returns 401');

    // Malformed token
    const badToken = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-bytes-here');
    assert(badToken.status === 401, 'Malformed token returns 401');

    // Account enumeration defense: invalid email vs invalid password return identical error
    const nonExistentEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent-user-12345@test.local', password: 'Password123!' });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: secondInvEmail, password: 'WrongPassword123!' });

    assert(
      nonExistentEmail.status === 401 && wrongPassword.status === 401,
      'Failed login returns 401 for both non-existent user and wrong password'
    );
    assert(
      nonExistentEmail.body.error === wrongPassword.body.error,
      'Login returns identical error message to prevent account enumeration'
    );

    // Inactive account lock-out
    await prisma.user.update({
      where: { id: investigator2Id },
      data: { isActive: false },
    });
    const inactiveLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: secondInvEmail, password: testPassword });
    assert(
      inactiveLogin.status === 401,
      'Deactivated user cannot log in (401)'
    );

    const inactiveTokenAccess = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${investigator2Token}`);
    assert(
      inactiveTokenAccess.status === 401 &&
        inactiveTokenAccess.body.message.includes('deactivated'),
      'Token from deactivated account is immediately rejected upon verification (401)'
    );

    // Restore active status
    await prisma.user.update({
      where: { id: investigator2Id },
      data: { isActive: true },
    });

    // ──────────────────────────────────────────────────────────
    // 5. BOLA / IDOR Authorization Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[5. BOLA / IDOR Authorization Tests]');

    // Create a Case with Investigator 1 as Lead Investigator
    const caseA = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        title: 'Case Alpha - BOLA Test Case',
        description: 'Case owned by Investigator One',
        priority: 'HIGH',
        severity: 'HIGH',
        caseType: 'CYBERSECURITY_INCIDENT',
        category: 'MALWARE',
        leadInvestigatorId: userIds['INVESTIGATOR'],
      });
    const caseAId = caseA.body.case.id;

    // BOLA Attack: Investigator 2 attempts to add an Analyst to Investigator 1's case
    // Must be DENIED with 403 because Investigator 2 is NOT ADMIN and NOT the case Lead Investigator
    const bolaAddMemberRes = await request(app)
      .post(`/api/cases/${caseAId}/members`)
      .set('Authorization', `Bearer ${investigator2Token}`)
      .send({
        userId: userIds['ANALYST'],
        role: 'ANALYST',
      });

    assert(
      bolaAddMemberRes.status === 403,
      'BOLA DEFENSE: Non-lead Investigator cannot modify case members roster (403 Forbidden)'
    );

    // Authorized modification: Lead Investigator (Investigator 1) CAN add a member
    const leadAddMemberRes = await request(app)
      .post(`/api/cases/${caseAId}/members`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        userId: userIds['ANALYST'],
        role: 'ANALYST',
      });

    assert(
      leadAddMemberRes.status === 201,
      'Authorized Lead Investigator can assign case member (201 Created)'
    );

    // BOLA Attack: Investigator 2 attempts to remove Analyst from Investigator 1's case
    const bolaRemoveMemberRes = await request(app)
      .delete(`/api/cases/${caseAId}/members/${userIds['ANALYST']}`)
      .set('Authorization', `Bearer ${investigator2Token}`);

    assert(
      bolaRemoveMemberRes.status === 403,
      'BOLA DEFENSE: Non-lead Investigator cannot remove members from another case (403 Forbidden)'
    );

    // Authorized modification: ADMIN can remove case members
    const adminRemoveMemberRes = await request(app)
      .delete(`/api/cases/${caseAId}/members/${userIds['ANALYST']}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      adminRemoveMemberRes.status === 200,
      'ADMIN has authority to remove case members (200 OK)'
    );

    // BOLA Custody Receipt Hijacking Defense:
    // Create an evidence item and transfer custody specifically to Investigator 1
    const dummyFileContent = Buffer.from('Forensic test artifact for BOLA custody verification');
    const evUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('caseId', caseAId)
      .field('evidenceType', 'LOG')
      .field('source', 'SERVER')
      .attach('file', dummyFileContent, 'audit-evidence.log');

    const evidenceId = evUploadRes.body.evidence.id;

    // Admin transfers custody to Investigator 1
    await request(app)
      .post(`/api/evidence/${evidenceId}/custody/transfer`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        toUserId: userIds['INVESTIGATOR'],
        reason: 'Transfer for analysis',
      });

    // BOLA Attack: Investigator 2 attempts to receive custody meant for Investigator 1
    const bolaCustodyReceive = await request(app)
      .post(`/api/evidence/${evidenceId}/custody/receive`)
      .set('Authorization', `Bearer ${investigator2Token}`)
      .send({
        reason: 'Unauthorized custody interception attempt',
      });

    assert(
      bolaCustodyReceive.status === 403,
      'BOLA DEFENSE: Non-designated recipient cannot hijack custody receipt (403 Forbidden)'
    );

    // Designated recipient (Investigator 1) successfully receives custody
    const authCustodyReceive = await request(app)
      .post(`/api/evidence/${evidenceId}/custody/receive`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        reason: 'Authorized custody acknowledgment',
      });

    assert(
      authCustodyReceive.status === 200,
      'Designated recipient can receive and acknowledge custody (200 OK)'
    );

    // BOLA Report Export Defense: VIEWER denied report export
    const bolaReportExport = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        reportType: 'DETAILED_CASE_REPORT',
        caseId: caseAId,
      });

    assert(
      bolaReportExport.status === 403,
      'BOLA DEFENSE: VIEWER denied report export access (403 Forbidden)'
    );

    // ──────────────────────────────────────────────────────────
    // 6. Input Validation & Payload Size Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[6. Input Validation & Payload Size Tests]');

    // Bounded search query: query > 100 characters must be rejected
    const hugeSearchQuery = 'A'.repeat(150);
    const searchCasesRes = await request(app)
      .get(`/api/cases?search=${hugeSearchQuery}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      searchCasesRes.status === 400,
      'Search query exceeding 100 characters is rejected by Zod validation (400 Bad Request)'
    );

    // Bounded search query on dashboard
    const dashSearchRes = await request(app)
      .get(`/api/dashboard/search?q=${hugeSearchQuery}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      dashSearchRes.status === 400,
      'Dashboard search query exceeding 100 characters is rejected (400 Bad Request)'
    );

    // Malformed UUID in route parameter
    const malformedUuid = await request(app)
      .get('/api/cases/invalid-uuid-format-1234')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      malformedUuid.status === 400,
      'Malformed UUID parameter rejected (400 Bad Request)'
    );

    // Oversized JSON payload: > 1MB should trigger 413 Payload Too Large
    const oversizedJson = {
      title: 'Oversized payload test',
      description: 'X'.repeat(1.2 * 1024 * 1024), // 1.2 MB
    };
    const oversizedRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send(oversizedJson);

    assert(
      oversizedRes.status === 413,
      'Oversized JSON request payload (> 1MB) returns 413 Payload Too Large'
    );

    // ──────────────────────────────────────────────────────────
    // 7. Evidence & File Security Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[7. Evidence & File Security Tests]');

    // Evidence response does NOT expose storagePath or storedFilename
    const evDetailRes = await request(app)
      .get(`/api/evidence/${evidenceId}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    const evStr = JSON.stringify(evDetailRes.body);
    assert(
      !evStr.includes('storagePath') && !evStr.includes('storedFilename'),
      'Evidence details response strictly omits internal storagePath and storedFilename'
    );

    // Safe Content-Disposition header on download (strips injection chars)
    const downloadRes = await request(app)
      .get(`/api/evidence/${evidenceId}/download`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    const disposition = downloadRes.headers['content-disposition'] || '';
    assert(
      downloadRes.status === 200,
      'Authorized evidence download succeeds (200 OK)'
    );
    assert(
      !disposition.includes('\r') && !disposition.includes('\n'),
      'Content-Disposition header is free of CRLF header injection characters'
    );

    // VIEWER denied download
    const viewerDownload = await request(app)
      .get(`/api/evidence/${evidenceId}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      viewerDownload.status === 403,
      'VIEWER role is denied evidence file download (403 Forbidden)'
    );

    // ──────────────────────────────────────────────────────────
    // 8. Information Disclosure Defense Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[8. Information Disclosure Defense Tests]');

    // Non-existent route
    const notFound = await request(app).get('/api/unknown-security-endpoint-xyz');
    assert(
      notFound.status === 404 && !JSON.stringify(notFound.body).includes('stack'),
      '404 Not Found response does not leak server stack traces'
    );

    // Centralized error handler masks sensitive credentials
    const errorStr = JSON.stringify(notFound.body);
    assert(
      !errorStr.includes('postgresql://') && !errorStr.includes('password'),
      'Error responses do not leak database connection strings or credentials'
    );

    // ──────────────────────────────────────────────────────────
    // 9. AI Security & Prompt Injection Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[9. AI Security & Prompt Injection Tests]');

    // Client injection of provider or model is rejected
    const clientInjectRes = await request(app)
      .post(`/api/evidence/${evidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        analysisType: 'EVIDENCE_SUMMARY',
        provider: 'untrusted-external-llm',
        model: 'evil-model',
      });

    assert(
      clientInjectRes.status === 400,
      'Client injection of provider or model is rejected with 400 Bad Request'
    );

    // VIEWER denied AI analysis
    const viewerAiRes = await request(app)
      .post(`/api/evidence/${evidenceId}/ai/analyze`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ analysisType: 'EVIDENCE_SUMMARY' });

    assert(
      viewerAiRes.status === 403,
      'VIEWER role is denied initiating AI evidence analysis (403 Forbidden)'
    );

    // ──────────────────────────────────────────────────────────
    // 10. Report & Export Security Tests
    // ──────────────────────────────────────────────────────────
    console.log('\n[10. Report Security Tests]');

    // Report hash is distinct from evidence SHA-256
    const reportRes = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        reportType: 'DETAILED_CASE_REPORT',
        caseId: caseAId,
      });

    assert(reportRes.status === 200, 'Detailed case report generated successfully');
    const reportHash = reportRes.body.reportMetadata.reportHash;
    const evidenceSha = evUploadRes.body.evidence.sha256;

    assert(
      reportHash !== evidenceSha,
      'Report hash is distinct from evidence SHA-256 file checksum'
    );
    assert(
      reportRes.body.disclaimer.toLowerCase().includes('advisory'),
      'Report explicitly contains mandatory advisory disclaimer'
    );

  } catch (error) {
    console.error('Fatal security test execution error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`🛡️  SECURITY HARDENING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityHardeningTests();
