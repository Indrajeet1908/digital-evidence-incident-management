import fs from 'fs';
import crypto from 'crypto';
import { EvidenceType } from '@prisma/client';
import config from '../../config/environment';
import { calculateFileSha256 } from '../../utils/file-hash';
import { AppError } from '../../utils/errors';

export interface PreprocessedEvidence {
  content: string;
  inputHash: string;
  isTruncated: boolean;
  characterCount: number;
}

const SUPPORTED_EVIDENCE_TYPES = new Set<EvidenceType>([
  EvidenceType.DOCUMENT,
  EvidenceType.LOG,
  EvidenceType.EMAIL,
]);

/**
 * Validates physical evidence integrity before AI submission and extracts safe, normalized text content.
 *
 * CRITICAL SECURITY GUARANTEES:
 * 1. Physical SHA-256 on disk MUST match stored evidence.sha256.
 * 2. Unsupported binary evidence types (DISK_IMAGE, MEMORY_DUMP, etc.) are safely rejected.
 * 3. Files are never executed, evaluated as code, dynamically imported, or run in shells.
 * 4. Content is strictly size-bounded by MAX_AI_INPUT_CHARACTERS to prevent buffer exhaustion and token abuse.
 * 5. inputHash is derived deterministically from the exact normalized text payload sent to the AI.
 */
export async function preprocessEvidenceFile(evidence: {
  id: string;
  evidenceNumber: string;
  storagePath: string;
  sha256: string;
  evidenceType: EvidenceType;
  originalFilename: string;
  fileSize: bigint | number;
}): Promise<PreprocessedEvidence> {
  // 1. Verify physical file presence
  if (!fs.existsSync(evidence.storagePath)) {
    throw new AppError('Evidence physical file is missing from protected storage', 500);
  }

  // 2. Pre-flight SHA-256 integrity verification
  const currentPhysicalHash = await calculateFileSha256(evidence.storagePath);
  if (currentPhysicalHash.toLowerCase() !== evidence.sha256.toLowerCase()) {
    throw new AppError(
      'Evidence integrity violation: Physical file SHA-256 does not match recorded checksum. AI analysis rejected to prevent tampered evidence execution.',
      409
    );
  }

  // 3. Supported evidence type check
  if (!SUPPORTED_EVIDENCE_TYPES.has(evidence.evidenceType)) {
    throw new AppError(
      `Evidence type '${evidence.evidenceType}' is not currently supported for automated text analysis. Supported types are: ${Array.from(SUPPORTED_EVIDENCE_TYPES).join(', ')}.`,
      422
    );
  }

  // 4. Safe text extraction (read as UTF-8 without executing)
  let rawBuffer: Buffer;
  try {
    rawBuffer = await fs.promises.readFile(evidence.storagePath);
  } catch (readErr) {
    throw new AppError(
      `Failed to read evidence file content: ${readErr instanceof Error ? readErr.message : String(readErr)}`,
      500
    );
  }

  // Binary check: detect null bytes in first 8KB to prevent raw binary dumps to AI
  const sampleSize = Math.min(rawBuffer.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    if (rawBuffer[i] === 0x00) {
      throw new AppError(
        'Evidence file contains binary null bytes and cannot be safely processed as text.',
        422
      );
    }
  }

  // 5. Decode and normalize text content
  let text = rawBuffer.toString('utf8');
  // Normalize Windows CRLF and trailing spaces
  text = text.replace(/\r\n/g, '\n').trim();

  // 6. Enforce input size limit
  const maxLimit = config.maxAiInputCharacters;
  let isTruncated = false;

  if (text.length > maxLimit) {
    text = text.slice(0, maxLimit) + `\n\n[TRUNCATED: Evidence content exceeded safe analysis limit of ${maxLimit} characters]`;
    isTruncated = true;
  }

  // 7. Calculate deterministic SHA-256 of the exact normalized text payload sent to AI
  const inputHash = crypto.createHash('sha256').update(text, 'utf8').digest('hex');

  return {
    content: text,
    inputHash,
    isTruncated,
    characterCount: text.length,
  };
}
