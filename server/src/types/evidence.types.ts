import { EvidenceType, EvidenceSource } from '@prisma/client';

export { EvidenceType, EvidenceSource };

/**
 * Clean evidence response representation without sensitive server internals.
 * Stored filenames, physical storage paths, and raw system details are omitted.
 */
export interface EvidenceResponse {
  id: string;
  evidenceNumber: string;
  caseId: string;
  incidentId: string | null;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  evidenceType: EvidenceType;
  description: string | null;
  source: EvidenceSource;
  collectedAt: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
  };
  incident?: {
    id: string;
    incidentNumber: string;
    title: string;
    status: string;
  } | null;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

/**
 * Query filter parameters for listing evidence.
 */
export interface EvidenceListQuery {
  caseId?: string;
  incidentId?: string;
  evidenceType?: EvidenceType;
  source?: EvidenceSource;
  uploadedById?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Result structure for evidence integrity verification endpoint.
 */
export interface EvidenceIntegrityResponse {
  evidenceId: string;
  storedHash: string;
  currentHash: string;
  integrity: 'VALID' | 'MISMATCH';
}

/**
 * Allowed fields for evidence metadata update.
 */
export interface UpdateEvidenceMetadataInput {
  description?: string | null;
  evidenceType?: EvidenceType;
  source?: EvidenceSource;
  collectedAt?: string | null;
}
