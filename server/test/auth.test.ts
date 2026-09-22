import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test runner for Milestone 3: Authentication.
 * Tests all positive and negative test cases directly against the Express app and PostgreSQL.
 */
async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MILESTONE 3: AUTHENTICATION TEST SUITE');
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

  const testEmail = `investigator.test.${Date.now()}@evidence-platform.local`;
  const testPassword = 'SecurePassword123!';
  let authToken = '';
  let createdUserId = '';

  try {
    // ----------------------------------------------------
    // Test 1: Health Check and Database Connection
    // ----------------------------------------------------
    console.log('[Phase 1: Pre-flight Verification]');
    const healthRes = await request(app).get('/api/health');
    assert(
      healthRes.status === 200 &&
        healthRes.body.status === 'ok' &&
        healthRes.body.database === 'connected',
      'GET /api/health returns 200 with database: connected',
      healthRes.body
    );

    // ----------------------------------------------------
    // Test 2: Successful Registration
    // ----------------------------------------------------
    console.log('\n[Phase 2: Registration Tests]');
    const regRes = await request(app).post('/api/auth/register').send({
      firstName: 'Jane',
      lastName: 'Doe',
      email: testEmail,
      password: testPassword,
    });

    assert(
      regRes.status === 201 &&
        regRes.body.user &&
        regRes.body.user.email === testEmail.toLowerCase() &&
        regRes.body.user.role === 'VIEWER' &&
        regRes.body.user.isActive === true &&
        regRes.body.user.passwordHash === undefined &&
        regRes.body.user.password === undefined,
      'POST /api/auth/register succeeds, assigns VIEWER role, and does not expose passwordHash',
      regRes.body
    );

    createdUserId = regRes.body.user?.id;

    // ----------------------------------------------------
    // Test 3: Duplicate Email Registration
    // ----------------------------------------------------
    const dupRes = await request(app).post('/api/auth/register').send({
      firstName: 'Jane',
      lastName: 'Doe',
      email: testEmail,
      password: testPassword,
    });

    assert(
      dupRes.status === 409 &&
        typeof dupRes.body.error === 'string' &&
        dupRes.body.error.toLowerCase().includes('already exists'),
      'POST /api/auth/register rejects duplicate email with 409 Conflict',
      dupRes.body
    );

    // ----------------------------------------------------
    // Test 4: Client Attempting to Submit/Select Role
    // ----------------------------------------------------
    const roleInjectRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Hacker',
        lastName: 'Admin',
        email: `hacker.${Date.now()}@example.com`,
        password: testPassword,
        role: 'ADMIN',
      });

    assert(
      roleInjectRes.status === 400 &&
        roleInjectRes.body.error === 'Validation failed',
      'POST /api/auth/register rejects client-submitted role fields with 400 Bad Request',
      roleInjectRes.body
    );

    // ----------------------------------------------------
    // Test 5: Invalid Email Format
    // ----------------------------------------------------
    const invalidEmailRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email-address',
        password: testPassword,
      });

    assert(
      invalidEmailRes.status === 400 &&
        invalidEmailRes.body.error === 'Validation failed' &&
        Boolean(invalidEmailRes.body.details?.email),
      'POST /api/auth/register rejects invalid email format with 400 Bad Request',
      invalidEmailRes.body
    );

    // ----------------------------------------------------
    // Test 6: Weak Password (Missing uppercase, special char, length)
    // ----------------------------------------------------
    const weakPassRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: `weak.${Date.now()}@example.com`,
        password: 'weak',
      });

    assert(
      weakPassRes.status === 400 &&
        weakPassRes.body.error === 'Validation failed' &&
        Boolean(weakPassRes.body.details?.password),
      'POST /api/auth/register rejects weak password with 400 Bad Request',
      weakPassRes.body
    );

    // ----------------------------------------------------
    // Test 7: Missing Required Fields
    // ----------------------------------------------------
    const missingFieldRes = await request(app)
      .post('/api/auth/register')
      .send({
        lastName: 'Doe',
        email: `missing.${Date.now()}@example.com`,
        password: testPassword,
      });

    assert(
      missingFieldRes.status === 400 &&
        missingFieldRes.body.error === 'Validation failed',
      'POST /api/auth/register rejects missing required fields with 400 Bad Request',
      missingFieldRes.body
    );

    // ----------------------------------------------------
    // Test 8: Successful Login
    // ----------------------------------------------------
    console.log('\n[Phase 3: Login Tests]');
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    assert(
      loginRes.status === 200 &&
        typeof loginRes.body.token === 'string' &&
        loginRes.body.token.length > 20 &&
        loginRes.body.user?.email === testEmail.toLowerCase() &&
        loginRes.body.user?.passwordHash === undefined,
      'POST /api/auth/login succeeds and returns valid JWT token and safe user profile',
      loginRes.body
    );

    authToken = loginRes.body.token;

    // ----------------------------------------------------
    // Test 9: Login with Invalid Password
    // ----------------------------------------------------
    const wrongPassRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword999!',
    });

    assert(
      wrongPassRes.status === 401 &&
        wrongPassRes.body.error === 'Invalid email or password',
      'POST /api/auth/login rejects wrong password with generic 401 message',
      wrongPassRes.body
    );

    // ----------------------------------------------------
    // Test 10: Login with Non-Existent Email
    // ----------------------------------------------------
    const nonExistentRes = await request(app).post('/api/auth/login').send({
      email: `doesnotexist.${Date.now()}@example.com`,
      password: testPassword,
    });

    assert(
      nonExistentRes.status === 401 &&
        nonExistentRes.body.error === 'Invalid email or password',
      'POST /api/auth/login rejects non-existent email with identical generic 401 message (no user enumeration)',
      nonExistentRes.body
    );

    // ----------------------------------------------------
    // Test 11: Protected /api/auth/me without Token
    // ----------------------------------------------------
    console.log('\n[Phase 4: JWT Middleware & /api/auth/me Tests]');
    const noTokenRes = await request(app).get('/api/auth/me');

    assert(
      noTokenRes.status === 401 && noTokenRes.body.error === 'Unauthorized',
      'GET /api/auth/me rejects request missing Authorization header with 401',
      noTokenRes.body
    );

    // ----------------------------------------------------
    // Test 12: Protected /api/auth/me with Malformed/Invalid Token
    // ----------------------------------------------------
    const badTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.payload');

    assert(
      badTokenRes.status === 401 && badTokenRes.body.error === 'Unauthorized',
      'GET /api/auth/me rejects invalid JWT token with 401',
      badTokenRes.body
    );

    // ----------------------------------------------------
    // Test 13: Protected /api/auth/me with Valid Token
    // ----------------------------------------------------
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    assert(
      meRes.status === 200 &&
        meRes.body.id === createdUserId &&
        meRes.body.email === testEmail.toLowerCase() &&
        meRes.body.firstName === 'Jane' &&
        meRes.body.lastName === 'Doe' &&
        meRes.body.role === 'VIEWER' &&
        meRes.body.isActive === true &&
        meRes.body.passwordHash === undefined,
      'GET /api/auth/me returns authenticated user profile matching token',
      meRes.body
    );

    // ----------------------------------------------------
    // Test 14: Inactive User Authentication
    // ----------------------------------------------------
    console.log('\n[Phase 5: Inactive User Security Check]');
    // Temporarily deactivate the user in the database
    await prisma.user.update({
      where: { id: createdUserId },
      data: { isActive: false },
    });

    const inactiveLoginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    assert(
      inactiveLoginRes.status === 401 &&
        inactiveLoginRes.body.error === 'Invalid email or password',
      'POST /api/auth/login rejects deactivated user account with 401',
      inactiveLoginRes.body
    );

    const inactiveMeRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    assert(
      inactiveMeRes.status === 401 &&
        inactiveMeRes.body.error === 'Unauthorized',
      'GET /api/auth/me rejects token belonging to deactivated user with 401',
      inactiveMeRes.body
    );

    // Re-activate user after test
    await prisma.user.update({
      where: { id: createdUserId },
      data: { isActive: true },
    });
  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    // Disconnect Prisma
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
