import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique, standardized, and human-readable case number.
 * Format: CASE-YYYY-XXXX (e.g., CASE-2026-0001)
 *
 * Generated strictly server-side to prevent client collisions or spoofing.
 * Supports passing an active Prisma transaction client.
 */
export async function generateCaseNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prisma;
  const currentYear = new Date().getFullYear();
  const prefix = `CASE-${currentYear}-`;

  // Query the highest existing case sequence for the current year
  const latestCase = await db.case.findFirst({
    where: {
      caseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      caseNumber: 'desc',
    },
    select: {
      caseNumber: true,
    },
  });

  let nextSequence = 1;

  if (latestCase && latestCase.caseNumber) {
    const parts = latestCase.caseNumber.split('-');
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
