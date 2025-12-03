#!/usr/bin/env bash

set -euo pipefail

###############################################################################
# PokerBot Backup Helper
#
# Backup PostgreSQL database and persistent volumes.
#
# This script creates timestamped backups of:
# - PostgreSQL database (SQL dump)
# - Redis data (RDB snapshot)
# - Environment configuration (.env file)
#
# Backups are stored in: ${BACKUP_DIR} (default: ./backups)
#
# Usage:
#   ./backup.sh [--db-only] [--volumes-only]
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_ONLY=false
VOLUMES_ONLY=false

usage() {
  cat <<'USAGE'
Backup PokerBot database and volumes.

Usage:
  backup.sh [options]

Options:
  --db-only       Only backup PostgreSQL database (skip volumes)
  --volumes-only  Only backup volumes (skip database)
  -h, --help      Show this help message

Environment Variables:
  BACKUP_DIR        Directory to store backups (default: ./backups)
  BACKUP_RETENTION  Number of backups to keep (default: 10)

Examples:
  backup.sh              # Full backup (database + volumes)
  backup.sh --db-only    # Database only
  backup.sh --volumes-only  # Volumes only

Backups are stored in timestamped directories:
  ${BACKUP_DIR}/backup_YYYYMMDD_HHMMSS/
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-only)
      DB_ONLY=true
      shift
      ;;
    --volumes-only)
      VOLUMES_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "${DB_ONLY}" == "true" ]] && [[ "${VOLUMES_ONLY}" == "true" ]]; then
  log_error "Cannot specify both --db-only and --volumes-only"
  exit 1
fi

ensure_command docker
ensure_env_file
load_env_file

BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}"
mkdir -p "${BACKUP_PATH}"

log_info "Creating backup in: ${BACKUP_PATH}"

# Backup environment file
if [[ -f "${ENV_FILE}" ]]; then
  cp "${ENV_FILE}" "${BACKUP_PATH}/.env.backup"
  log_info "Backed up environment file"
fi

# Backup PostgreSQL database
if [[ "${VOLUMES_ONLY}" == "false" ]]; then
  log_info "Backing up PostgreSQL database..."
  
  DB_CONTAINER="$(compose ps -q postgres 2>/dev/null || echo '')"
  if [[ -z "${DB_CONTAINER}" ]]; then
    log_warn "PostgreSQL container not running; skipping database backup"
  else
    DB_NAME="${POSTGRES_DB:-pokerbot}"
    DB_USER="${POSTGRES_USER:-pokerbot}"
    DB_BACKUP="${BACKUP_PATH}/postgres_${DB_NAME}_${TIMESTAMP}.sql"
    
    if docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${DB_BACKUP}"; then
      log_success "Database backed up to: ${DB_BACKUP}"
      
      # Compress backup
      if command -v gzip >/dev/null 2>&1; then
        gzip "${DB_BACKUP}"
        log_info "Compressed backup: ${DB_BACKUP}.gz"
      fi
    else
      log_error "Failed to backup database"
      exit 1
    fi
  fi
fi

# Backup Redis data
if [[ "${DB_ONLY}" == "false" ]]; then
  log_info "Backing up Redis data..."
  
  REDIS_CONTAINER="$(compose ps -q redis 2>/dev/null || echo '')"
  if [[ -z "${REDIS_CONTAINER}" ]]; then
    log_warn "Redis container not running; skipping Redis backup"
  else
    # Trigger Redis save
    if docker exec "${REDIS_CONTAINER}" redis-cli SAVE >/dev/null 2>&1; then
      # Copy RDB file
      REDIS_BACKUP="${BACKUP_PATH}/redis_dump_${TIMESTAMP}.rdb"
      if docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${REDIS_BACKUP}" 2>/dev/null; then
        log_success "Redis data backed up to: ${REDIS_BACKUP}"
      else
        log_warn "Failed to copy Redis RDB file"
      fi
    else
      log_warn "Failed to trigger Redis SAVE"
    fi
  fi
fi

# Create backup manifest
cat > "${BACKUP_PATH}/manifest.txt" <<EOF
PokerBot Backup
===============
Timestamp: ${TIMESTAMP}
Date: $(date)
Git Branch: $(git -C "${REPO_ROOT}" branch --show-current 2>/dev/null || echo "unknown")
Git Commit: $(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown")

Backup Contents:
EOF

ls -lh "${BACKUP_PATH}" >> "${BACKUP_PATH}/manifest.txt"

log_success "Backup completed successfully"
log_info "Backup location: ${BACKUP_PATH}"
log_info "Manifest: ${BACKUP_PATH}/manifest.txt"

# Cleanup old backups (keep last N backups, configurable via BACKUP_RETENTION)
BACKUP_RETENTION="${BACKUP_RETENTION:-10}"
BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name "backup_*" | wc -l)
if (( BACKUP_COUNT > BACKUP_RETENTION )); then
  log_info "Cleaning up old backups (keeping last ${BACKUP_RETENTION})..."
  find "${BACKUP_DIR}" -maxdepth 1 -type d -name "backup_*" | sort | head -n -"${BACKUP_RETENTION}" | xargs rm -rf
  log_info "Cleaned up $((BACKUP_COUNT - BACKUP_RETENTION)) old backup(s)"
fi
