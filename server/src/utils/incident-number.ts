import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique, standardized, human-readable incident identifier.
 * Format: INC-YYYY-XXXX (e.g., INC-2026-0001)
 *
 * Generated strictly server-side to guarantee uniqueness and prevent client spoofing.
 * Accepts an optional Prisma transaction client.
 */
export async function generateIncidentNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prisma;
  const currentYear = new Date().getFullYear();
  const prefix = `INC-${currentYear}-`;

  // Query the highest existing incident number sequence for the current year
  const latestIncident = await db.incident.findFirst({
    where: {
      incidentNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      incidentNumber: 'desc',
    },
    select: {
      incidentNumber: true,
    },
  });

  let nextSequence = 1;

  if (latestIncident && latestIncident.incidentNumber) {
    const parts = latestIncident.incidentNumber.split('-');
    if (parts.length === 3 && parts[2]) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq) && lastSeq > 0) {
        nextSequence = lastSeq + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
}
