#!/usr/bin/env bash
# ==============================================================================
# Digital Evidence Platform - Coordinated Restore Script
# Restores a coordinated recovery unit:
# 1. Validates SHA-256 manifest integrity before touching any target
# 2. Restores PostgreSQL database via pg_restore
# 3. Restores physical evidence storage directory
#
# CAUTION:
# This script must NEVER be executed against active production databases
# without deliberate operator verification and explicit confirmation.
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path_to_backup_directory>"
  echo "Example: $0 ./backups/dep_backup_20261007_120000"
  exit 1
fi

BUNDLE_DIR="$1"
CONTAINER_NAME="${DB_CONTAINER:-dep-postgres}"
DB_USER="${DB_USER:-ep_user}"
DB_NAME="${DB_NAME:-evidence_platform_db}"
STORAGE_TARGET="${STORAGE_DIR:-./storage/evidence}"

if [ ! -d "${BUNDLE_DIR}" ]; then
  echo "❌ Error: Backup directory ${BUNDLE_DIR} does not exist."
  exit 1
fi

echo "===================================================="
echo "⚠️  DIGITAL EVIDENCE PLATFORM - RESTORE OPERATION"
echo "Backup Bundle: ${BUNDLE_DIR}"
echo "Target DB: ${DB_NAME} (in ${CONTAINER_NAME})"
echo "Target Storage: ${STORAGE_TARGET}"
echo "===================================================="

# 1. Manifest Integrity Verification
echo "[1/3] Verifying SHA-256 backup bundle integrity..."
cd "${BUNDLE_DIR}"
if [ -f manifest_*.sha256 ]; then
  sha256sum -c manifest_*.sha256
  echo "  ✓ Checksum verification PASSED."
else
  echo "  ⚠️ Warning: No SHA-256 manifest found. Proceeding with caution."
fi
cd - > /dev/null

# 2. Confirmation Prompt
read -p "Type 'RESTORE' to proceed with restoring this backup unit: " CONFIRM
if [ "${CONFIRM}" != "RESTORE" ]; then
  echo "Operation aborted by user. No data modified."
  exit 0
fi

# 3. Database Restore
DB_DUMP=$(find "${BUNDLE_DIR}" -name "database_*.dump" | head -n 1)
if [ -n "${DB_DUMP}" ]; then
  echo "[2/3] Restoring PostgreSQL database from ${DB_DUMP}..."
  cat "${DB_DUMP}" | docker exec -i "${CONTAINER_NAME}" pg_restore \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --clean \
    --if-exists \
    -v
  echo "  ✓ Database restore complete."
else
  echo "  ❌ Error: Database dump file not found in bundle."
  exit 1
fi

# 4. Evidence Filesystem Restore
EV_ARCHIVE=$(find "${BUNDLE_DIR}" -name "evidence_*.tar.gz" | head -n 1)
if [ -n "${EV_ARCHIVE}" ]; then
  echo "[3/3] Restoring evidence storage directory from ${EV_ARCHIVE}..."
  mkdir -p "$(dirname "${STORAGE_TARGET}")"
  tar -xzf "${EV_ARCHIVE}" -C "$(dirname "${STORAGE_TARGET}")"
  echo "  ✓ Evidence directory restored to ${STORAGE_TARGET}."
fi

echo "===================================================="
echo "✅ Coordinated Restore Complete!"
echo "Verify system integrity via GET /api/ready and evidence integrity checks."
echo "===================================================="
