import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import jwt from 'jsonwebtoken';
import config from '../src/config/environment';

/**
 * Automated test suite for Milestone 4: Role-Based Access Control (RBAC).
 *
 * Verifies the complete Role Permission Matrix across all four system roles:
 * - ADMIN
 * - INVESTIGATOR
 * - ANALYST
 * - VIEWER
 *
 * Also tests security boundaries: unauthenticated access, invalid tokens,
 * expired tokens, and client role spoofing / tampering attempts.
 */
async function runRbacTests() {
  console.log('====================================================');
  console.log('🛡️  RUNNING MILESTONE 4: RBAC AUTHORIZATION TEST SUITE');
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

  // Tokens for each test user role
  const tokens: Record<string, string> = {};
  const testPassword = 'StrongTestPassword123!';

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated users for each role
    // ----------------------------------------------------
    console.log('[Phase 1: Setting up role-based test accounts]');

    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      // 1. Register through the standard auth endpoint (starts as VIEWER)
      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Test',
        lastName: roleName,
        email,
        password: testPassword,
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to register user for role ${roleName}: ${JSON.stringify(regRes.body)}`);
      }

      const userId = regRes.body.user.id;

      // 2. If target role is not VIEWER, update roleId in database
      if (roleName !== 'VIEWER') {
        const dbRole = await prisma.role.findUnique({ where: { name: roleName } });
        if (!dbRole) {
          throw new Error(`Role ${roleName} not found in database`);
        }
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: dbRole.id },
        });
      }

      // 3. Log in to obtain genuine JWT token
      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: testPassword,
      });

      if (loginRes.status !== 200 || !loginRes.body.token) {
        throw new Error(`Failed to log in as ${roleName}: ${JSON.stringify(loginRes.body)}`);
      }

      tokens[roleName] = loginRes.body.token;
      console.log(`  Created and authenticated test user for role: ${roleName}`);
    }

    // ----------------------------------------------------
    // Phase 2: ADMIN Role Permission Tests
    // ADMIN can access: admin, investigator, analyst, viewer
    // ----------------------------------------------------
    console.log('\n[Phase 2: ADMIN Role Tests - Full Privilege]');
    const adminToken = tokens['ADMIN']!;

    const adminOnAdmin = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminOnAdmin.status === 200, 'ADMIN can access /api/rbac/admin (200 OK)');

    const adminOnInvestigator = await request(app)
      .get('/api/rbac/investigator')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminOnInvestigator.status === 200, 'ADMIN can access /api/rbac/investigator (200 OK)');

    const adminOnAnalyst = await request(app)
      .get('/api/rbac/analyst')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminOnAnalyst.status === 200, 'ADMIN can access /api/rbac/analyst (200 OK)');

    const adminOnViewer = await request(app)
      .get('/api/rbac/viewer')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminOnViewer.status === 200, 'ADMIN can access /api/rbac/viewer (200 OK)');

    // ----------------------------------------------------
    // Phase 3: INVESTIGATOR Role Permission Tests
    // INVESTIGATOR cannot access: admin (403)
    // INVESTIGATOR can access: investigator, analyst, viewer
    // ----------------------------------------------------
    console.log('\n[Phase 3: INVESTIGATOR Role Tests]');
    const investigatorToken = tokens['INVESTIGATOR']!;

    const invOnAdmin = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(
      invOnAdmin.status === 403 && invOnAdmin.body.error === 'Forbidden',
      'INVESTIGATOR cannot access /api/rbac/admin (403 Forbidden)',
      invOnAdmin.body
    );

    const invOnInvestigator = await request(app)
      .get('/api/rbac/investigator')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invOnInvestigator.status === 200, 'INVESTIGATOR can access /api/rbac/investigator (200 OK)');

    const invOnAnalyst = await request(app)
      .get('/api/rbac/analyst')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invOnAnalyst.status === 200, 'INVESTIGATOR can access /api/rbac/analyst (200 OK)');

    const invOnViewer = await request(app)
      .get('/api/rbac/viewer')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invOnViewer.status === 200, 'INVESTIGATOR can access /api/rbac/viewer (200 OK)');

    // ----------------------------------------------------
    // Phase 4: ANALYST Role Permission Tests
    // ANALYST cannot access: admin (403), investigator (403)
    // ANALYST can access: analyst, viewer
    // ----------------------------------------------------
    console.log('\n[Phase 4: ANALYST Role Tests]');
    const analystToken = tokens['ANALYST']!;

    const anaOnAdmin = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(
      anaOnAdmin.status === 403 && anaOnAdmin.body.error === 'Forbidden',
      'ANALYST cannot access /api/rbac/admin (403 Forbidden)',
      anaOnAdmin.body
    );

    const anaOnInvestigator = await request(app)
      .get('/api/rbac/investigator')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(
      anaOnInvestigator.status === 403 && anaOnInvestigator.body.error === 'Forbidden',
      'ANALYST cannot access /api/rbac/investigator (403 Forbidden)',
      anaOnInvestigator.body
    );

    const anaOnAnalyst = await request(app)
      .get('/api/rbac/analyst')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(anaOnAnalyst.status === 200, 'ANALYST can access /api/rbac/analyst (200 OK)');

    const anaOnViewer = await request(app)
      .get('/api/rbac/viewer')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(anaOnViewer.status === 200, 'ANALYST can access /api/rbac/viewer (200 OK)');

    // ----------------------------------------------------
    // Phase 5: VIEWER Role Permission Tests
    // VIEWER cannot access: admin (403), investigator (403), analyst (403)
    // VIEWER can access: viewer (200)
    // ----------------------------------------------------
    console.log('\n[Phase 5: VIEWER Role Tests - Least Privilege]');
    const viewerToken = tokens['VIEWER']!;

    const viewOnAdmin = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      viewOnAdmin.status === 403 && viewOnAdmin.body.error === 'Forbidden',
      'VIEWER cannot access /api/rbac/admin (403 Forbidden)',
      viewOnAdmin.body
    );

    const viewOnInvestigator = await request(app)
      .get('/api/rbac/investigator')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      viewOnInvestigator.status === 403 && viewOnInvestigator.body.error === 'Forbidden',
      'VIEWER cannot access /api/rbac/investigator (403 Forbidden)',
      viewOnInvestigator.body
    );

    const viewOnAnalyst = await request(app)
      .get('/api/rbac/analyst')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      viewOnAnalyst.status === 403 && viewOnAnalyst.body.error === 'Forbidden',
      'VIEWER cannot access /api/rbac/analyst (403 Forbidden)',
      viewOnAnalyst.body
    );

    const viewOnViewer = await request(app)
      .get('/api/rbac/viewer')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(viewOnViewer.status === 200, 'VIEWER can access /api/rbac/viewer (200 OK)');

    // ----------------------------------------------------
    // Phase 6: Unauthenticated & Malformed Token Boundary Tests
    // ----------------------------------------------------
    console.log('\n[Phase 6: Unauthenticated & Malformed Token Tests]');

    const noAuthRes = await request(app).get('/api/rbac/admin');
    assert(
      noAuthRes.status === 401 && noAuthRes.body.error === 'Unauthorized',
      'Missing JWT returns 401 Unauthorized',
      noAuthRes.body
    );

    const invalidAuthRes = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', 'Bearer invalid.token.value');
    assert(
      invalidAuthRes.status === 401 && invalidAuthRes.body.error === 'Unauthorized',
      'Invalid JWT returns 401 Unauthorized',
      invalidAuthRes.body
    );

    // Expired JWT test
    const expiredToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000000', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: -10 } // Already expired 10 seconds ago
    );
    const expiredAuthRes = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert(
      expiredAuthRes.status === 401 &&
        expiredAuthRes.body.error === 'Unauthorized' &&
        expiredAuthRes.body.message.includes('expired'),
      'Expired JWT returns 401 Unauthorized with expired message',
      expiredAuthRes.body
    );

    // ----------------------------------------------------
    // Phase 7: Client-Side Role Tampering Prevention Tests
    // ----------------------------------------------------
    console.log('\n[Phase 7: Role Spoofing / Tampering Prevention Tests]');

    // VIEWER attempts to access /api/rbac/admin with query param ?role=ADMIN
    const queryTamperRes = await request(app)
      .get('/api/rbac/admin?role=ADMIN')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      queryTamperRes.status === 403 && queryTamperRes.body.error === 'Forbidden',
      'VIEWER cannot spoof role via query parameters (?role=ADMIN) -> 403 Forbidden',
      queryTamperRes.body
    );

    // VIEWER attempts to access /api/rbac/admin with custom headers
    const headerTamperRes = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-User-Role', 'ADMIN')
      .set('Role', 'ADMIN');
    assert(
      headerTamperRes.status === 403 && headerTamperRes.body.error === 'Forbidden',
      'VIEWER cannot spoof role via custom request headers -> 403 Forbidden',
      headerTamperRes.body
    );

    // VIEWER attempts to access /api/rbac/admin sending a body payload { "role": "ADMIN" }
    const bodyTamperRes = await request(app)
      .get('/api/rbac/admin')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ role: 'ADMIN' });
    assert(
      bodyTamperRes.status === 403 && bodyTamperRes.body.error === 'Forbidden',
      'VIEWER cannot spoof role via request body { "role": "ADMIN" } -> 403 Forbidden',
      bodyTamperRes.body
    );

  } catch (err) {
    console.error('Unexpected test failure:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 RBAC TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRbacTests();
