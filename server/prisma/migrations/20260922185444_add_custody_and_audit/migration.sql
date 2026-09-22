-- CreateEnum
CREATE TYPE "CustodyEventType" AS ENUM ('COLLECTED', 'UPLOADED', 'RECEIVED', 'TRANSFERRED', 'RETURNED', 'SEALED', 'UNSEALED', 'RELEASED', 'STORED', 'INTEGRITY_VERIFIED', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceAuditAction" AS ENUM ('VIEWED', 'DOWNLOADED', 'UPLOADED', 'METADATA_UPDATED', 'INTEGRITY_CHECKED', 'CUSTODY_TRANSFERRED', 'CUSTODY_RECEIVED', 'SEALED', 'UNSEALED', 'RELEASED', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "evidence_custody_events" (
    "id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "event_type" "CustodyEventType" NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "location" VARCHAR(255),
    "event_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_hash" VARCHAR(64) NOT NULL,
    "previous_event_hash" VARCHAR(64),

    CONSTRAINT "evidence_custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_audit_logs" (
    "id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" "EvidenceAuditAction" NOT NULL,
    "result" "AuditResult" NOT NULL DEFAULT 'SUCCESS',
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_hash" VARCHAR(64) NOT NULL,
    "previous_event_hash" VARCHAR(64),

    CONSTRAINT "evidence_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_custody_events_evidence_id_idx" ON "evidence_custody_events"("evidence_id");

-- CreateIndex
CREATE INDEX "evidence_custody_events_event_type_idx" ON "evidence_custody_events"("event_type");

-- CreateIndex
CREATE INDEX "evidence_custody_events_actor_user_id_idx" ON "evidence_custody_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "evidence_custody_events_event_at_idx" ON "evidence_custody_events"("event_at");

-- CreateIndex
CREATE INDEX "evidence_custody_events_previous_event_hash_idx" ON "evidence_custody_events"("previous_event_hash");

-- CreateIndex
CREATE INDEX "evidence_audit_logs_evidence_id_idx" ON "evidence_audit_logs"("evidence_id");

-- CreateIndex
CREATE INDEX "evidence_audit_logs_actor_user_id_idx" ON "evidence_audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "evidence_audit_logs_action_idx" ON "evidence_audit_logs"("action");

-- CreateIndex
CREATE INDEX "evidence_audit_logs_created_at_idx" ON "evidence_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "evidence_custody_events" ADD CONSTRAINT "evidence_custody_events_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_custody_events" ADD CONSTRAINT "evidence_custody_events_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_custody_events" ADD CONSTRAINT "evidence_custody_events_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_custody_events" ADD CONSTRAINT "evidence_custody_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_audit_logs" ADD CONSTRAINT "evidence_audit_logs_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_audit_logs" ADD CONSTRAINT "evidence_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
