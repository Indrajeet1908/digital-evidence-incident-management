-- CreateEnum
CREATE TYPE "AIAnalysisType" AS ENUM ('EVIDENCE_SUMMARY', 'INCIDENT_CLASSIFICATION', 'IOC_EXTRACTION', 'THREAT_ANALYSIS', 'INVESTIGATION_SUMMARY');

-- CreateEnum
CREATE TYPE "AIAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvidenceAuditAction" ADD VALUE 'AI_ANALYSIS_REQUESTED';
ALTER TYPE "EvidenceAuditAction" ADD VALUE 'AI_ANALYSIS_COMPLETED';
ALTER TYPE "EvidenceAuditAction" ADD VALUE 'AI_ANALYSIS_FAILED';

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL,
    "evidence_id" UUID,
    "incident_id" UUID,
    "case_id" UUID NOT NULL,
    "analysis_type" "AIAnalysisType" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "status" "AIAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "input_hash" VARCHAR(64) NOT NULL,
    "result" JSONB,
    "summary" TEXT,
    "confidence" DOUBLE PRECISION,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_analyses_evidence_id_idx" ON "ai_analyses"("evidence_id");

-- CreateIndex
CREATE INDEX "ai_analyses_incident_id_idx" ON "ai_analyses"("incident_id");

-- CreateIndex
CREATE INDEX "ai_analyses_case_id_idx" ON "ai_analyses"("case_id");

-- CreateIndex
CREATE INDEX "ai_analyses_analysis_type_idx" ON "ai_analyses"("analysis_type");

-- CreateIndex
CREATE INDEX "ai_analyses_status_idx" ON "ai_analyses"("status");

-- CreateIndex
CREATE INDEX "ai_analyses_input_hash_idx" ON "ai_analyses"("input_hash");

-- CreateIndex
CREATE INDEX "ai_analyses_created_at_idx" ON "ai_analyses"("created_at");

-- CreateIndex
CREATE INDEX "ai_analyses_created_by_id_idx" ON "ai_analyses"("created_by_id");

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
