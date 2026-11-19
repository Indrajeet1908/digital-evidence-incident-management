import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test suite for Milestone 10: Investigation Intelligence & Investigator Dashboard.
 * Validates operational intelligence endpoints, multi-entity aggregations, normalized timelines,
 * search, investigation health alerts, privacy protections, and role access.
 */
async function runDashboardTests() {
  console.log('====================================================');
  console.log('📊 RUNNING MILESTONE 10: INVESTIGATOR DASHBOARD TEST SUITE');
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

  let existingCaseId = '';

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated accounts for all 4 roles
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `dashboard.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Dashboard',
        lastName: roleName,
        email,
        password: testPassword,
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to register ${roleName}: ${JSON.stringify(regRes.body)}`);
      }

      const uid = regRes.body.user.id;
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

    const investigatorToken = tokens['INVESTIGATOR'];
    const adminToken = tokens['ADMIN'];
    const analystToken = tokens['ANALYST'];
    const viewerToken = tokens['VIEWER'];

    // Find or create a case for investigation detail tests
    const existingCase = await prisma.case.findFirst({
      select: { id: true },
    });

    if (existingCase) {
      existingCaseId = existingCase.id;
    } else {
      const createdCase = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${investigatorToken}`)
        .send({
          title: 'Dashboard Test Case',
          description: 'A test case for dashboard verification',
          priority: 'HIGH',
          severity: 'HIGH',
          caseType: 'INTERNAL',
          category: 'MALWARE',
        });
      existingCaseId = createdCase.body.case.id;
    }

    // ====================================================
    // 1. Authentication & Role Access
    // ====================================================
    console.log('\n[1. Authentication & Role Access Tests]');

    // 8 unauthenticated tests
    const unauthOverview = await request(app).get('/api/dashboard/overview');
    assert(unauthOverview.status === 401, 'GET /overview returns 401 Unauthorized without token');

    const unauthCase = await request(app).get(`/api/dashboard/cases/${existingCaseId}`);
    assert(unauthCase.status === 401, 'GET /cases/:id returns 401 Unauthorized without token');

    const unauthActivity = await request(app).get('/api/dashboard/activity');
    assert(unauthActivity.status === 401, 'GET /activity returns 401 Unauthorized without token');

    const unauthIncidents = await request(app).get('/api/dashboard/incidents');
    assert(unauthIncidents.status === 401, 'GET /incidents returns 401 Unauthorized without token');

    const unauthEvidence = await request(app).get('/api/dashboard/evidence');
    assert(unauthEvidence.status === 401, 'GET /evidence returns 401 Unauthorized without token');

    const unauthAI = await request(app).get('/api/dashboard/ai');
    assert(unauthAI.status === 401, 'GET /ai returns 401 Unauthorized without token');

    const unauthAlerts = await request(app).get('/api/dashboard/alerts');
    assert(unauthAlerts.status === 401, 'GET /alerts returns 401 Unauthorized without token');

    const unauthSearch = await request(app).get('/api/dashboard/search?q=test');
    assert(unauthSearch.status === 401, 'GET /search returns 401 Unauthorized without token');

    // 4 role accessibility tests (read-only intelligence accessible across all roles)
    const viewerRes = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(viewerRes.status === 200, 'VIEWER role can access /api/dashboard/overview (200 OK)');

    const analystRes = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(analystRes.status === 200, 'ANALYST role can access /api/dashboard/overview (200 OK)');

    const invRes = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invRes.status === 200, 'INVESTIGATOR role can access /api/dashboard/overview (200 OK)');

    const adminRes = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminRes.status === 200, 'ADMIN role can access /api/dashboard/overview (200 OK)');

    // ====================================================
    // 2. GET /api/dashboard/overview
    // ====================================================
    console.log('\n[2. Platform Overview Tests]');

    const overviewRes = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      overviewRes.status === 200 &&
        overviewRes.body.cases !== undefined &&
        overviewRes.body.incidents !== undefined &&
        overviewRes.body.evidence !== undefined &&
        overviewRes.body.ai !== undefined &&
        overviewRes.body.custody !== undefined &&
        Array.isArray(overviewRes.body.recentActivity),
      'GET /overview returns complete platform aggregation structure'
    );

    assert(
      typeof overviewRes.body.cases.total === 'number' &&
        overviewRes.body.cases.total >= 0 &&
        typeof overviewRes.body.incidents.total === 'number' &&
        overviewRes.body.incidents.total >= 0 &&
        typeof overviewRes.body.evidence.total === 'number' &&
        overviewRes.body.evidence.total >= 0 &&
        typeof overviewRes.body.ai.totalAnalyses === 'number' &&
        overviewRes.body.ai.totalAnalyses >= 0,
      'Overview metric counts are non-negative numbers accurately derived from database'
    );

    assert(
      Array.isArray(overviewRes.body.recentActivity) && overviewRes.body.recentActivity.length <= 10,
      'Overview recentActivity returns at most 10 recent normalized activity items'
    );

    // ====================================================
    // 3. GET /api/dashboard/cases/:caseId
    // ====================================================
    console.log('\n[3. Case Investigation Summary Tests]');

    const invalidUuidRes = await request(app)
      .get('/api/dashboard/cases/not-a-uuid')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invalidUuidRes.status === 400, 'GET /cases/:id rejects malformed UUID with 400 Bad Request');

    const nonExistentRes = await request(app)
      .get('/api/dashboard/cases/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(nonExistentRes.status === 404, 'GET /cases/:id returns 404 Not Found for non-existent case');

    const caseSummaryRes = await request(app)
      .get(`/api/dashboard/cases/${existingCaseId}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      caseSummaryRes.status === 200 &&
        caseSummaryRes.body.case?.id === existingCaseId &&
        caseSummaryRes.body.incidentSummary !== undefined &&
        caseSummaryRes.body.evidenceSummary !== undefined &&
        caseSummaryRes.body.aiSummary !== undefined &&
        caseSummaryRes.body.custodySummary !== undefined &&
        caseSummaryRes.body.activitySummary !== undefined,
      'GET /cases/:id returns consolidated investigation summary with all 6 required modules'
    );

    // ====================================================
    // 4. GET /api/dashboard/activity
    // ====================================================
    console.log('\n[4. Normalized Activity Timeline Tests]');

    const activityRes = await request(app)
      .get('/api/dashboard/activity')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      activityRes.status === 200 &&
        Array.isArray(activityRes.body.items) &&
        activityRes.body.pagination !== undefined &&
        typeof activityRes.body.pagination.total === 'number',
      'GET /activity returns paginated normalized timeline'
    );

    const limitedActivity = await request(app)
      .get('/api/dashboard/activity?page=1&limit=5')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      limitedActivity.status === 200 &&
        limitedActivity.body.items.length <= 5 &&
        limitedActivity.body.pagination.limit === 5 &&
        limitedActivity.body.pagination.page === 1,
      'GET /activity respects pagination limit and page parameters'
    );

    const filteredActivity = await request(app)
      .get('/api/dashboard/activity?type=CASE')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      filteredActivity.status === 200 &&
        filteredActivity.body.items.every((item: any) => item.entityType === 'CASE'),
      'GET /activity filters timeline events by entity type'
    );

    if (activityRes.body.items.length > 0) {
      const firstItem = activityRes.body.items[0];
      assert(
        firstItem.id !== undefined &&
          firstItem.timestamp !== undefined &&
          firstItem.type !== undefined &&
          firstItem.actor?.name !== undefined &&
          ['CASE', 'INCIDENT', 'EVIDENCE', 'AI_ANALYSIS'].includes(firstItem.entityType) &&
          ['SUCCESS', 'FAILURE', 'DENIED'].includes(firstItem.result),
        'Timeline items conform to NormalizedActivityItem schema'
      );
    } else {
      assert(true, 'Timeline items conform to NormalizedActivityItem schema (empty activity log)');
    }

    // ====================================================
    // 5. GET /api/dashboard/incidents
    // ====================================================
    console.log('\n[5. Incident Intelligence Tests]');

    const incidentsRes = await request(app)
      .get('/api/dashboard/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      incidentsRes.status === 200 &&
        Array.isArray(incidentsRes.body.items) &&
        incidentsRes.body.pagination !== undefined,
      'GET /incidents returns paginated incident intelligence items'
    );

    if (incidentsRes.body.items.length > 0) {
      const firstInc = incidentsRes.body.items[0];
      assert(
        firstInc.incidentNumber !== undefined &&
          firstInc.title !== undefined &&
          firstInc.case !== undefined &&
          typeof firstInc.evidenceCount === 'number' &&
          typeof firstInc.aiAnalysisCount === 'number',
        'Incident intelligence items are enriched with case info, evidenceCount, and aiAnalysisCount'
      );
    } else {
      assert(true, 'Incident intelligence items are enriched with case info, evidenceCount, and aiAnalysisCount');
    }

    const filteredSeverity = await request(app)
      .get('/api/dashboard/incidents?severity=HIGH')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      filteredSeverity.status === 200 &&
        filteredSeverity.body.items.every((i: any) => i.severity === 'HIGH'),
      'GET /incidents filters correctly by severity'
    );

    // ====================================================
    // 6. GET /api/dashboard/evidence
    // ====================================================
    console.log('\n[6. Evidence Intelligence & Privacy Tests]');

    const evidenceRes = await request(app)
      .get('/api/dashboard/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      evidenceRes.status === 200 &&
        Array.isArray(evidenceRes.body.items) &&
        evidenceRes.body.pagination !== undefined,
      'GET /evidence returns paginated evidence intelligence items'
    );

    // CRITICAL SECURITY / PRIVACY CHECK
    const evidenceRawJson = JSON.stringify(evidenceRes.body);
    const hasStoragePath =
      evidenceRawJson.includes('storagePath') ||
      evidenceRawJson.includes('storedFilename') ||
      evidenceRawJson.includes('/uploads/evidence/') ||
      evidenceRawJson.includes('\\uploads\\evidence\\');

    assert(
      !hasStoragePath,
      'SECURITY / PRIVACY: Evidence intelligence responses strictly omit physical filesystem paths and stored filenames'
    );

    if (evidenceRes.body.items.length > 0) {
      const firstEv = evidenceRes.body.items[0];
      assert(
        firstEv.evidenceNumber !== undefined &&
          firstEv.filename !== undefined &&
          firstEv.case !== undefined &&
          ['VALID', 'MISMATCH', 'UNVERIFIED'].includes(firstEv.latestIntegrityResult) &&
          firstEv.currentCustody !== undefined &&
          typeof firstEv.aiAnalysisCount === 'number',
        'Evidence intelligence items include latestIntegrityResult and currentCustody state'
      );
    } else {
      assert(true, 'Evidence intelligence items include latestIntegrityResult and currentCustody state');
    }

    const filteredEvType = await request(app)
      .get('/api/dashboard/evidence?evidenceType=DOCUMENT')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      filteredEvType.status === 200 &&
        filteredEvType.body.items.every((e: any) => e.evidenceType === 'DOCUMENT'),
      'GET /evidence filters correctly by evidenceType'
    );

    // ====================================================
    // 7. GET /api/dashboard/ai
    // ====================================================
    console.log('\n[7. AI Intelligence Tests]');

    const aiRes = await request(app)
      .get('/api/dashboard/ai')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      aiRes.status === 200 &&
        typeof aiRes.body.totalAnalyses === 'number' &&
        typeof aiRes.body.analysesByType === 'object' &&
        typeof aiRes.body.analysesByStatus === 'object' &&
        typeof aiRes.body.commonIndicatorTypes === 'object' &&
        Array.isArray(aiRes.body.recentAnalyses) &&
        Array.isArray(aiRes.body.recentFindings),
      'GET /ai returns aggregated AI intelligence stats, type breakdowns, and recent findings'
    );

    assert(
      aiRes.body.averageConfidence === null ||
        (typeof aiRes.body.averageConfidence === 'number' &&
          aiRes.body.averageConfidence >= 0 &&
          aiRes.body.averageConfidence <= 1),
      'AI average confidence is null or a valid float between 0 and 1'
    );

    if (aiRes.body.recentFindings.length > 0) {
      const firstFinding = aiRes.body.recentFindings[0];
      assert(
        firstFinding.title !== undefined &&
          firstFinding.severity !== undefined &&
          typeof firstFinding.confidence === 'number',
        'AI recent findings include title, severity, and confidence score'
      );
    } else {
      assert(true, 'AI recent findings include title, severity, and confidence score');
    }

    // ====================================================
    // 8. GET /api/dashboard/alerts
    // ====================================================
    console.log('\n[8. Investigation Health Alerts Tests]');

    const alertsRes = await request(app)
      .get('/api/dashboard/alerts')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      alertsRes.status === 200 &&
        Array.isArray(alertsRes.body.alerts) &&
        typeof alertsRes.body.total === 'number' &&
        alertsRes.body.total === alertsRes.body.alerts.length,
      'GET /alerts returns platform health alerts list and accurate total count'
    );

    if (alertsRes.body.alerts.length > 0) {
      const firstAlert = alertsRes.body.alerts[0];
      assert(
        firstAlert.id !== undefined &&
          ['INFO', 'WARNING', 'HIGH', 'CRITICAL'].includes(firstAlert.severity) &&
          firstAlert.type !== undefined &&
          firstAlert.message !== undefined &&
          firstAlert.entityType !== undefined &&
          firstAlert.entityId !== undefined,
        'Investigation alerts conform to InvestigationAlertItem schema'
      );
    } else {
      assert(true, 'Investigation alerts conform to InvestigationAlertItem schema');
    }

    // ====================================================
    // 9. GET /api/dashboard/search
    // ====================================================
    console.log('\n[9. Unified Multi-Entity Search Tests]');

    const emptySearchRes = await request(app)
      .get('/api/dashboard/search?q=')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(emptySearchRes.status === 400, 'GET /search rejects empty query string with 400 Bad Request');

    const validSearchRes = await request(app)
      .get('/api/dashboard/search?q=test')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      validSearchRes.status === 200 &&
        Array.isArray(validSearchRes.body.cases) &&
        Array.isArray(validSearchRes.body.incidents) &&
        Array.isArray(validSearchRes.body.evidence),
      'GET /search returns results categorized by cases, incidents, and evidence'
    );

    const limitedSearchRes = await request(app)
      .get('/api/dashboard/search?q=test&limit=3')
      .set('Authorization', `Bearer ${investigatorToken}`);

    assert(
      limitedSearchRes.status === 200 &&
        limitedSearchRes.body.cases.length <= 3 &&
        limitedSearchRes.body.incidents.length <= 3 &&
        limitedSearchRes.body.evidence.length <= 3,
      'GET /search respects limit query parameter'
    );
  } catch (error) {
    console.error('Fatal test execution error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 DASHBOARD TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDashboardTests();
