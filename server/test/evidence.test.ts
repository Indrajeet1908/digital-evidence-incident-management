import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test suite for Milestone 7: Digital Evidence Management.
 * Covers: Ingestion, Storage, SHA-256 Hashing, RBAC, Retrieval/Download,
 * Live Integrity Verification, Metadata Updates, and Security Bounds.
 */
async function runEvidenceTests() {
  console.log('====================================================');
  console.log('📦 RUNNING MILESTONE 7: EVIDENCE MANAGEMENT TEST SUITE');
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

  let case1Id = '';
  let case2Id = '';
  let incident1Id = '';
  let incident2Id = '';

  let createdEvidenceId = '';
  let createdEvidenceNumber = '';
  let createdEvidencePath = '';
  let testFileBuffer: Buffer;
  let expectedSha256: string;

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated accounts for all 4 roles
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = ['ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'] as const;

    for (const roleName of rolesList) {
      const email = `evd.test.${roleName.toLowerCase()}.${Date.now()}@evidence-platform.local`;

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

    // Setup: Create parent Cases & Incidents
    console.log('[Setup: Creating parent Cases and Incidents]');
    const case1Res = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        title: 'Project Alpha Evidence Vault',
        description: 'Primary container for digital evidence.',
        severity: 'HIGH',
      });
    case1Id = case1Res.body.case.id;

    const case2Res = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        title: 'Project Beta Unrelated Case',
        description: 'Separate container for cross-case validation.',
        severity: 'LOW',
      });
    case2Id = case2Res.body.case.id;

    const inc1Res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: case1Id,
        title: 'Workstation Ransomware Incursion',
        incidentType: 'MALWARE',
        severity: 'HIGH',
      });
    incident1Id = inc1Res.body.incident.id;

    const inc2Res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: case2Id,
        title: 'Beta Rogue Access Point',
        incidentType: 'NETWORK_ATTACK',
        severity: 'LOW',
      });
    incident2Id = inc2Res.body.incident.id;

    testFileBuffer = Buffer.from('FORENSIC_MEMORY_LOG_DUMP_SAMPLE_CONTENT_2026_SECURE_VERIFIED');
    expectedSha256 = crypto.createHash('sha256').update(testFileBuffer).digest('hex');

    // ----------------------------------------------------
    // Phase 1: Upload Evidence Tests
    // ----------------------------------------------------
    console.log('\n[Phase 1: Upload Evidence Tests]');

    // 1. ADMIN upload
    const adminUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('caseId', case1Id)
      .field('incidentId', incident1Id)
      .field('evidenceType', 'MEMORY_DUMP')
      .field('source', 'ENDPOINT')
      .field('description', 'RAM snapshot captured at T+0')
      .attach('file', testFileBuffer, 'workstation_ram.raw');

    assert(
      adminUploadRes.status === 201 &&
        adminUploadRes.body.evidence &&
        adminUploadRes.body.evidence.sha256 === expectedSha256 &&
        adminUploadRes.body.evidence.uploadedById === userIds['ADMIN'],
      'ADMIN can upload evidence with server-generated SHA-256 and metadata',
      adminUploadRes.body
    );

    createdEvidenceId = adminUploadRes.body.evidence.id;
    createdEvidenceNumber = adminUploadRes.body.evidence.evidenceNumber;

    // Retrieve storagePath from DB to verify server-side storage internals
    const dbRecord = await prisma.evidence.findUnique({
      where: { id: createdEvidenceId },
      select: { storagePath: true, storedFilename: true },
    });
    createdEvidencePath = dbRecord?.storagePath || '';

    assert(
      /^EVD-\d{4}-\d{4}$/.test(createdEvidenceNumber),
      'Evidence number is generated server-side in EVD-YYYY-XXXX format',
      createdEvidenceNumber
    );

    assert(
      Boolean(createdEvidencePath && fs.existsSync(createdEvidencePath)),
      'Evidence file physically exists in protected storage directory'
    );

    assert(
      Boolean(dbRecord?.storedFilename.endsWith('.bin')),
      'Stored filename on disk uses server-generated UUID .bin extension'
    );

    // 2. INVESTIGATOR upload
    const invUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'LOG')
      .field('source', 'SERVER')
      .field('description', 'Syslog export')
      .attach('file', Buffer.from('SYSLOG_SAMPLE_DATA_LINE_1\nLINE_2'), 'syslog.log');

    assert(
      invUploadRes.status === 201 &&
        invUploadRes.body.evidence.uploadedById === userIds['INVESTIGATOR'],
      'INVESTIGATOR can upload evidence',
      invUploadRes.body
    );

    // 3. ANALYST cannot upload
    const analystUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${analystToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'USER_SUBMITTED')
      .attach('file', Buffer.from('test'), 'doc.pdf');

    assert(
      analystUploadRes.status === 403,
      'ANALYST cannot upload evidence (403 Forbidden)',
      analystUploadRes.body
    );

    // 4. VIEWER cannot upload
    const viewerUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${viewerToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'USER_SUBMITTED')
      .attach('file', Buffer.from('test'), 'doc.pdf');

    assert(
      viewerUploadRes.status === 403,
      'VIEWER cannot upload evidence (403 Forbidden)',
      viewerUploadRes.body
    );

    // 5. Unauthenticated upload returns 401
    const unauthUploadRes = await request(app)
      .post('/api/evidence')
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'USER_SUBMITTED')
      .attach('file', Buffer.from('test'), 'doc.pdf');

    assert(
      unauthUploadRes.status === 401,
      'Unauthenticated upload returns 401 Unauthorized',
      unauthUploadRes.body
    );

    // 6. Invalid metadata returns 400
    const invalidMetaRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'INVALID_TYPE_XYZ')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('test'), 'doc.pdf');

    assert(
      invalidMetaRes.status === 400,
      'Invalid evidence type rejected with 400 Bad Request',
      invalidMetaRes.body
    );

    // 7. Missing file rejected with 400
    const missingFileRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT');

    assert(
      missingFileRes.status === 400,
      'Missing evidence file rejected with 400 Bad Request',
      missingFileRes.body
    );

    // 8. Non-existent Case returns 404
    const nonExistentCaseId = '00000000-0000-0000-0000-000000000000';
    const fakeCaseRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', nonExistentCaseId)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      fakeCaseRes.status === 404,
      'Non-existent Case rejected with 404 Not Found',
      fakeCaseRes.body
    );

    // 9. Non-existent Incident returns 404
    const fakeIncRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('incidentId', nonExistentCaseId)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      fakeIncRes.status === 404,
      'Non-existent Incident rejected with 404 Not Found',
      fakeIncRes.body
    );

    // 10. Cross-case mismatch rejected: Incident belongs to Case 2, but upload targeted Case 1
    const crossCaseRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('incidentId', incident2Id) // belongs to case2
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      crossCaseRes.status === 400,
      'Cross-case reference rejected: Incident belonging to another case rejected with 400',
      crossCaseRes.body
    );

    // 11. Spoofing uploadedById in request body rejected by strict Zod schema
    const spoofUploadRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .field('uploadedById', userIds['ADMIN'])
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      spoofUploadRes.status === 400,
      'Attempting to spoof uploadedById in request is rejected with 400 Bad Request',
      spoofUploadRes.body
    );

    // 12. Client cannot override SHA-256 in request body
    const spoofHashRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .field('sha256', '0000000000000000000000000000000000000000000000000000000000000000')
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      spoofHashRes.status === 400,
      'Attempting to override sha256 in request is rejected with 400 Bad Request',
      spoofHashRes.body
    );

    // 13. Path traversal filename does not affect server storage location
    const traversalFilename = '../../../../../../etc/passwd';
    const traversalRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('safe content'), traversalFilename);

    assert(
      traversalRes.status === 201 &&
        traversalRes.body.evidence.originalFilename === 'passwd',
      'Path traversal in filename is sanitized and does not compromise storage path',
      traversalRes.body
    );

    // ----------------------------------------------------
    // Phase 2: Evidence Listing Tests
    // ----------------------------------------------------
    console.log('\n[Phase 2: Evidence Listing Tests]');

    // 14. ADMIN can list
    const adminListRes = await request(app)
      .get('/api/evidence')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      adminListRes.status === 200 &&
        Array.isArray(adminListRes.body.data) &&
        adminListRes.body.pagination,
      'ADMIN can list evidence records with pagination metadata'
    );

    // 15. INVESTIGATOR can list
    const invListRes = await request(app)
      .get('/api/evidence')
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invListRes.status === 200, 'INVESTIGATOR can list evidence records');

    // 16. ANALYST can list
    const analystListRes = await request(app)
      .get('/api/evidence')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(analystListRes.status === 200, 'ANALYST can list evidence records');

    // 17. VIEWER can list
    const viewerListRes = await request(app)
      .get('/api/evidence')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(viewerListRes.status === 200, 'VIEWER can list evidence records');

    // 18. Case ID filter
    const caseFilterRes = await request(app)
      .get(`/api/evidence?caseId=${case1Id}`)
      .set('Authorization', `Bearer ${analystToken}`);
    const allMatchCase = caseFilterRes.body.data.every(
      (e: { caseId: string }) => e.caseId === case1Id
    );
    assert(
      caseFilterRes.status === 200 && allMatchCase && caseFilterRes.body.data.length > 0,
      'Filtering evidence by caseId returns matching records only'
    );

    // 19. Incident ID filter
    const incFilterRes = await request(app)
      .get(`/api/evidence?incidentId=${incident1Id}`)
      .set('Authorization', `Bearer ${analystToken}`);
    const allMatchInc = incFilterRes.body.data.every(
      (e: { incidentId: string }) => e.incidentId === incident1Id
    );
    assert(
      incFilterRes.status === 200 && allMatchInc && incFilterRes.body.data.length > 0,
      'Filtering evidence by incidentId returns matching records only'
    );

    // 20. Evidence type filter
    const typeFilterRes = await request(app)
      .get('/api/evidence?evidenceType=MEMORY_DUMP')
      .set('Authorization', `Bearer ${analystToken}`);
    const allMatchType = typeFilterRes.body.data.every(
      (e: { evidenceType: string }) => e.evidenceType === 'MEMORY_DUMP'
    );
    assert(
      typeFilterRes.status === 200 && allMatchType && typeFilterRes.body.data.length > 0,
      'Filtering evidence by evidenceType returns matching records only'
    );

    // 21. Search by evidenceNumber
    const searchRes = await request(app)
      .get(`/api/evidence?search=${createdEvidenceNumber}`)
      .set('Authorization', `Bearer ${analystToken}`);
    assert(
      searchRes.status === 200 &&
        searchRes.body.data.some(
          (e: { evidenceNumber: string }) => e.evidenceNumber === createdEvidenceNumber
        ),
      'Search by evidenceNumber locates the expected record'
    );

    // 22. Pagination test
    const pageRes = await request(app)
      .get('/api/evidence?page=1&limit=1')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(
      pageRes.status === 200 &&
        pageRes.body.data.length === 1 &&
        pageRes.body.pagination.limit === 1 &&
        pageRes.body.pagination.total >= 2,
      'Pagination limits and total count calculated correctly'
    );

    // ----------------------------------------------------
    // Phase 3: Get Evidence Metadata Tests
    // ----------------------------------------------------
    console.log('\n[Phase 3: Get Evidence Metadata Tests]');

    const getRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      getRes.status === 200 &&
        getRes.body.evidence &&
        getRes.body.evidence.id === createdEvidenceId &&
        getRes.body.evidence.case?.id === case1Id &&
        getRes.body.evidence.incident?.id === incident1Id &&
        getRes.body.evidence.uploadedBy?.email !== undefined,
      'VIEWER can retrieve evidence metadata with linked Case, Incident, and Uploader info'
    );

    // Ensure server storage path and storedFilename are NOT returned to client
    assert(
      getRes.body.evidence.storagePath === undefined &&
        getRes.body.evidence.storedFilename === undefined,
      'Evidence API response strictly protects internal filesystem paths and stored filenames'
    );

    // Invalid UUID handled safely
    const invalidIdRes = await request(app)
      .get('/api/evidence/not-a-valid-uuid')
      .set('Authorization', `Bearer ${analystToken}`);
    assert(
      invalidIdRes.status === 400,
      'Invalid evidence UUID format returns 400 Bad Request',
      invalidIdRes.body
    );

    // Non-existent evidence ID
    const notFoundIdRes = await request(app)
      .get(`/api/evidence/${nonExistentCaseId}`)
      .set('Authorization', `Bearer ${analystToken}`);
    assert(
      notFoundIdRes.status === 404,
      'Non-existent evidence UUID returns 404 Not Found',
      notFoundIdRes.body
    );

    // ----------------------------------------------------
    // Phase 4: Download / File Retrieval Tests
    // ----------------------------------------------------
    console.log('\n[Phase 4: Download / File Retrieval Tests]');

    // 27. ADMIN can download
    const adminDownRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/download`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      adminDownRes.status === 200 &&
        adminDownRes.body.toString() === testFileBuffer.toString() &&
        adminDownRes.headers['content-disposition']?.includes('workstation_ram.raw'),
      'ADMIN can download original evidence file with valid Content-Disposition'
    );

    // 28. INVESTIGATOR can download
    const invDownRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/download`)
      .set('Authorization', `Bearer ${investigatorToken}`);
    assert(invDownRes.status === 200, 'INVESTIGATOR can download evidence file');

    // 29. ANALYST can download
    const analystDownRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/download`)
      .set('Authorization', `Bearer ${analystToken}`);
    assert(analystDownRes.status === 200, 'ANALYST can download evidence file');

    // 30. VIEWER cannot download (403 Forbidden)
    const viewerDownRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);
    assert(
      viewerDownRes.status === 403,
      'VIEWER cannot download evidence file (403 Forbidden enforced)'
    );

    // 31. Unauthenticated download returns 401
    const unauthDownRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/download`);
    assert(
      unauthDownRes.status === 401,
      'Unauthenticated download returns 401 Unauthorized'
    );

    // ----------------------------------------------------
    // Phase 5: Integrity Verification Endpoint Tests
    // ----------------------------------------------------
    console.log('\n[Phase 5: Integrity Verification Tests]');

    // 32. Valid evidence returns VALID
    const validIntegrityRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/integrity`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      validIntegrityRes.status === 200 &&
        validIntegrityRes.body.integrity === 'VALID' &&
        validIntegrityRes.body.storedHash === expectedSha256 &&
        validIntegrityRes.body.currentHash === expectedSha256,
      'Live integrity verification returns VALID for untampered file',
      validIntegrityRes.body
    );

    // 33. Tamper with the physical file on disk to simulate evidence corruption / tampering
    const originalDiskContent = fs.readFileSync(createdEvidencePath);
    fs.writeFileSync(createdEvidencePath, 'TAMPERED_MALICIOUS_EVIDENCE_CORRUPTED_BYTES');

    const tamperedIntegrityRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/integrity`)
      .set('Authorization', `Bearer ${analystToken}`);

    assert(
      tamperedIntegrityRes.status === 200 &&
        tamperedIntegrityRes.body.integrity === 'MISMATCH' &&
        tamperedIntegrityRes.body.storedHash === expectedSha256 &&
        tamperedIntegrityRes.body.currentHash !== expectedSha256,
      'Tampered physical file correctly detected with integrity: MISMATCH',
      tamperedIntegrityRes.body
    );

    // 34. Verify database stored hash was not altered or silently repaired
    const afterTamperDb = await prisma.evidence.findUnique({
      where: { id: createdEvidenceId },
      select: { sha256: true },
    });
    assert(
      afterTamperDb?.sha256 === expectedSha256,
      'Stored database SHA-256 hash remained immutable and was not silently modified'
    );

    // Restore original file content
    fs.writeFileSync(createdEvidencePath, originalDiskContent);

    // Verify back to VALID
    const restoredIntegrityRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}/integrity`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      restoredIntegrityRes.status === 200 && restoredIntegrityRes.body.integrity === 'VALID',
      'Restored physical file returns integrity: VALID'
    );

    // ----------------------------------------------------
    // Phase 6: Update Evidence Metadata Tests
    // ----------------------------------------------------
    console.log('\n[Phase 6: Update Evidence Metadata Tests]');

    // 36. INVESTIGATOR can update description and source
    const invUpdateRes = await request(app)
      .patch(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        description: 'Updated memory dump description by investigator',
        source: 'FORENSIC_TOOL',
      });

    assert(
      invUpdateRes.status === 200 &&
        invUpdateRes.body.evidence.description ===
          'Updated memory dump description by investigator' &&
        invUpdateRes.body.evidence.source === 'FORENSIC_TOOL',
      'INVESTIGATOR can update mutable metadata (description, source)',
      invUpdateRes.body
    );

    // 37. ADMIN can update evidenceType
    const adminUpdateRes = await request(app)
      .patch(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        evidenceType: 'DISK_IMAGE',
      });

    assert(
      adminUpdateRes.status === 200 &&
        adminUpdateRes.body.evidence.evidenceType === 'DISK_IMAGE',
      'ADMIN can update evidenceType metadata'
    );

    // 38. ANALYST cannot update metadata (403 Forbidden)
    const analystUpdateRes = await request(app)
      .patch(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        description: 'Attempted update by analyst',
      });

    assert(
      analystUpdateRes.status === 403,
      'ANALYST cannot update evidence metadata (403 Forbidden)'
    );

    // 39. VIEWER cannot update metadata (403 Forbidden)
    const viewerUpdateRes = await request(app)
      .patch(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        description: 'Attempted update by viewer',
      });

    assert(
      viewerUpdateRes.status === 403,
      'VIEWER cannot update evidence metadata (403 Forbidden)'
    );

    // 40. Protected fields cannot be changed via PATCH
    const protectedUpdateRes = await request(app)
      .patch(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        evidenceNumber: 'EVD-9999-9999',
        caseId: case2Id,
        fileSize: 999999,
        uploadedById: userIds['ADMIN'],
      });

    assert(
      protectedUpdateRes.status === 400,
      'Attempting to modify protected fields (sha256, evidenceNumber, caseId, etc.) rejected with 400',
      protectedUpdateRes.body
    );

    // ----------------------------------------------------
    // Phase 7: Security & Prohibited Operations Tests
    // ----------------------------------------------------
    console.log('\n[Phase 7: Security & Prohibited Operations Tests]');

    // 41. DELETE /api/evidence/:id is prohibited (must return 404)
    const deleteRes = await request(app)
      .delete(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      deleteRes.status === 404,
      'DELETE /api/evidence/:id endpoint does NOT exist (permanent evidence deletion prohibited)',
      deleteRes.status
    );

    // 42. Role spoofing prevention
    const spoofQueryRes = await request(app)
      .post('/api/evidence?role=ADMIN')
      .set('Authorization', `Bearer ${viewerToken}`)
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      spoofQueryRes.status === 403,
      'Role spoofing via query parameter is blocked (403 Forbidden)'
    );

    const spoofHeaderRes = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-User-Role', 'ADMIN')
      .field('caseId', case1Id)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .attach('file', Buffer.from('test'), 'test.bin');

    assert(
      spoofHeaderRes.status === 403,
      'Role spoofing via custom header is blocked (403 Forbidden)'
    );

    // 43. Ensure no sensitive information in API responses
    const meRes = await request(app)
      .get(`/api/evidence/${createdEvidenceId}`)
      .set('Authorization', `Bearer ${analystToken}`);
    const jsonStr = JSON.stringify(meRes.body);

    assert(
      !jsonStr.includes('passwordHash') &&
        !jsonStr.includes('secret') &&
        !jsonStr.includes('storagePath') &&
        !jsonStr.includes('.bin'),
      'Responses strictly exclude password hashes, secrets, and internal storage paths'
    );
  } catch (error) {
    console.error('Fatal test execution error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 EVIDENCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEvidenceTests();
