import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app';
import prisma from '../src/config/database';

/**
 * Automated test suite for Milestone 8: Chain of Custody & Evidence Audit Trail.
 * Validates append-only custody transitions, recipient validation, sealing/release lifecycle,
 * tamper-evident SHA-256 hash chains, comprehensive action auditing, and RBAC boundaries.
 */
async function runCustodyTests() {
  console.log('====================================================');
  console.log('🔗 RUNNING MILESTONE 8: CUSTODY & AUDIT TEST SUITE');
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
  let evidence1Id = '';
  let evidence2Id = '';
  let inactiveUserId = '';

  try {
    // ----------------------------------------------------
    // Setup: Create authenticated accounts for all roles
    // ----------------------------------------------------
    console.log('[Setup: Creating role-based test accounts]');
    const rolesList = [
      'ADMIN',
      'INVESTIGATOR_1',
      'INVESTIGATOR_2',
      'ANALYST',
      'VIEWER',
    ] as const;

    for (const roleKey of rolesList) {
      const roleName = roleKey.startsWith('INVESTIGATOR') ? 'INVESTIGATOR' : roleKey;
      const email = `custody.test.${roleKey.toLowerCase()}.${Date.now()}@evidence-platform.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Test',
        lastName: roleKey,
        email,
        password: testPassword,
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to register ${roleKey}: ${JSON.stringify(regRes.body)}`);
      }

      const uid = regRes.body.user.id;
      userIds[roleKey] = uid;

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

      tokens[roleKey] = loginRes.body.token;
    }

    const adminToken = tokens['ADMIN']!;
    const inv1Token = tokens['INVESTIGATOR_1']!;
    const inv2Token = tokens['INVESTIGATOR_2']!;
    const analystToken = tokens['ANALYST']!;
    const viewerToken = tokens['VIEWER']!;

    const adminId = userIds['ADMIN']!;
    const inv1Id = userIds['INVESTIGATOR_1']!;
    const inv2Id = userIds['INVESTIGATOR_2']!;
    const analystId = userIds['ANALYST']!;
    const viewerId = userIds['VIEWER']!;

    // Create an inactive user for testing transfer rejection
    const inactiveEmail = `custody.inactive.${Date.now()}@evidence-platform.local`;
    const inactRegRes = await request(app).post('/api/auth/register').send({
      firstName: 'Deactivated',
      lastName: 'Officer',
      email: inactiveEmail,
      password: testPassword,
    });
    inactiveUserId = inactRegRes.body.user.id;
    await prisma.user.update({
      where: { id: inactiveUserId },
      data: { isActive: false },
    });

    // Create a parent Case
    console.log('[Setup: Creating parent Case and initial Evidence]');
    const caseRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({
        title: 'Project Custody Vault Investigation',
        description: 'Case container for chain of custody and audit trail testing.',
        severity: 'HIGH',
      });
    parentCaseId = caseRes.body.case.id;

    // Upload Evidence 1 by INVESTIGATOR_1
    const uploadRes1 = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${inv1Token}`)
      .field('caseId', parentCaseId)
      .field('evidenceType', 'DOCUMENT')
      .field('source', 'ENDPOINT')
      .field('description', 'Encrypted communication transcript')
      .attach('file', Buffer.from('EVIDENCE_CUSTODY_TEST_DATA_PAYLOAD_1'), 'transcript.doc');

    evidence1Id = uploadRes1.body.evidence.id;

    // Upload Evidence 2 by ADMIN
    const uploadRes2 = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('caseId', parentCaseId)
      .field('evidenceType', 'LOG')
      .field('source', 'SERVER')
      .field('description', 'Firewall breach log')
      .attach('file', Buffer.from('FIREWALL_BREACH_LOG_PAYLOAD_2'), 'firewall.log');

    evidence2Id = uploadRes2.body.evidence.id;

    // ----------------------------------------------------
    // Phase 1: Initial Custody Event on Upload Tests
    // ----------------------------------------------------
    console.log('\n[Phase 1: Initial Custody Event Tests]');

    const initialCustodyRes = await request(app)
      .get(`/api/evidence/${evidence1Id}/custody`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      initialCustodyRes.status === 200 &&
        initialCustodyRes.body.data.length === 1 &&
        initialCustodyRes.body.data[0].eventType === 'UPLOADED' &&
        initialCustodyRes.body.data[0].actorUserId === inv1Id &&
        initialCustodyRes.body.data[0].toUserId === inv1Id &&
        initialCustodyRes.body.data[0].fromUserId === null,
      'Initial evidence upload automatically creates UPLOADED custody event'
    );

    const initialEvent = initialCustodyRes.body.data[0];
    assert(
      initialEvent.previousEventHash === null,
      'Initial custody event has previousEventHash === null'
    );

    assert(
      typeof initialEvent.eventHash === 'string' && initialEvent.eventHash.length === 64,
      'Initial custody event receives 64-character server-generated SHA-256 eventHash'
    );

    // Initial audit log for upload
    const initialAuditRes = await request(app)
      .get(`/api/evidence/${evidence1Id}/audit`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      initialAuditRes.status === 200 &&
        initialAuditRes.body.data.some(
          (log: { action: string; result: string }) =>
            log.action === 'UPLOADED' && log.result === 'SUCCESS'
        ),
      'Initial evidence upload automatically creates UPLOADED audit log'
    );

    // ----------------------------------------------------
    // Phase 2: Custody Transfer Tests
    // ----------------------------------------------------
    console.log('\n[Phase 2: Custody Transfer Tests]');

    // 1. ANALYST cannot transfer
    const analystTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        toUserId: inv2Id,
        reason: 'Handover for forensic analysis',
      });
    assert(
      analystTransferRes.status === 403,
      'ANALYST cannot initiate custody transfer (403 Forbidden)'
    );

    // 2. VIEWER cannot transfer
    const viewerTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        toUserId: inv2Id,
        reason: 'Handover for forensic analysis',
      });
    assert(
      viewerTransferRes.status === 403,
      'VIEWER cannot initiate custody transfer (403 Forbidden)'
    );

    // 3. Unauthenticated transfer returns 401
    const unauthTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .send({
        toUserId: inv2Id,
        reason: 'Handover for forensic analysis',
      });
    assert(
      unauthTransferRes.status === 401,
      'Unauthenticated custody transfer returns 401 Unauthorized'
    );

    // 4. Inactive recipient rejected
    const inactiveTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({
        toUserId: inactiveUserId,
        reason: 'Transfer to inactive officer',
      });
    assert(
      inactiveTransferRes.status === 400,
      'Custody transfer to inactive user is rejected with 400 Bad Request'
    );

    // 5. Non-existent recipient rejected
    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    const fakeUserTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({
        toUserId: fakeUserId,
        reason: 'Transfer to nonexistent user',
      });
    assert(
      fakeUserTransferRes.status === 404,
      'Custody transfer to nonexistent recipient returns 404 Not Found'
    );

    // 6. Arbitrary client security fields rejected by strict schema
    const spoofTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({
        toUserId: inv2Id,
        reason: 'Handover for forensic analysis',
        fromUserId: adminId,
        actorUserId: adminId,
        eventHash: '0000000000000000000000000000000000000000000000000000000000000000',
        previousEventHash: '0000000000000000000000000000000000000000000000000000000000000000',
      });
    assert(
      spoofTransferRes.status === 400,
      'Client injection of fromUserId, actorUserId, or eventHash rejected with 400 Bad Request'
    );

    // 7. INVESTIGATOR can transfer custody to INVESTIGATOR_2
    const validTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${inv1Token}`)
      .send({
        toUserId: inv2Id,
        reason: 'Transfer to secondary investigator for malware reverse engineering',
        location: 'Secure Forensics Lab Room 402',
      });

    assert(
      validTransferRes.status === 201 &&
        validTransferRes.body.event.eventType === 'TRANSFERRED' &&
        validTransferRes.body.event.fromUserId === inv1Id &&
        validTransferRes.body.event.toUserId === inv2Id &&
        validTransferRes.body.event.actorUserId === inv1Id,
      'INVESTIGATOR can transfer custody with server-determined from/to relationships',
      validTransferRes.body
    );

    // ----------------------------------------------------
    // Phase 3: Custody Receipt Tests
    // ----------------------------------------------------
    console.log('\n[Phase 3: Custody Receipt Tests]');

    // 8. Wrong recipient cannot receive custody
    const wrongRecipientRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/receive`)
      .set('Authorization', `Bearer ${inv1Token}`) // Inv1 is sender, not recipient
      .send({
        reason: 'Unauthorized premature receive attempt',
      });
    assert(
      wrongRecipientRes.status === 403,
      'Non-designated recipient cannot receive custody (403 Forbidden)',
      wrongRecipientRes.body
    );

    // 9. Valid designated recipient (INVESTIGATOR_2) can receive custody
    const validReceiveRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/receive`)
      .set('Authorization', `Bearer ${inv2Token}`)
      .send({
        reason: 'Physical possession received and inspected at Forensics Lab',
        location: 'Secure Lab Safe 1',
      });

    assert(
      validReceiveRes.status === 200 &&
        validReceiveRes.body.event.eventType === 'RECEIVED' &&
        validReceiveRes.body.event.actorUserId === inv2Id &&
        validReceiveRes.body.event.toUserId === inv2Id,
      'Designated recipient can receive custody and transition state to RECEIVED',
      validReceiveRes.body
    );

    // 10. Attempting to receive again without a new transfer is rejected
    const duplicateReceiveRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/receive`)
      .set('Authorization', `Bearer ${inv2Token}`)
      .send({
        reason: 'Duplicate receive attempt',
      });
    assert(
      duplicateReceiveRes.status === 400,
      'Receiving without pending transfer is rejected with 400 Bad Request'
    );

    // ----------------------------------------------------
    // Phase 4: Seal and Unseal Tests
    // ----------------------------------------------------
    console.log('\n[Phase 4: Seal and Unseal Tests]');

    // 11. ANALYST cannot seal
    const analystSealRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/seal`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ reason: 'Sealing container' });
    assert(analystSealRes.status === 403, 'ANALYST cannot seal evidence (403 Forbidden)');

    // 12. INVESTIGATOR can seal evidence
    const sealRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/seal`)
      .set('Authorization', `Bearer ${inv2Token}`)
      .send({
        reason: 'Tamper-evident bag sealed with barcode #TAG-88219',
        notes: 'Double sealed in anti-static enclosure',
      });
    assert(
      sealRes.status === 200 && sealRes.body.event.eventType === 'SEALED',
      'INVESTIGATOR can seal evidence'
    );

    // 13. Sealing an already sealed evidence is rejected
    const alreadySealedRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/seal`)
      .set('Authorization', `Bearer ${inv2Token}`)
      .send({ reason: 'Attempt duplicate seal' });
    assert(
      alreadySealedRes.status === 400,
      'Sealing already sealed evidence is rejected with 400 Bad Request'
    );

    // 14. ADMIN can unseal evidence
    const unsealRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/unseal`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Seal broken for court presentation preparation',
      });
    assert(
      unsealRes.status === 200 && unsealRes.body.event.eventType === 'UNSEALED',
      'ADMIN can unseal evidence'
    );

    // 15. Unsealing when not sealed is rejected
    const alreadyUnsealedRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/unseal`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Attempt unseal when already unsealed' });
    assert(
      alreadyUnsealedRes.status === 400,
      'Unsealing when not sealed is rejected with 400 Bad Request'
    );

    // ----------------------------------------------------
    // Phase 5: Release Tests
    // ----------------------------------------------------
    console.log('\n[Phase 5: Release Tests]');

    // 16. INVESTIGATOR cannot release evidence (ADMIN only)
    const invReleaseRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/release`)
      .set('Authorization', `Bearer ${inv2Token}`)
      .send({
        reason: 'Release to victim organization',
      });
    assert(
      invReleaseRes.status === 403,
      'INVESTIGATOR cannot release evidence (ADMIN only policy enforced with 403)'
    );

    // 17. ADMIN can release evidence
    const adminReleaseRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Court order #CR-2026-991: Evidence returned to owner organization',
        location: 'Department of Justice Archive Vault',
      });
    assert(
      adminReleaseRes.status === 200 &&
        adminReleaseRes.body.event.eventType === 'RELEASED',
      'ADMIN can release evidence lifecycle'
    );

    // 18. Cannot release already released evidence
    const dupReleaseRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Attempt duplicate release',
      });
    assert(
      dupReleaseRes.status === 400,
      'Releasing already released evidence is rejected with 400 Bad Request'
    );

    // 19. Cannot transfer released evidence
    const postReleaseTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        toUserId: inv1Id,
        reason: 'Transfer attempt on released evidence',
      });
    assert(
      postReleaseTransferRes.status === 400,
      'Transferring released evidence is rejected with 400 Bad Request'
    );

    // ----------------------------------------------------
    // Phase 6: Tamper-Evident Hash Chain & Integrity Tests
    // ----------------------------------------------------
    console.log('\n[Phase 6: Hash Chain & Integrity Verification Tests]');

    // 20. Check custody event chain structure
    const fullCustodyRes = await request(app)
      .get(`/api/evidence/${evidence1Id}/custody?limit=50`)
      .set('Authorization', `Bearer ${analystToken}`);

    // Verify chain linkage in chronological order
    const eventsChronological = [...fullCustodyRes.body.data].reverse();
    assert(
      eventsChronological.length >= 5,
      `Full custody sequence recorded ${eventsChronological.length} append-only events`
    );

    let chainIntact = true;
    for (let i = 0; i < eventsChronological.length; i++) {
      if (i === 0) {
        if (eventsChronological[0].previousEventHash !== null) chainIntact = false;
      } else {
        if (
          eventsChronological[i].previousEventHash !==
          eventsChronological[i - 1].eventHash
        ) {
          chainIntact = false;
        }
      }
    }

    assert(
      chainIntact,
      'Custody event chain linkage: Event[N].previousEventHash matches Event[N-1].eventHash'
    );

    // 21. Custody integrity verification endpoint returns VALID
    const custodyIntegrityRes = await request(app)
      .get(`/api/evidence/${evidence1Id}/custody/integrity`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      custodyIntegrityRes.status === 200 &&
        custodyIntegrityRes.body.integrity === 'VALID' &&
        custodyIntegrityRes.body.eventsChecked >= 5,
      'GET /api/evidence/:id/custody/integrity returns VALID for untampered history',
      custodyIntegrityRes.body
    );

    // 22. Audit integrity verification endpoint returns VALID
    const auditIntegrityRes = await request(app)
      .get(`/api/evidence/${evidence1Id}/audit/integrity`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      auditIntegrityRes.status === 200 &&
        auditIntegrityRes.body.integrity === 'VALID' &&
        auditIntegrityRes.body.eventsChecked >= 5,
      'GET /api/evidence/:id/audit/integrity returns VALID for untampered audit history',
      auditIntegrityRes.body
    );

    // 23. Tamper with a custody event in PostgreSQL to verify detection
    const firstEventDb = await prisma.evidenceCustodyEvent.findFirst({
      where: { evidenceId: evidence1Id },
      orderBy: { createdAt: 'asc' },
    });

    if (firstEventDb) {
      // Tamper with reason
      await prisma.evidenceCustodyEvent.update({
        where: { id: firstEventDb.id },
        data: { reason: 'TAMPERED_MALICIOUS_REASON_INJECTED_INTO_DATABASE' },
      });

      const tamperedCustodyCheck = await request(app)
        .get(`/api/evidence/${evidence1Id}/custody/integrity`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert(
        tamperedCustodyCheck.status === 200 &&
          tamperedCustodyCheck.body.integrity === 'MISMATCH',
        'Tampered custody event is detected with integrity: MISMATCH',
        tamperedCustodyCheck.body
      );

      // Restore original reason
      await prisma.evidenceCustodyEvent.update({
        where: { id: firstEventDb.id },
        data: { reason: firstEventDb.reason },
      });

      // Verify back to VALID
      const restoredCustodyCheck = await request(app)
        .get(`/api/evidence/${evidence1Id}/custody/integrity`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert(
        restoredCustodyCheck.status === 200 &&
          restoredCustodyCheck.body.integrity === 'VALID',
        'Restoring authentic custody event returns integrity: VALID'
      );
    }

    // ----------------------------------------------------
    // Phase 7: Action & Denied Access Audit Logging Tests
    // ----------------------------------------------------
    console.log('\n[Phase 7: Action & Denied Access Audit Logging Tests]');

    // 24. Viewing evidence metadata logs VIEWED action
    await request(app)
      .get(`/api/evidence/${evidence2Id}`)
      .set('Authorization', `Bearer ${analystToken}`);

    const viewAuditRes = await request(app)
      .get(`/api/evidence/${evidence2Id}/audit?action=VIEWED`)
      .set('Authorization', `Bearer ${analystToken}`);

    assert(
      viewAuditRes.status === 200 &&
        viewAuditRes.body.data.some(
          (log: { action: string; actorUserId: string }) =>
            log.action === 'VIEWED' && log.actorUserId === analystId
        ),
      'Viewing evidence metadata automatically records VIEWED audit entry'
    );

    // 25. Downloading evidence logs DOWNLOADED action
    await request(app)
      .get(`/api/evidence/${evidence2Id}/download`)
      .set('Authorization', `Bearer ${analystToken}`);

    const downAuditRes = await request(app)
      .get(`/api/evidence/${evidence2Id}/audit?action=DOWNLOADED`)
      .set('Authorization', `Bearer ${analystToken}`);

    assert(
      downAuditRes.status === 200 &&
        downAuditRes.body.data.some(
          (log: { action: string; result: string; actorUserId: string }) =>
            log.action === 'DOWNLOADED' &&
            log.result === 'SUCCESS' &&
            log.actorUserId === analystId
        ),
      'Downloading evidence file records DOWNLOADED (SUCCESS) audit entry'
    );

    // 26. Denied download by VIEWER records DOWNLOADED with result DENIED
    const deniedDownRes = await request(app)
      .get(`/api/evidence/${evidence2Id}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    assert(
      deniedDownRes.status === 403,
      'VIEWER download attempt is denied with 403 Forbidden'
    );

    const deniedAuditRes = await request(app)
      .get(`/api/evidence/${evidence2Id}/audit?action=DOWNLOADED&result=DENIED`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      deniedAuditRes.status === 200 &&
        deniedAuditRes.body.data.some(
          (log: { action: string; result: string; actorUserId: string }) =>
            log.action === 'DOWNLOADED' &&
            log.result === 'DENIED' &&
            log.actorUserId === viewerId
        ),
      'Denied download attempt by VIEWER automatically recorded in audit log with result: DENIED'
    );

    // 27. Tamper with an audit log to test audit integrity check
    const firstAuditDb = await prisma.evidenceAuditLog.findFirst({
      where: { evidenceId: evidence2Id },
      orderBy: { createdAt: 'asc' },
    });

    if (firstAuditDb) {
      await prisma.evidenceAuditLog.update({
        where: { id: firstAuditDb.id },
        data: { ipAddress: '198.51.100.99' },
      });

      const tamperedAuditCheck = await request(app)
        .get(`/api/evidence/${evidence2Id}/audit/integrity`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert(
        tamperedAuditCheck.status === 200 &&
          tamperedAuditCheck.body.integrity === 'MISMATCH',
        'Tampered audit record detected with audit integrity: MISMATCH'
      );

      // Restore
      await prisma.evidenceAuditLog.update({
        where: { id: firstAuditDb.id },
        data: { ipAddress: firstAuditDb.ipAddress },
      });
    }

    // ----------------------------------------------------
    // Phase 8: Immutability & Prohibited Operations Tests
    // ----------------------------------------------------
    console.log('\n[Phase 8: Immutability & Prohibited Operations Tests]');

    // 28. No DELETE endpoint for custody
    const deleteCustodyRes = await request(app)
      .delete(`/api/evidence/${evidence1Id}/custody`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      deleteCustodyRes.status === 404,
      'DELETE /api/evidence/:id/custody does NOT exist (custody is strictly append-only)'
    );

    // 29. No DELETE endpoint for audit
    const deleteAuditRes = await request(app)
      .delete(`/api/evidence/${evidence1Id}/audit`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      deleteAuditRes.status === 404,
      'DELETE /api/evidence/:id/audit does NOT exist (audit logs are strictly append-only)'
    );

    // 30. No PATCH endpoint for custody
    const patchCustodyRes = await request(app)
      .patch(`/api/evidence/${evidence1Id}/custody`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Attempted modification' });
    assert(
      patchCustodyRes.status === 404,
      'PATCH /api/evidence/:id/custody does NOT exist'
    );

    // 31. No PATCH endpoint for audit
    const patchAuditRes = await request(app)
      .patch(`/api/evidence/${evidence1Id}/audit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ipAddress: '127.0.0.1' });
    assert(
      patchAuditRes.status === 404,
      'PATCH /api/evidence/:id/audit does NOT exist'
    );

    // 32. Role spoofing prevention on custody operations
    const spoofRoleTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer?role=ADMIN`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        toUserId: inv1Id,
        reason: 'Spoofed transfer attempt',
      });
    assert(
      spoofRoleTransferRes.status === 403,
      'Role spoofing on custody operations via query parameter is blocked (403 Forbidden)'
    );

    const spoofHeaderTransferRes = await request(app)
      .post(`/api/evidence/${evidence1Id}/custody/transfer`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-User-Role', 'ADMIN')
      .send({
        toUserId: inv1Id,
        reason: 'Spoofed transfer attempt',
      });
    assert(
      spoofHeaderTransferRes.status === 403,
      'Role spoofing on custody operations via headers is blocked (403 Forbidden)'
    );

    // 33. Ensure no sensitive information in custody or audit responses
    const custodyListResp = await request(app)
      .get(`/api/evidence/${evidence1Id}/custody`)
      .set('Authorization', `Bearer ${viewerToken}`);
    const custodyJson = JSON.stringify(custodyListResp.body);

    assert(
      !custodyJson.includes('passwordHash') && !custodyJson.includes('secret'),
      'Custody API responses strictly exclude password hashes and secrets'
    );

    const auditListResp = await request(app)
      .get(`/api/evidence/${evidence1Id}/audit`)
      .set('Authorization', `Bearer ${viewerToken}`);
    const auditJson = JSON.stringify(auditListResp.body);

    assert(
      !auditJson.includes('passwordHash') && !auditJson.includes('secret'),
      'Audit API responses strictly exclude password hashes and secrets'
    );
  } catch (error) {
    console.error('Fatal test execution error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`📊 CUSTODY & AUDIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustodyTests();
