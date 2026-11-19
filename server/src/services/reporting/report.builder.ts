/**
 * Report content builder.
 * Transforms raw Prisma records into structured report sections.
 *
 * Privacy rules:
 * - Never expose storagePath, storedFilename, password hashes, JWTs, API keys
 * - BigInt values converted to Number for JSON serialization
 * - All AI content labeled advisory with mandatory disclaimer
 */

import { createHash } from 'crypto';
import type {
  CaseIdentificationSection,
  IncidentSectionItem,
  EvidenceInventoryItem,
  EvidenceIntegrityItem,
  CustodyEventItem,
  AuditItem,
  AIFindingItem,
  ActivityTimelineItem,
  InvestigationReport,
  AI_ADVISORY_DISCLAIMER,
} from '../../types/report.types';
import { AI_ADVISORY_DISCLAIMER as DISCLAIMER, REPORT_DISCLAIMER } from '../../types/report.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function userName(user: any): string {
  if (!user) return 'Unknown';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function toISOString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toISOString();
}

export class ReportBuilder {
  /**
   * Build case identification section from a Prisma case record.
   * Excludes any sensitive fields.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildCaseSection(caseRecord: any): CaseIdentificationSection {
    return {
      caseNumber: caseRecord.caseNumber,
      title: safeString(caseRecord.title),
      description: caseRecord.description ?? null,
      status: caseRecord.status,
      priority: caseRecord.priority,
      severity: caseRecord.severity,
      caseType: caseRecord.caseType,
      category: caseRecord.category,
      classification: caseRecord.confidentiality ?? 'INTERNAL',
      createdAt: new Date(caseRecord.createdAt).toISOString(),
      updatedAt: new Date(caseRecord.updatedAt).toISOString(),
      closedAt: toISOString(caseRecord.closedAt),
      closureReason: caseRecord.closureReason ?? null,
      leadInvestigator: caseRecord.leadInvestigator
        ? userName(caseRecord.leadInvestigator)
        : null,
      members: (caseRecord.members ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => ({
          name: userName(m.user),
          role: m.role ?? 'MEMBER',
        })
      ),
      tags: caseRecord.tags ?? [],
    };
  }

  /**
   * Build incident section items from Prisma incident records.
   * Includes AI classification if available, with advisory disclaimer.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildIncidentSections(incidents: any[], includeAI: boolean = true): IncidentSectionItem[] {
    return incidents.map((inc) => {
      const item: IncidentSectionItem = {
        incidentNumber: inc.incidentNumber,
        title: safeString(inc.title),
        type: inc.incidentType,
        category: inc.category,
        severity: inc.severity,
        priority: inc.priority,
        status: inc.status,
        source: inc.source,
        description: inc.description ?? null,
        detectedAt: toISOString(inc.detectedAt),
        occurredAt: toISOString(inc.occurredAt),
        reportedAt: toISOString(inc.reportedAt),
        resolvedAt: toISOString(inc.resolvedAt),
        assignedInvestigator: inc.assignedTo ? userName(inc.assignedTo) : null,
        resolution: inc.resolution ?? null,
      };

      if (includeAI && inc.aiAnalyses?.length > 0) {
        const latestAI = inc.aiAnalyses
          .filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) =>
              a.analysisType === 'INCIDENT_CLASSIFICATION' && a.status === 'COMPLETED'
          )
          .sort(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any, b: any) =>
              new Date(b.completedAt ?? b.createdAt).getTime() -
              new Date(a.completedAt ?? a.createdAt).getTime()
          )[0];

        if (latestAI) {
          const result = latestAI.result as Record<string, unknown> | null;
          item.aiClassification = {
            classification: (result?.classification as string) ?? latestAI.summary ?? 'N/A',
            confidence: latestAI.confidence ?? 0,
            summary: latestAI.summary ?? 'No summary available',
            disclaimer: DISCLAIMER,
          };
        }
      }

      return item;
    });
  }

  /**
   * Build evidence inventory items.
   * CRITICAL: excludes storagePath, storedFilename, and all internal paths.
   */
  buildEvidenceInventory(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evidenceRecords: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseRecord?: any
  ): EvidenceInventoryItem[] {
    return evidenceRecords.map((ev) => ({
      evidenceNumber: ev.evidenceNumber,
      originalFilename: ev.originalFilename,
      evidenceType: ev.evidenceType,
      source: ev.source,
      fileSize: Number(ev.fileSize),
      mimeType: ev.mimeType,
      caseNumber: ev.case?.caseNumber ?? caseRecord?.caseNumber ?? 'N/A',
      incidentNumber: ev.incident?.incidentNumber ?? null,
      uploadedBy: userName(ev.uploadedBy),
      collectedAt: toISOString(ev.collectedAt),
      createdAt: new Date(ev.createdAt).toISOString(),
      sha256: ev.sha256,
      description: ev.description ?? null,
    }));
  }

