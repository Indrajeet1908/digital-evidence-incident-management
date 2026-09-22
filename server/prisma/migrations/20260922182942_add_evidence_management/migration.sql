-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO', 'LOG', 'EMAIL', 'NETWORK_CAPTURE', 'MEMORY_DUMP', 'DISK_IMAGE', 'ARCHIVE', 'DATABASE_EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('ENDPOINT', 'SERVER', 'NETWORK', 'EMAIL', 'CLOUD', 'USER_SUBMITTED', 'SECURITY_TOOL', 'FORENSIC_TOOL', 'EXTERNAL_MEDIA', 'OTHER');

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "evidence_number" VARCHAR(50) NOT NULL,
    "case_id" UUID NOT NULL,
    "incident_id" UUID,
    "original_filename" VARCHAR(255) NOT NULL,
    "stored_filename" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "evidence_type" "EvidenceType" NOT NULL,
    "description" TEXT,
    "source" "EvidenceSource" NOT NULL,
    "collected_at" TIMESTAMP(3),
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_evidence_number_key" ON "evidence"("evidence_number");

-- CreateIndex
CREATE INDEX "evidence_case_id_idx" ON "evidence"("case_id");

-- CreateIndex
CREATE INDEX "evidence_incident_id_idx" ON "evidence"("incident_id");

-- CreateIndex
CREATE INDEX "evidence_evidence_type_idx" ON "evidence"("evidence_type");

-- CreateIndex
CREATE INDEX "evidence_sha256_idx" ON "evidence"("sha256");

-- CreateIndex
CREATE INDEX "evidence_uploaded_by_id_idx" ON "evidence"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "evidence_created_at_idx" ON "evidence"("created_at");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
