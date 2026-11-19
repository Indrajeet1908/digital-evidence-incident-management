import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test suite for M14 Integration Fixes:
 * 1. Normalization of collection responses and direct objects.
 * 2. Incident detail relations (evidence, aiAnalyses) inclusion without leaking storagePath.
 * 3. Global search returns cases, incidents, and evidence.
 * 4. 401 Expired/invalid session detection.
 * 5. Viewer restrictions vs Admin authority.
 */
async function runIntegrationFixTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING M14 INTEGRATION FIXES TEST SUITE');
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

  try {
    // ----------------------------------------------------
    // Setup: Create test accounts
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `fix.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'FixTest',
        lastName: roleName,
        email,
        password: testPassword,
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to create test user ${email}: ${JSON.stringify(regRes.body)}`);
      }

      // Promote to required role
      const user = await prisma.user.findUnique({ where: { email } });
      const targetRole = await prisma.role.findUnique({ where: { name: roleName } });
      if (user && targetRole) {
        await prisma.user.update({
          where: { id: user.id },
          data: { roleId: targetRole.id },
        });
      }

      // Log in
      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: testPassword,
      });

      tokens[roleName] = loginRes.body.token;
    }

    // ----------------------------------------------------
    // 1. Paginated Collection Responses Structure
    // ----------------------------------------------------
    console.log('\n[1. Paginated Collection Endpoints Response Contract]');

    const casesRes = await request(app)
      .get('/api/cases?limit=5')
      .set('Authorization', `Bearer ${tokens.INVESTIGATOR}`);

    assert(casesRes.status === 200, 'GET /api/cases returns 200 OK');
    assert(Array.isArray(casesRes.body.data), 'GET /api/cases returns array under "data" property');
    assert(Boolean(casesRes.body.pagination), 'GET /api/cases includes pagination metadata');

    const incRes = await request(app)
      .get('/api/incidents?limit=5')
      .set('Authorization', `Bearer ${tokens.INVESTIGATOR}`);

    assert(incRes.status === 200, 'GET /api/incidents returns 200 OK');
    assert(Array.isArray(incRes.body.data), 'GET /api/incidents returns array under "data" property');
    assert(Boolean(incRes.body.pagination), 'GET /api/incidents includes pagination metadata');

    const evRes = await request(app)
      .get('/api/evidence?limit=5')
      .set('Authorization', `Bearer ${tokens.INVESTIGATOR}`);

    assert(evRes.status === 200, 'GET /api/evidence returns 200 OK');
    assert(Array.isArray(evRes.body.data), 'GET /api/evidence returns array under "data" property');
    assert(Boolean(evRes.body.pagination), 'GET /api/evidence includes pagination metadata');

    // ----------------------------------------------------
    // 2. Incident Detail Retrieval with Safe Relations
    // ----------------------------------------------------
    console.log('\n[2. Incident Detail Retrieval & Safe Relations]');

    // Find any existing incident
    const anyIncident = await prisma.incident.findFirst({
      select: { id: true, incidentNumber: true, title: true, caseId: true },
    });

    if (anyIncident) {
      const detailRes = await request(app)
        .get(`/api/incidents/${anyIncident.id}`)
        .set('Authorization', `Bearer ${tokens.INVESTIGATOR}`);

      assert(detailRes.status === 200, 'GET /api/incidents/:id returns 200 OK');
      assert(detailRes.body.id === anyIncident.id, 'Incident detail returns matching ID');
      assert(detailRes.body.incidentNumber === anyIncident.incidentNumber, 'Incident detail returns correct incidentNumber');
      assert(Array.isArray(detailRes.body.evidence), 'Incident detail includes "evidence" array');
      assert(Array.isArray(detailRes.body.aiAnalyses), 'Incident detail includes "aiAnalyses" array');
      assert(Array.isArray(detailRes.body.statusHistory), 'Incident detail includes "statusHistory" array');

      // Security check: ensure storagePath and password hashes are never exposed
      const jsonStr = JSON.stringify(detailRes.body);
      assert(!jsonStr.includes('storagePath'), 'Incident detail strictly omits storagePath');
      assert(!jsonStr.includes('storedFilename'), 'Incident detail strictly omits storedFilename');
      assert(!jsonStr.includes('passwordHash'), 'Incident detail strictly omits passwordHash');
    }

    // ----------------------------------------------------
    // 3. Global Unified Search Across Entities
    // ----------------------------------------------------
    console.log('\n[3. Global Unified Search]');

    const searchRes = await request(app)
      .get('/api/dashboard/search?q=2026')
      .set('Authorization', `Bearer ${tokens.INVESTIGATOR}`);

    assert(searchRes.status === 200, 'GET /api/dashboard/search returns 200 OK');
    assert(Array.isArray(searchRes.body.cases), 'Search results contain "cases" array');
    assert(Array.isArray(searchRes.body.incidents), 'Search results contain "incidents" array');
    assert(Array.isArray(searchRes.body.evidence), 'Search results contain "evidence" array');

    // ----------------------------------------------------
    // 4. Session Authentication & 401 Handling
    // ----------------------------------------------------
    console.log('\n[4. Authentication Expiration & 401 Detection]');

    const expiredTokenRes = await request(app)
      .get('/api/cases')
      .set('Authorization', 'Bearer invalid.or.expired.jwt.token');

    assert(expiredTokenRes.status === 401, 'Invalid/expired token returns 401 Unauthorized');
    assert(
      expiredTokenRes.body.error === 'Unauthorized' || expiredTokenRes.body.message !== undefined,
      '401 response returns clear error/message for client eviction'
    );

    const noTokenRes = await request(app).get('/api/cases');
    assert(noTokenRes.status === 401, 'Missing token returns 401 Unauthorized');

    // ----------------------------------------------------
    // 5. RBAC Enforcement (Viewer vs Admin)
    // ----------------------------------------------------
    console.log('\n[5. RBAC Enforcement]');

    // VIEWER can read
    const viewerReadRes = await request(app)
      .get('/api/cases')
      .set('Authorization', `Bearer ${tokens.VIEWER}`);
    assert(viewerReadRes.status === 200, 'VIEWER allowed read access to cases (200 OK)');

    // VIEWER denied case creation
    const viewerCreateCaseRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${tokens.VIEWER}`)
      .send({
        title: 'Unauthorized Case by Viewer',
      });
    assert(viewerCreateCaseRes.status === 403, 'VIEWER denied case creation (403 Forbidden)');

    // VIEWER denied incident creation
    const viewerCreateIncidentRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${tokens.VIEWER}`)
      .send({
        title: 'Unauthorized Incident by Viewer',
        caseId: anyIncident?.caseId,
      });
    assert(viewerCreateIncidentRes.status === 403, 'VIEWER denied incident creation (403 Forbidden)');

    // ADMIN authorized to access admin endpoints
    const adminRbacRes = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${tokens.ADMIN}`);
    assert(adminRbacRes.status === 200, 'ADMIN role verified on /api/rbac/admin (200 OK)');

    // VIEWER denied access to admin endpoint
    const viewerAdminRes = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${tokens.VIEWER}`);
    assert(viewerAdminRes.status === 403, 'VIEWER denied access to /api/rbac/admin (403 Forbidden)');
  } catch (err) {
    console.error('Fatal error during integration tests:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 M14 INTEGRATION FIXES SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrationFixTests().catch((err) => {
  console.error('Unhandled test rejection:', err);
  process.exit(1);
});
