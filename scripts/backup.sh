#!/usr/bin/env bash
# ==============================================================================
# Digital Evidence Platform - Coordinated Backup Script
# Creates a coordinated recovery unit containing:
# 1. PostgreSQL logical dump (schema + data + sequences + BLOBs)
# 2. Digital evidence directory binary files (storage/evidence/)
# 3. SHA-256 manifest of the backup bundle
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BUNDLE_DIR="${BACKUP_DIR}/dep_backup_${TIMESTAMP}"
CONTAINER_NAME="${DB_CONTAINER:-dep-postgres}"
DB_USER="${DB_USER:-ep_user}"
DB_NAME="${DB_NAME:-evidence_platform_db}"
STORAGE_SOURCE="${STORAGE_DIR:-./storage/evidence}"

echo "===================================================="
echo "📦 Initiating Digital Evidence Platform Coordinated Backup"
echo "Timestamp: ${TIMESTAMP}"
echo "===================================================="

mkdir -p "${BUNDLE_DIR}"

# 1. Database Logical Dump
echo "[1/3] Dumping PostgreSQL database from container: ${CONTAINER_NAME}..."
docker exec "${CONTAINER_NAME}" pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F c \
  -b \
  -v \
  > "${BUNDLE_DIR}/database_${TIMESTAMP}.dump"

echo "  ✓ Database dump saved to: ${BUNDLE_DIR}/database_${TIMESTAMP}.dump"

# 2. Evidence Filesystem Archive
echo "[2/3] Archiving physical evidence storage directory: ${STORAGE_SOURCE}..."
if [ -d "${STORAGE_SOURCE}" ]; then
  tar -czf "${BUNDLE_DIR}/evidence_${TIMESTAMP}.tar.gz" -C "$(dirname "${STORAGE_SOURCE}")" "$(basename "${STORAGE_SOURCE}")"
  echo "  ✓ Evidence archive saved to: ${BUNDLE_DIR}/evidence_${TIMESTAMP}.tar.gz"
else
  echo "  ⚠️ Warning: Evidence directory ${STORAGE_SOURCE} not found. Skipping filesystem archive."
fi

# 3. Cryptographic Manifest
echo "[3/3] Generating SHA-256 integrity manifest..."
cd "${BUNDLE_DIR}"
sha256sum * > "manifest_${TIMESTAMP}.sha256"
cd - > /dev/null

echo "===================================================="
echo "✅ Coordinated Backup Bundle Complete!"
echo "Bundle Location: ${BUNDLE_DIR}"
echo "Manifest: ${BUNDLE_DIR}/manifest_${TIMESTAMP}.sha256"
echo "===================================================="
