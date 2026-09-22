-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('PHISHING', 'MALWARE', 'DATA_BREACH', 'UNAUTHORIZED_ACCESS', 'ACCOUNT_COMPROMISE', 'INSIDER_THREAT', 'NETWORK_ATTACK', 'ENDPOINT_COMPROMISE', 'SUSPICIOUS_ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('EMAIL_SECURITY', 'IDENTITY_ACCESS', 'ENDPOINT_SECURITY', 'NETWORK_SECURITY', 'DATA_SECURITY', 'APPLICATION_SECURITY', 'CLOUD_SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('USER_REPORT', 'SOC_ALERT', 'SIEM', 'EDR', 'EMAIL', 'NETWORK_MONITORING', 'THREAT_INTELLIGENCE', 'MANUAL_INVESTIGATION', 'OTHER');

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "incident_number" VARCHAR(50) NOT NULL,
    "case_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "incident_type" "IncidentType" NOT NULL DEFAULT 'OTHER',
    "category" "IncidentCategory" NOT NULL DEFAULT 'OTHER',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "source" "IncidentSource" NOT NULL DEFAULT 'OTHER',
    "detected_at" TIMESTAMP(3),
    "occurred_at" TIMESTAMP(3),
    "reported_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "resolution" TEXT,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_status_history" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "previous_status" "IncidentStatus",
    "new_status" "IncidentStatus" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incidents_incident_number_key" ON "incidents"("incident_number");

-- CreateIndex
CREATE INDEX "incidents_case_id_idx" ON "incidents"("case_id");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");

-- CreateIndex
CREATE INDEX "incidents_priority_idx" ON "incidents"("priority");

-- CreateIndex
CREATE INDEX "incidents_incident_type_idx" ON "incidents"("incident_type");

-- CreateIndex
CREATE INDEX "incidents_category_idx" ON "incidents"("category");

-- CreateIndex
CREATE INDEX "incidents_created_at_idx" ON "incidents"("created_at");

-- CreateIndex
CREATE INDEX "incidents_assigned_to_id_idx" ON "incidents"("assigned_to_id");

-- CreateIndex
CREATE INDEX "incident_status_history_incident_id_idx" ON "incident_status_history"("incident_id");

-- CreateIndex
CREATE INDEX "incident_status_history_changed_by_id_idx" ON "incident_status_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "incident_status_history_created_at_idx" ON "incident_status_history"("created_at");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
