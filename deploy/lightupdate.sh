#!/usr/bin/env bash

set -euo pipefail
###############################################################################
# PokerBot Light Update Helper
#
# A fast deployment helper intended for small code changes that don't require
# pulling new base images, rebuilding containers, or updating libraries.
#
# Default behavior (fast):
# - Backup .env
# - Stop running services
# - Fetch latest git for configured branch and hard-reset
# - Restart services using existing images (no pull, no build)
#
# Optional flags:
# --with-nginx       include nginx profile when restarting
# --migrations       run database migrations after update (may slow down)
# --prune-images     prune unused Docker images (optional, slower)
# -h, --help         show help
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
RUN_MIGRATIONS=false
PRUNE_IMAGES=false

LOG_SIZE_THRESHOLD="${LOG_SIZE_THRESHOLD:-100M}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"

backup_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log_warn "Environment file ${ENV_FILE} not found; skipping backup"
    return
  fi

  local timestamp backup_path
  timestamp="$(date +%Y%m%d_%H%M%S)"

  if ! mkdir -p "${BACKUP_DIR}"; then
    log_warn "Unable to create backup directory ${BACKUP_DIR}; skipping environment backup"
    return
  fi

  backup_path="${BACKUP_DIR}/.env.backup.${timestamp}"
  if cp "${ENV_FILE}" "${backup_path}"; then
    log_info "Backed up environment file to ${backup_path}"
  else
    log_warn "Failed to back up environment file to ${backup_path}"
  fi
}

usage() {
  cat <<'USAGE'
Light update: quickly redeploy code changes without pulling or rebuilding images.

Usage:
  ./lightupdate.sh [options]

Options:
  --with-nginx       Include the nginx profile when restarting services.
  --migrations       Run Alembic migrations after updating (may block until DB ready).
  --prune-images     Prune unused Docker images (optional, slower).
  -h, --help         Show this help message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx)       WITH_NGINX=true ;;
    --migrations)       RUN_MIGRATIONS=true ;;
    --prune-images)     PRUNE_IMAGES=true ;;
    -h|--help)          usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

log_info "Starting light update (fast path)"

ensure_command git
ensure_command docker
ensure_env_file
load_env_file
backup_env_file

# Force-reset local repo to remote branch (branch set in .env via DEPLOY_GIT_BRANCH)
REMOTE=${DEPLOY_GIT_REMOTE:-origin}
BRANCH=${DEPLOY_GIT_BRANCH:-main}

if ! git -C "${REPO_ROOT}" remote get-url "${REMOTE}" >/dev/null 2>&1; then
  log_error "Git remote '${REMOTE}' is not configured. Update DEPLOY_GIT_REMOTE or add the remote."
  exit 1
fi

check_worktree_clean || true

log_info "Fetching updates from ${REMOTE}/${BRANCH}"
git -C "${REPO_ROOT}" fetch "${REMOTE}" "${BRANCH}"

if git -C "${REPO_ROOT}" rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
  log_info "Checking out existing local branch ${BRANCH} (force)"
  git -C "${REPO_ROOT}" checkout -f "${BRANCH}"
else
  log_info "Creating local branch ${BRANCH} from FETCH_HEAD (force)"
  git -C "${REPO_ROOT}" checkout -f -b "${BRANCH}" FETCH_HEAD
fi

log_info "Hard-resetting ${BRANCH} to fetched commit"
git -C "${REPO_ROOT}" reset --hard FETCH_HEAD
log_success "Repository forced to ${REMOTE}/${BRANCH}"

# If requested, optionally prune images (slow)
if [[ "${PRUNE_IMAGES}" == "true" ]]; then
  log_warn "Pruning unused Docker images (this may take time)"
  if docker image prune -af >/dev/null; then
    log_info "Pruned unused images"
  else
    log_warn "Failed to prune images"
  fi
fi

log_info "Stopping running services"
if ! compose down --remove-orphans; then
  log_warn "docker compose down failed; continuing with restart attempt"
fi

# Skip pull/build: restart with existing images
log_info "Restarting services (using existing images)"
if [[ "${WITH_NGINX}" == "true" ]]; then
  compose up -d --remove-orphans --profile nginx
else
  compose up -d --remove-orphans
fi

if [[ "${RUN_MIGRATIONS}" == "true" ]]; then
  log_info "Running migrations (requested)"
  run_migrations || log_warn "Migrations failed or timed out"
else
  log_info "Skipping migrations (fast path)"
fi

log_success "Light update complete"
compose ps
