import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test suite for Milestone 5: Case Management.
 * Tests Case lifecycle, RBAC, Status History audit trail, Member management,
 * and security boundaries across all system roles.
 */
async function runCaseTests() {
  console.log('====================================================');
  console.log('📁 RUNNING MILESTONE 5: CASE MANAGEMENT TEST SUITE');
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
  let testCaseNumber = '';

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated accounts for all 4 roles
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `case.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

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

    // ----------------------------------------------------
    // Phase 1: CREATE CASE TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 1: Create Case Tests]');

    // 1. ADMIN can create case
    const adminCreateRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Suspected Advanced Persistent Threat Intrusion',
        description: 'Lateral movement detected in segment B.',
        caseType: 'CYBERSECURITY_INCIDENT',
        category: 'NETWORK_SECURITY',
        severity: 'CRITICAL',
        priority: 'HIGH',
        confidentiality: 'RESTRICTED',
        tags: ['apt', 'lateral-movement', 'critical'],
        leadInvestigatorId: userIds['INVESTIGATOR'],
      });

    assert(
      adminCreateRes.status === 201 &&
        adminCreateRes.body.case &&
        adminCreateRes.body.case.status === 'OPEN' &&
        adminCreateRes.body.case.caseNumber.startsWith('CASE-') &&
        adminCreateRes.body.case.createdBy.id === userIds['ADMIN'],
      'ADMIN can create case with auto-generated caseNumber and initial status OPEN',
      adminCreateRes.body
    );

    testCaseId = adminCreateRes.body.case.id;
    testCaseNumber = adminCreateRes.body.case.caseNumber;

    // 2. INVESTIGATOR can create case
    const invCreateRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        title: 'Corporate Spear Phishing Campaign',
        description: 'Multiple employees received malicious invoice attachments.',
        caseType: 'PHISHING',
        category: 'EMAIL_SECURITY',
        severity: 'HIGH',
        priority: 'MEDIUM',
        tags: ['phishing', 'finance'],
      });

    assert(
      invCreateRes.status === 201 &&
        invCreateRes.body.case.caseNumber.startsWith('CASE-') &&
        invCreateRes.body.case.createdBy.id === userIds['INVESTIGATOR'],
      'INVESTIGATOR can create case',
      invCreateRes.body
    );

    // 3. ANALYST cannot create case (403)
    const anaCreateRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Unauthorized Case by Analyst',
      });
    assert(
      anaCreateRes.status === 403 && anaCreateRes.body.error === 'Forbidden',
      'ANALYST cannot create case (403 Forbidden)',
      anaCreateRes.body
    );

    // 4. VIEWER cannot create case (403)
    const viewCreateRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Unauthorized Case by Viewer',
      });
    assert(
      viewCreateRes.status === 403 && viewCreateRes.body.error === 'Forbidden',
      'VIEWER cannot create case (403 Forbidden)',
      viewCreateRes.body
    );

    // 5. Unauthenticated request rejected (401)
    const noAuthCreateRes = await request(app)
      .post('/api/cases')
      .send({ title: 'Unauthenticated Case' });
    assert(
      noAuthCreateRes.status === 401 && noAuthCreateRes.body.error === 'Unauthorized',
      'Unauthenticated request returns 401 Unauthorized',
      noAuthCreateRes.body
    );

    // 6. Invalid input validation (title too short)
    const invalidInputRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({ title: 'No' });
    assert(
      invalidInputRes.status === 400 && invalidInputRes.body.error === 'Validation failed',
      'Invalid input rejected with 400 Bad Request',
      invalidInputRes.body
    );

    // 7. Client spoofing createdById or status rejected by strict schema
    const spoofAttemptRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        title: 'Tampering Attempt Case',
        createdById: userIds['ADMIN'],
        status: 'CLOSED',
      });
    assert(
      spoofAttemptRes.status === 400 && spoofAttemptRes.body.error === 'Validation failed',
      'Client cannot spoof createdById or status (400 Bad Request)',
      spoofAttemptRes.body
    );

    // ----------------------------------------------------
    // Phase 2: LIST CASES TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 2: List Cases Tests]');

    // ADMIN can list
    const adminListRes = await request(app)
      .get('/api/cases')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      adminListRes.status === 200 &&
        Array.isArray(adminListRes.body.data) &&
        adminListRes.body.pagination &&
        adminListRes.body.pagination.total >= 2,
      'ADMIN can list cases with pagination metadata',
      adminListRes.body.pagination
    );

    // INVESTIGATOR can list
    const invListRes = await request(app)
      .get('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invListRes.status === 200, 'INVESTIGATOR can list cases');

    // ANALYST can list
    const anaListRes = await request(app)
      .get('/api/cases')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(anaListRes.status === 200, 'ANALYST can list cases');

    // VIEWER can list
    const viewListRes = await request(app)
      .get('/api/cases')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(viewListRes.status === 200, 'VIEWER can list cases');

    // Filtering by status
    const filterRes = await request(app)
      .get('/api/cases?status=OPEN')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      filterRes.status === 200 &&
        filterRes.body.data.every((c: { status: string }) => c.status === 'OPEN'),
      'Filtering by status=OPEN returns matching records only'
    );

    // Search query
    const searchRes = await request(app)
      .get(`/api/cases?search=${testCaseNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      searchRes.status === 200 &&
        searchRes.body.data.length >= 1 &&
        searchRes.body.data[0].caseNumber === testCaseNumber,
      'Search by caseNumber returns matching case'
    );

    // ----------------------------------------------------
    // Phase 3: GET CASE BY ID TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 3: Get Case by ID Tests]');

    const getCaseRes = await request(app)
      .get(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      getCaseRes.status === 200 &&
        getCaseRes.body.id === testCaseId &&
        getCaseRes.body.createdBy.id === userIds['ADMIN'] &&
        getCaseRes.body.statusHistory.length >= 1 &&
        getCaseRes.body.statusHistory[0].newStatus === 'OPEN' &&
        getCaseRes.body.members.length >= 1 &&
        getCaseRes.body.members[0].role === 'LEAD_INVESTIGATOR',
      'GET /api/cases/:id returns case details, creator, members, and initial status history',
      getCaseRes.body
    );

    // Invalid UUID format
    const badIdRes = await request(app)
      .get('/api/cases/not-a-valid-uuid')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      badIdRes.status === 400 && badIdRes.body.error === 'Invalid parameter',
      'Invalid UUID format handled safely with 400 Bad Request',
      badIdRes.body
    );

    // Non-existent UUID
    const notFoundRes = await request(app)
      .get('/api/cases/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      notFoundRes.status === 404 && notFoundRes.body.error === 'Case not found',
      'Non-existent case ID returns 404 Not Found',
      notFoundRes.body
    );

    // ----------------------------------------------------
    // Phase 4: UPDATE CASE TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 4: Update Case Tests]');

    const updateRes = await request(app)
      .patch(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        description: 'Updated incident details after preliminary forensic triage.',
        priority: 'CRITICAL',
      });

    assert(
      updateRes.status === 200 &&
        updateRes.body.case.description === 'Updated incident details after preliminary forensic triage.' &&
        updateRes.body.case.priority === 'CRITICAL',
      'INVESTIGATOR can update case metadata',
      updateRes.body
    );

    // ANALYST cannot update
    const anaUpdateRes = await request(app)
      .patch(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Hacked Title' });
    assert(
      anaUpdateRes.status === 403 && anaUpdateRes.body.error === 'Forbidden',
      'ANALYST cannot update case (403 Forbidden)'
    );

    // VIEWER cannot update
    const viewUpdateRes = await request(app)
      .patch(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Hacked Title' });
    assert(
      viewUpdateRes.status === 403 && viewUpdateRes.body.error === 'Forbidden',
      'VIEWER cannot update case (403 Forbidden)'
    );

    // Protected fields cannot be modified via update
    const protectedUpdateRes = await request(app)
      .patch(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        caseNumber: 'CASE-TAMPERED-0000',
        createdById: userIds['VIEWER'],
      });
    assert(
      protectedUpdateRes.status === 400 && protectedUpdateRes.body.error === 'Validation failed',
      'Protected fields (caseNumber, createdById) cannot be updated via PATCH (400 Bad Request)'
    );

    // ----------------------------------------------------
    // Phase 5: CASE STATUS TRANSITION & AUDIT TRAIL TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 5: Status Transition & Audit Trail Tests]');

    // Transition: OPEN -> IN_PROGRESS
    const progressRes = await request(app)
      .patch(`/api/cases/${testCaseId}/status`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        status: 'IN_PROGRESS',
        reason: 'Forensic acquisition started.',
      });

    assert(
      progressRes.status === 200 && progressRes.body.case.status === 'IN_PROGRESS',
      'INVESTIGATOR transitions case status to IN_PROGRESS'
    );

    // Transition to CLOSED without reason should be rejected
    const closeNoReasonRes = await request(app)
      .patch(`/api/cases/${testCaseId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CLOSED',
      });

    assert(
      closeNoReasonRes.status === 400 && closeNoReasonRes.body.error === 'Validation failed',
      'Closing case without closure reason is rejected with 400 Bad Request',
      closeNoReasonRes.body
    );

    // Transition to CLOSED with reason
    const closeRes = await request(app)
      .patch(`/api/cases/${testCaseId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CLOSED',
        reason: 'Remediation completed and malicious artifacts purged.',
      });

    assert(
      closeRes.status === 200 &&
        closeRes.body.case.status === 'CLOSED' &&
        closeRes.body.case.closedAt !== null &&
        closeRes.body.case.closedBy.id === userIds['ADMIN'],
      'ADMIN transitions case to CLOSED with closure reason, closedAt, and closedBy recorded',
      closeRes.body
    );

    // Verify status history contains all transitions
    const verifyHistoryRes = await request(app)
      .get(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      verifyHistoryRes.body.statusHistory.length === 3 &&
        verifyHistoryRes.body.statusHistory[0].newStatus === 'CLOSED' &&
        verifyHistoryRes.body.statusHistory[1].newStatus === 'IN_PROGRESS' &&
        verifyHistoryRes.body.statusHistory[2].newStatus === 'OPEN',
      'CaseStatusHistory accurately audits entire status lifecycle: OPEN -> IN_PROGRESS -> CLOSED',
      verifyHistoryRes.body.statusHistory
    );

    // ANALYST and VIEWER cannot transition status
    const anaStatusRes = await request(app)
      .patch(`/api/cases/${testCaseId}/status`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ status: 'OPEN', reason: 'Reopening' });
    assert(anaStatusRes.status === 403, 'ANALYST cannot change case status (403 Forbidden)');

    const viewStatusRes = await request(app)
      .patch(`/api/cases/${testCaseId}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'OPEN', reason: 'Reopening' });
    assert(viewStatusRes.status === 403, 'VIEWER cannot change case status (403 Forbidden)');

    // ----------------------------------------------------
    // Phase 6: CASE MEMBERS MANAGEMENT TESTS
    // ----------------------------------------------------
    console.log('\n[Phase 6: Case Members Management Tests]');

    // Add ANALYST as member
    const addMemberRes = await request(app)
      .post(`/api/cases/${testCaseId}/members`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        userId: userIds['ANALYST'],
        role: 'ANALYST',
      });

    assert(
      addMemberRes.status === 201 &&
        addMemberRes.body.member.role === 'ANALYST' &&
        addMemberRes.body.member.user.id === userIds['ANALYST'],
      'INVESTIGATOR can assign ANALYST as case member',
      addMemberRes.body
    );

    // Duplicate membership rejected (409)
    const dupMemberRes = await request(app)
      .post(`/api/cases/${testCaseId}/members`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        userId: userIds['ANALYST'],
        role: 'ANALYST',
      });

    assert(
      dupMemberRes.status === 409 && dupMemberRes.body.error.includes('already assigned'),
      'Duplicate case membership rejected with 409 Conflict',
      dupMemberRes.body
    );

    // Role escalation prevention: VIEWER cannot be added as INVESTIGATOR
    const escalationRes = await request(app)
      .post(`/api/cases/${testCaseId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: userIds['VIEWER'],
        role: 'INVESTIGATOR',
      });

    assert(
      escalationRes.status === 400 && escalationRes.body.error.includes('cannot be assigned'),
      'Role escalation prevented: VIEWER system user cannot be added as INVESTIGATOR member',
      escalationRes.body
    );

    // Non-existent user rejected
    const badUserMemberRes = await request(app)
      .post(`/api/cases/${testCaseId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: '00000000-0000-0000-0000-000000000000',
        role: 'VIEWER',
      });

    assert(
      badUserMemberRes.status === 400,
      'Assigning non-existent user as member rejected with 400 Bad Request'
    );

    // ANALYST and VIEWER cannot manage members
    const anaMemberRes = await request(app)
      .post(`/api/cases/${testCaseId}/members`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ userId: userIds['VIEWER'], role: 'VIEWER' });
    assert(anaMemberRes.status === 403, 'ANALYST cannot add members (403 Forbidden)');

    // Removing lead investigator is prevented without reassigning
    const removeLeadRes = await request(app)
      .delete(`/api/cases/${testCaseId}/members/${userIds['INVESTIGATOR']}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      removeLeadRes.status === 400 && removeLeadRes.body.error.includes('lead investigator'),
      'Removing lead investigator is blocked with 400 Bad Request',
      removeLeadRes.body
    );

    // Remove ordinary member (ANALYST)
    const removeMemberRes = await request(app)
      .delete(`/api/cases/${testCaseId}/members/${userIds['ANALYST']}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      removeMemberRes.status === 200 &&
        removeMemberRes.body.message.includes('removed successfully'),
      'INVESTIGATOR can remove an ordinary case member',
      removeMemberRes.body
    );

    // ----------------------------------------------------
    // Phase 7: SECURITY & DATA PRIVACY CHECKS
    // ----------------------------------------------------
    console.log('\n[Phase 7: Security & Data Privacy Verification]');

    const finalCaseCheck = await request(app)
      .get(`/api/cases/${testCaseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const caseJson = JSON.stringify(finalCaseCheck.body);
    assert(
      !caseJson.includes('passwordHash') &&
        !caseJson.includes('password_hash') &&
        !caseJson.includes('jwtSecret'),
      'Case API responses strictly exclude passwordHash, passwords, and secrets'
    );

  } catch (err) {
    console.error('Unexpected test failure:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 CASE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCaseTests();
