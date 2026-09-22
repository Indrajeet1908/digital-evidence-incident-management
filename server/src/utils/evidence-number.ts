import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique, standardized, and human-readable evidence number.
 * Format: EVD-YYYY-XXXX (e.g., EVD-2026-0001)
 *
 * Generated strictly server-side to prevent client collisions or spoofing.
 * Supports passing an active Prisma transaction client.
 */
export async function generateEvidenceNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prisma;
  const currentYear = new Date().getFullYear();
  const prefix = `EVD-${currentYear}-`;

  // Query the highest existing evidence sequence for the current year
  const latestEvidence = await db.evidence.findFirst({
    where: {
      evidenceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      evidenceNumber: 'desc',
    },
    select: {
      evidenceNumber: true,
    },
  });

  let nextSequence = 1;

  if (latestEvidence && latestEvidence.evidenceNumber) {
    const parts = latestEvidence.evidenceNumber.split('-');
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
