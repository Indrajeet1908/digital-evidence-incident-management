-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CaseSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CaseConfidentiality" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('CYBERSECURITY_INCIDENT', 'DIGITAL_FORENSICS', 'DATA_BREACH', 'MALWARE', 'PHISHING', 'INSIDER_THREAT', 'UNAUTHORIZED_ACCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseCategory" AS ENUM ('EMAIL_SECURITY', 'ENDPOINT_SECURITY', 'NETWORK_SECURITY', 'IDENTITY_ACCESS', 'DATA_SECURITY', 'MALWARE', 'SOCIAL_ENGINEERING', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseMemberRole" AS ENUM ('LEAD_INVESTIGATOR', 'INVESTIGATOR', 'ANALYST', 'VIEWER');

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "case_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "case_type" "CaseType" NOT NULL DEFAULT 'CYBERSECURITY_INCIDENT',
    "category" "CaseCategory" NOT NULL DEFAULT 'OTHER',
    "severity" "CaseSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "CasePriority" NOT NULL DEFAULT 'MEDIUM',
    "confidentiality" "CaseConfidentiality" NOT NULL DEFAULT 'INTERNAL',
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "incident_date" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3),
    "reported_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "lead_investigator_id" UUID,
    "closed_by_id" UUID,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "closure_reason" TEXT,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_members" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CaseMemberRole" NOT NULL DEFAULT 'INVESTIGATOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "previous_status" "CaseStatus",
    "new_status" "CaseStatus" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_priority_idx" ON "cases"("priority");

-- CreateIndex
CREATE INDEX "cases_severity_idx" ON "cases"("severity");

-- CreateIndex
CREATE INDEX "cases_case_type_idx" ON "cases"("case_type");

-- CreateIndex
CREATE INDEX "cases_category_idx" ON "cases"("category");

-- CreateIndex
CREATE INDEX "cases_created_by_id_idx" ON "cases"("created_by_id");

-- CreateIndex
CREATE INDEX "cases_lead_investigator_id_idx" ON "cases"("lead_investigator_id");

-- CreateIndex
CREATE INDEX "cases_created_at_idx" ON "cases"("created_at");

-- CreateIndex
CREATE INDEX "case_members_case_id_idx" ON "case_members"("case_id");

-- CreateIndex
CREATE INDEX "case_members_user_id_idx" ON "case_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_members_case_id_user_id_key" ON "case_members"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "case_status_history_case_id_idx" ON "case_status_history"("case_id");

-- CreateIndex
CREATE INDEX "case_status_history_changed_by_id_idx" ON "case_status_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "case_status_history_created_at_idx" ON "case_status_history"("created_at");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_lead_investigator_id_fkey" FOREIGN KEY ("lead_investigator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_members" ADD CONSTRAINT "case_members_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_members" ADD CONSTRAINT "case_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
