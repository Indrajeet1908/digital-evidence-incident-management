import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test suite for Milestone 6: Incident Management.
 * Tests Incident lifecycle, Case associations, RBAC, Status History audit trail,
 * server-side numbering, and security boundaries.
 */
async function runIncidentTests() {
  console.log('====================================================');
  console.log('🚨 RUNNING MILESTONE 6: INCIDENT MANAGEMENT TEST SUITE');
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

  let parentCaseId = '';
  let testIncidentId = '';
  let testIncidentNumber = '';

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated accounts for all 4 roles
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `inc.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

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
    const investigatorToken = tokens['INVESTIGATOR']!;
    const analystToken = tokens['ANALYST']!;
    const viewerToken = tokens['VIEWER']!;

    // Create a parent Case for incident testing
    console.log('[Setup: Creating parent Case]');
    const caseRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        title: 'Operation Red Dawn Investigation',
        description: 'Case container for multiple interrelated incidents.',
        severity: 'HIGH',
        priority: 'HIGH',
      });

    if (caseRes.status !== 201) {
      throw new Error(`Failed to create test case: ${JSON.stringify(caseRes.body)}`);
    }
    parentCaseId = caseRes.body.case.id;

    // ----------------------------------------------------
    // Phase 1: CREATE INCIDENT TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 1: Create Incident Tests]');

    // 1. ADMIN can create incident
    const adminCreateRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        caseId: parentCaseId,
        title: 'Executive Phishing Lure Detected',
        description: 'Spear-phishing email targeting CFO credentials.',
        incidentType: 'PHISHING',
        category: 'EMAIL_SECURITY',
        severity: 'HIGH',
        priority: 'HIGH',
        source: 'EMAIL',
        assignedToId: userIds['INVESTIGATOR'],
      });

    assert(
      adminCreateRes.status === 201 &&
        adminCreateRes.body.incident &&
        adminCreateRes.body.incident.status === 'OPEN' &&
        adminCreateRes.body.incident.incidentNumber.startsWith('INC-') &&
        adminCreateRes.body.incident.createdBy.id === userIds['ADMIN'] &&
        adminCreateRes.body.incident.case.id === parentCaseId,
      'ADMIN can create incident with server-generated incidentNumber, linked Case, and initial status OPEN',
      adminCreateRes.body
    );

    testIncidentId = adminCreateRes.body.incident.id;
    testIncidentNumber = adminCreateRes.body.incident.incidentNumber;

    // 2. INVESTIGATOR can create incident
    const invCreateRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: parentCaseId,
        title: 'Workstation Ransomware Payload Execution',
        description: 'Endpoint detected lockbit artifact in temporary folder.',
        incidentType: 'MALWARE',
        category: 'ENDPOINT_SECURITY',
        severity: 'CRITICAL',
        priority: 'HIGH',
        source: 'EDR',
      });

    assert(
      invCreateRes.status === 201 &&
        invCreateRes.body.incident.incidentNumber.startsWith('INC-') &&
        invCreateRes.body.incident.createdBy.id === userIds['INVESTIGATOR'],
      'INVESTIGATOR can create incident',
      invCreateRes.body
    );

    // 3. ANALYST cannot create incident (403)
    const anaCreateRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        caseId: parentCaseId,
        title: 'Unauthorized Incident by Analyst',
      });
    assert(
      anaCreateRes.status === 403 && anaCreateRes.body.error === 'Forbidden',
      'ANALYST cannot create incident (403 Forbidden)',
      anaCreateRes.body
    );

    // 4. VIEWER cannot create incident (403)
    const viewCreateRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        caseId: parentCaseId,
        title: 'Unauthorized Incident by Viewer',
      });
    assert(
      viewCreateRes.status === 403 && viewCreateRes.body.error === 'Forbidden',
      'VIEWER cannot create incident (403 Forbidden)',
      viewCreateRes.body
    );

    // 5. Unauthenticated request rejected (401)
    const noAuthCreateRes = await request(app)
      .post('/api/incidents')
      .send({ caseId: parentCaseId, title: 'Unauthenticated Incident' });
    assert(
      noAuthCreateRes.status === 401 && noAuthCreateRes.body.error === 'Unauthorized',
      'Unauthenticated request returns 401 Unauthorized',
      noAuthCreateRes.body
    );

    // 6. Invalid input validation (title too short)
    const invalidInputRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({ caseId: parentCaseId, title: 'No' });
    assert(
      invalidInputRes.status === 400 && invalidInputRes.body.error === 'Validation failed',
      'Invalid input rejected with 400 Bad Request',
      invalidInputRes.body
    );

    // 7. Non-existent case rejected (404)
    const fakeCaseRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: '00000000-0000-0000-0000-000000000000',
        title: 'Incident for Non-existent Case',
      });
    assert(
      fakeCaseRes.status === 404 && fakeCaseRes.body.error.includes('Case was not found'),
      'Non-existent Case rejected with 404 Not Found',
      fakeCaseRes.body
    );

    // 8. Client spoofing createdById, incidentNumber, or status rejected by strict schema
    const spoofAttemptRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: parentCaseId,
        title: 'Tampering Attempt Incident',
        createdById: userIds['ADMIN'],
        incidentNumber: 'INC-TAMPERED-0001',
        status: 'CLOSED',
      });
    assert(
      spoofAttemptRes.status === 400 && spoofAttemptRes.body.error === 'Validation failed',
      'Client cannot spoof createdById, incidentNumber, or status (400 Bad Request)',
      spoofAttemptRes.body
    );

    // 9. Invalid assignedToId rejected
    const badAssignedRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: parentCaseId,
        title: 'Bad Assignment Incident',
        assignedToId: '00000000-0000-0000-0000-000000000000',
      });
    assert(
      badAssignedRes.status === 400 && badAssignedRes.body.error.includes('Assigned user does not exist'),
      'Invalid assignedTo user rejected with 400 Bad Request',
      badAssignedRes.body
    );

    // ----------------------------------------------------
    // Phase 2: LIST INCIDENTS TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 2: List Incidents Tests]');

    // ADMIN can list
    const adminListRes = await request(app)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      adminListRes.status === 200 &&
        Array.isArray(adminListRes.body.data) &&
        adminListRes.body.pagination &&
        adminListRes.body.pagination.total >= 2,
      'ADMIN can list incidents with pagination metadata',
      adminListRes.body.pagination
    );

    // INVESTIGATOR can list
    const invListRes = await request(app)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invListRes.status === 200, 'INVESTIGATOR can list incidents');

    // ANALYST can list
    const anaListRes = await request(app)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(anaListRes.status === 200, 'ANALYST can list incidents');

    // VIEWER can list
    const viewListRes = await request(app)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(viewListRes.status === 200, 'VIEWER can list incidents');

    // Filter by caseId
    const caseFilterRes = await request(app)
      .get(`/api/incidents?caseId=${parentCaseId}`)
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(
      caseFilterRes.status === 200 &&
        caseFilterRes.body.data.every((inc: { caseId: string }) => inc.caseId === parentCaseId),
      'Filtering by caseId returns incidents belonging to that case only'
    );

    // Filter by status
    const statusFilterRes = await request(app)
      .get('/api/incidents?status=OPEN')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      statusFilterRes.status === 200 &&
        statusFilterRes.body.data.every((inc: { status: string }) => inc.status === 'OPEN'),
      'Filtering by status=OPEN returns matching incidents only'
    );

    // Filter by severity
    const sevFilterRes = await request(app)
      .get('/api/incidents?severity=HIGH')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      sevFilterRes.status === 200 &&
        sevFilterRes.body.data.every((inc: { severity: string }) => inc.severity === 'HIGH'),
      'Filtering by severity=HIGH returns matching incidents only'
    );

    // Search query
    const searchRes = await request(app)
      .get(`/api/incidents?search=${testIncidentNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      searchRes.status === 200 &&
        searchRes.body.data.length >= 1 &&
        searchRes.body.data[0].incidentNumber === testIncidentNumber,
      'Search by incidentNumber returns matching incident'
    );

    // ----------------------------------------------------
    // Phase 3: GET INCIDENT BY ID TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 3: Get Incident by ID Tests]');

    const getIncRes = await request(app)
      .get(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      getIncRes.status === 200 &&
        getIncRes.body.id === testIncidentId &&
        getIncRes.body.case.id === parentCaseId &&
        getIncRes.body.createdBy.id === userIds['ADMIN'] &&
        getIncRes.body.assignedTo.id === userIds['INVESTIGATOR'] &&
        getIncRes.body.statusHistory.length >= 1 &&
        getIncRes.body.statusHistory[0].newStatus === 'OPEN',
      'GET /api/incidents/:id returns incident details, linked Case, creator, assigned user, and status history',
      getIncRes.body
    );

    // Invalid UUID format
    const badIdRes = await request(app)
      .get('/api/incidents/not-a-valid-uuid')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      badIdRes.status === 400 && badIdRes.body.error === 'Invalid parameter',
      'Invalid UUID format handled safely with 400 Bad Request',
      badIdRes.body
    );

    // Non-existent UUID
    const notFoundRes = await request(app)
      .get('/api/incidents/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      notFoundRes.status === 404 && notFoundRes.body.error === 'Incident not found',
      'Non-existent incident ID returns 404 Not Found',
      notFoundRes.body
    );

    // ----------------------------------------------------
    // Phase 4: UPDATE INCIDENT TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 4: Update Incident Tests]');

    const updateRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        description: 'Triage complete: email headers indicate external malicious relay.',
        priority: 'CRITICAL',
      });

    assert(
      updateRes.status === 200 &&
        updateRes.body.incident.description === 'Triage complete: email headers indicate external malicious relay.' &&
        updateRes.body.incident.priority === 'CRITICAL',
      'INVESTIGATOR can update incident metadata',
      updateRes.body
    );

    // ANALYST cannot update
    const anaUpdateRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Hacked Title' });
    assert(
      anaUpdateRes.status === 403 && anaUpdateRes.body.error === 'Forbidden',
      'ANALYST cannot update incident (403 Forbidden)'
    );

    // VIEWER cannot update
    const viewUpdateRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Hacked Title' });
    assert(
      viewUpdateRes.status === 403 && viewUpdateRes.body.error === 'Forbidden',
      'VIEWER cannot update incident (403 Forbidden)'
    );

    // Protected fields cannot be modified via update
    const protectedUpdateRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        incidentNumber: 'INC-TAMPERED-0000',
        caseId: '00000000-0000-0000-0000-000000000000',
        createdById: userIds['VIEWER'],
      });
    assert(
      protectedUpdateRes.status === 400 && protectedUpdateRes.body.error === 'Validation failed',
      'Protected fields (incidentNumber, caseId, createdById) cannot be updated via PATCH (400 Bad Request)'
    );

    // ----------------------------------------------------
    // Phase 5: STATUS TRANSITION & AUDIT TRAIL TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 5: Status Transition & Audit Trail Tests]');

    // Transition: OPEN -> INVESTIGATING
    const investigatingRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}/status`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        status: 'INVESTIGATING',
        reason: 'Forensic analyst assigned to examine mail logs.',
      });

    assert(
      investigatingRes.status === 200 && investigatingRes.body.incident.status === 'INVESTIGATING',
      'INVESTIGATOR transitions incident status to INVESTIGATING'
    );

    // Transition: INVESTIGATING -> RESOLVED (sets resolvedAt server-side)
    const resolveRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}/status`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        status: 'RESOLVED',
        reason: 'Sender blocked on mail gateway and malicious link sinkholed.',
      });

    assert(
      resolveRes.status === 200 &&
        resolveRes.body.incident.status === 'RESOLVED' &&
        resolveRes.body.incident.resolvedAt !== null,
      'Transition to RESOLVED automatically timestamps resolvedAt server-side',
      resolveRes.body
    );

    // Transition to CLOSED without reason should be rejected
    const closeNoReasonRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CLOSED',
      });

    assert(
      closeNoReasonRes.status === 400 && closeNoReasonRes.body.error === 'Validation failed',
      'Closing incident without closure reason is rejected with 400 Bad Request',
      closeNoReasonRes.body
    );

    // Transition to CLOSED with reason
    const closeRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CLOSED',
        reason: 'All post-incident checks completed. No further action needed.',
      });

    assert(
      closeRes.status === 200 &&
        closeRes.body.incident.status === 'CLOSED',
      'ADMIN transitions incident to CLOSED with closure reason recorded',
      closeRes.body
    );

    // Verify status history contains all transitions
    const verifyHistoryRes = await request(app)
      .get(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      verifyHistoryRes.body.statusHistory.length === 4 &&
        verifyHistoryRes.body.statusHistory[0].newStatus === 'CLOSED' &&
        verifyHistoryRes.body.statusHistory[1].newStatus === 'RESOLVED' &&
        verifyHistoryRes.body.statusHistory[2].newStatus === 'INVESTIGATING' &&
        verifyHistoryRes.body.statusHistory[3].newStatus === 'OPEN',
      'IncidentStatusHistory accurately audits entire status lifecycle: OPEN -> INVESTIGATING -> RESOLVED -> CLOSED',
      verifyHistoryRes.body.statusHistory
    );

    // ANALYST and VIEWER cannot transition status
    const anaStatusRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}/status`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ status: 'OPEN', reason: 'Reopening' });
    assert(anaStatusRes.status === 403, 'ANALYST cannot change incident status (403 Forbidden)');

    const viewStatusRes = await request(app)
      .patch(`/api/incidents/${testIncidentId}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'OPEN', reason: 'Reopening' });
    assert(viewStatusRes.status === 403, 'VIEWER cannot change incident status (403 Forbidden)');

    // ----------------------------------------------------
    // Phase 6: SECURITY & PRIVACY CHECKS
    // ----------------------------------------------------
    console.log('\n[Phase 6: Security & Privacy Verification]');

    const finalIncidentCheck = await request(app)
      .get(`/api/incidents/${testIncidentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const incJson = JSON.stringify(finalIncidentCheck.body);
    assert(
      !incJson.includes('passwordHash') &&
        !incJson.includes('password_hash') &&
        !incJson.includes('jwtSecret'),
      'Incident API responses strictly exclude passwordHash, passwords, and secrets'
    );

  } catch (err) {
    console.error('Unexpected test failure:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 INCIDENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIncidentTests();