  /**
   * Build evidence integrity section from audit logs.
   * Derives verification status from the most recent INTEGRITY_CHECKED audit action.
   */
  buildIntegritySection(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evidenceRecords: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditLogs: any[]
  ): EvidenceIntegrityItem[] {
    return evidenceRecords.map((ev) => {
      const integrityLogs = auditLogs
        .filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (log: any) =>
            log.evidenceId === ev.id && log.action === 'INTEGRITY_CHECKED'
        )
        .sort(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const latestCheck = integrityLogs[0];
      let integrityStatus: 'VALID' | 'MISMATCH' | 'NOT_VERIFIED' = 'NOT_VERIFIED';
      let latestCalculatedSha256: string | null = null;
      let verificationTimestamp: string | null = null;
      let integrityFailures = 0;

      if (latestCheck) {
        integrityStatus = latestCheck.result === 'SUCCESS' ? 'VALID' : 'MISMATCH';
        verificationTimestamp = new Date(latestCheck.createdAt).toISOString();
        const meta = latestCheck.metadata as Record<string, unknown> | null;
        latestCalculatedSha256 = (meta?.calculatedSha256 as string) ?? null;
        integrityFailures = integrityLogs.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (l: any) => l.result !== 'SUCCESS'
        ).length;
      }

      let note = '';
      if (integrityStatus === 'VALID') {
        note = 'SHA-256 hash verified successfully. File integrity confirmed.';
      } else if (integrityStatus === 'MISMATCH') {
        note = 'WARNING: SHA-256 mismatch detected. Evidence may have been altered.';
      } else {
        note = 'No integrity verification has been performed on this evidence.';
      }

      return {
        evidenceNumber: ev.evidenceNumber,
        storedSha256: ev.sha256,
        latestCalculatedSha256,
        integrityStatus,
        verificationTimestamp,
        integrityFailures,
        note,
      };
    });
  }

  /**
   * Build custody chain section from custody events.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildCustodySection(custodyEvents: any[]): CustodyEventItem[] {
    return custodyEvents
      .sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) =>
          new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime()
      )
      .map((evt) => ({
        eventTimestamp: new Date(evt.eventAt).toISOString(),
        eventType: evt.eventType,
        fromUser: evt.fromUser ? userName(evt.fromUser) : null,
        toUser: evt.toUser ? userName(evt.toUser) : null,
        actor: userName(evt.actorUser),
        reason: evt.reason ?? null,
        location: evt.location ?? null,
        notes: evt.notes ?? null,
        isTamperEvident: !!evt.eventHash,
        eventHash: evt.eventHash ?? '',
      }));
  }

  /**
   * Build audit section from audit log entries.
   * Excludes sensitive metadata fields (IP, user-agent are kept for forensic value).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildAuditSection(auditLogs: any[]): AuditItem[] {
    return auditLogs
      .sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map((log) => {
        // Filter sensitive data from metadata
        const meta = log.metadata as Record<string, unknown> | null;
        const safeMeta: Record<string, unknown> | null = meta
          ? Object.fromEntries(
              Object.entries(meta).filter(
                ([k]) =>
                  !['jwt', 'token', 'password', 'secret', 'apiKey', 'credential'].includes(
                    k.toLowerCase()
                  )
              )
            )
          : null;

        return {
          action: log.action,
          result: log.result,
          actor: userName(log.actorUser),
          timestamp: new Date(log.createdAt).toISOString(),
          entityType: 'Evidence',
          entityReference: log.evidenceId,
          metadata: safeMeta,
        };
      });
  }

  /**
   * Build AI findings section.
   * All AI content is explicitly marked advisory with mandatory disclaimer.
   * aiInputHash is distinct from evidence SHA-256.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildAISection(analyses: any[]): AIFindingItem[] {
    return analyses.map((ai) => {
      const result = ai.result as Record<string, unknown> | null;

      return {
        analysisType: ai.analysisType,
        provider: ai.provider,
        model: ai.model,
        status: ai.status,
        generatedAt: new Date(ai.createdAt).toISOString(),
        completedAt: ai.completedAt ? new Date(ai.completedAt).toISOString() : null,
        summary: ai.summary ?? null,
        confidence: ai.confidence ?? null,
        classification: (result?.classification as string) ?? null,
        severity: (result?.severity as string) ?? null,
        findings: Array.isArray(result?.findings)
          ? (result.findings as Array<Record<string, unknown>>).map((f) => ({
              title: safeString(f.title),
              description: safeString(f.description),
              severity: safeString(f.severity),
              confidence: Number(f.confidence ?? 0),
            }))
          : [],
        indicators: Array.isArray(result?.indicators)
          ? (result.indicators as Array<Record<string, unknown>>).map((i) => ({
              type: safeString(i.type),
              value: safeString(i.value),
              confidence: Number(i.confidence ?? 0),
            }))
          : [],
        recommendedActions: Array.isArray(result?.recommendations)
          ? (result.recommendations as string[])
          : [],
        aiInputHash: ai.inputHash ?? '',
        disclaimer: DISCLAIMER,
        errorMessage: ai.errorMessage ?? null,
      };
    });
  }

  /**
   * Build activity timeline from audit logs and custody events.
   */
  buildActivityTimeline(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditLogs: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custodyEvents: any[]
  ): ActivityTimelineItem[] {
    const items: ActivityTimelineItem[] = [];

    for (const log of auditLogs) {
      items.push({
        timestamp: new Date(log.createdAt).toISOString(),
        type: 'AUDIT',
        actor: userName(log.actorUser),
        entityType: 'Evidence',
        entityReference: log.evidenceId,
        description: `${log.action} on evidence`,
        result: log.result,
      });
    }

    for (const evt of custodyEvents) {
      items.push({
        timestamp: new Date(evt.eventAt).toISOString(),
        type: 'CUSTODY',
        actor: userName(evt.actorUser),
        entityType: 'Evidence',
        entityReference: evt.evidenceId,
        description: `Custody event: ${evt.eventType}`,
        result: 'SUCCESS',
      });
    }

    items.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return items;
  }

  /**
   * Build executive summary from structured report data.
   */
  buildSummary(report: Partial<InvestigationReport>): string {
    const parts: string[] = [];

    if (report.case) {
      parts.push(
        `Investigation ${report.case.caseNumber}: "${report.case.title}" — ` +
          `Status: ${report.case.status}, Priority: ${report.case.priority}, ` +
          `Severity: ${report.case.severity}.`
      );
    }

    if (report.incidents && report.incidents.length > 0) {
      parts.push(`${report.incidents.length} incident(s) documented.`);
    }

    if (report.evidence && report.evidence.length > 0) {
      parts.push(`${report.evidence.length} evidence item(s) in inventory.`);
    }

    if (report.integrity && report.integrity.length > 0) {
      const valid = report.integrity.filter((i) => i.integrityStatus === 'VALID').length;
      const mismatch = report.integrity.filter((i) => i.integrityStatus === 'MISMATCH').length;
      const unverified = report.integrity.filter(
        (i) => i.integrityStatus === 'NOT_VERIFIED'
      ).length;
      parts.push(
        `Evidence integrity: ${valid} verified, ${mismatch} mismatched, ${unverified} not verified.`
      );
    }

    if (report.custody && report.custody.length > 0) {
      parts.push(`${report.custody.length} custody event(s) recorded.`);
    }

    if (report.aiAnalysis && report.aiAnalysis.length > 0) {
      parts.push(
        `${report.aiAnalysis.length} AI analysis result(s) available (advisory only).`
      );
    }

    return parts.join(' ') || 'No data available for summary.';
  }

  /**
   * Build data-driven limitations based on actual report content.
   */
  buildLimitations(report: Partial<InvestigationReport>): string[] {
    const limitations: string[] = [];

    if (!report.evidence || report.evidence.length === 0) {
      limitations.push('No evidence items were found for inclusion in this report.');
    }

    if (report.integrity) {
      const unverified = report.integrity.filter(
        (i) => i.integrityStatus === 'NOT_VERIFIED'
      );
      if (unverified.length > 0) {
        limitations.push(
          `${unverified.length} evidence item(s) have not undergone integrity verification.`
        );
      }

      const mismatched = report.integrity.filter(
        (i) => i.integrityStatus === 'MISMATCH'
      );
      if (mismatched.length > 0) {
        limitations.push(
          `${mismatched.length} evidence item(s) have integrity mismatches requiring investigation.`
        );
      }
    }

    if (!report.aiAnalysis || report.aiAnalysis.length === 0) {
      limitations.push('No AI analysis results are included in this report.');
    } else {
      limitations.push(
        'AI analysis results are advisory only and require human corroboration.'
      );
      const failed = report.aiAnalysis.filter((a) => a.status === 'FAILED');
      if (failed.length > 0) {
        limitations.push(
          `${failed.length} AI analysis attempt(s) failed or could not complete successfully.`
        );
      }
    }

    if (!report.custody || report.custody.length === 0) {
      limitations.push('No custody chain data is included in this report.');
    }

    return limitations;
  }

  /**
   * Compute SHA-256 report hash from normalized report content.
   * This hash is DISTINCT from:
   * - Evidence file SHA-256 (hash of actual file bytes)
   * - AI Input Hash (hash of AI analysis input payload)
   */
  computeReportHash(
    report: Omit<InvestigationReport, 'reportMetadata'> & {
      reportMetadata: Omit<InvestigationReport['reportMetadata'], 'reportHash'>;
    }
  ): string {
    // Normalize: sort keys deterministically, strip reportHash itself
    const normalized = JSON.stringify(report, Object.keys(report).sort());
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }
}

export const reportBuilder = new ReportBuilder();
