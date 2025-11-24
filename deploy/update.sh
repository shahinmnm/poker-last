#!/usr/bin/env bash

set -euo pipefail
###############################################################################
# PokerBot Deployment Helper (force mode)
#
# - Reads DEPLOY_GIT_BRANCH from .env (e.g. main, gamecore, etc.)
# - Forces local repo to match remote branch (ignores dirty changes)
# - Stops containers, prunes Docker garbage, rebuilds, restarts
#
# Requires lib/common.sh to define:
#   REPO_ROOT, ENV_FILE
#   compose, log_info, log_warn, log_error, log_success
#   ensure_command, ensure_env_file, load_env_file, check_worktree_clean
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
SKIP_PULL=false
SKIP_BUILD=false
SKIP_MIGRATIONS=false
PRUNE_IMAGES=false
SKIP_CLEANUP=false
PRUNE_VOLUMES=false
SKIP_LOG_CLEANUP=false

LOG_SIZE_THRESHOLD="${LOG_SIZE_THRESHOLD:-100M}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"

usage() {
  cat <<'USAGE'
Simplified PokerBot redeploy: force-update git (branch from .env), stop containers,
prune unused Docker resources (optional), rebuild, and restart.

Usage:
  ./update.sh [options]

Options:
  --with-nginx         Include the nginx profile when restarting services.
  --skip-pull          Skip docker compose pull.
  --skip-build         Skip docker compose build.
  --skip-migrations    Skip running Alembic migrations.
  --prune-images       Remove all unused images (docker image prune -af).
  --skip-cleanup       Skip Docker cleanup and log truncation steps.
  --skip-log-cleanup   Skip truncating oversized Docker log files.
  --prune-volumes      Remove unused Docker volumes (may delete persistent data).
  -h, --help           Show this help message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx)       WITH_NGINX=true ;;
    --skip-pull)        SKIP_PULL=true ;;
    --skip-build)       SKIP_BUILD=true ;;
    --skip-migrations)  SKIP_MIGRATIONS=true ;;
    --prune-images)     PRUNE_IMAGES=true ;;
    --skip-cleanup)     SKIP_CLEANUP=true ;;
    --skip-log-cleanup) SKIP_LOG_CLEANUP=true ;;
    --prune-volumes)    PRUNE_VOLUMES=true ;;
    -h|--help)          usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

log_disk_usage() {
  local label="$1"
  local usage
  usage="$(df -h / | awk 'NR==2 {print $3 " used of " $2 " (" $5 ")"}')"
  log_info "${label}: ${usage}"
}

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

cleanup_docker_resources() {
  log_info "Cleaning up unused Docker resources"

  if docker container prune -f >/dev/null; then
    log_info "Removed unused containers"
  else
    log_warn "Failed to prune containers"
  fi

  if docker network prune -f >/dev/null; then
    log_info "Removed unused networks"
  else
    log_warn "Failed to prune networks"
  fi

  if [[ "${PRUNE_IMAGES}" == "true" ]]; then
    if docker image prune -af >/dev/null; then
      log_info "Removed unused images (including unreferenced layers)"
    else
      log_warn "Failed to prune unused images"
    fi
  else
    if docker image prune -f >/dev/null; then
      log_info "Removed dangling images"
    else
      log_warn "Failed to prune dangling images"
    fi
  fi

  if [[ "${PRUNE_VOLUMES}" == "true" ]]; then
    log_warn "Pruning unused volumes; ensure persistent data is backed up"
    if docker volume prune -f >/dev/null; then
      log_info "Removed unused volumes"
    else
      log_warn "Failed to prune volumes"
    fi
  else
    log_info "Skipping volume prune; pass --prune-volumes to enable (may delete persistent data)"
  fi

  if docker builder prune -af >/dev/null; then
    log_info "Cleared Docker build cache"
  else
    log_warn "Failed to clear Docker build cache"
  fi
}

truncate_docker_logs() {
  local log_dir="/var/lib/docker/containers"
  if [[ ! -d "${log_dir}" ]]; then
    log_info "Docker log directory ${log_dir} not found; skipping log cleanup"
    return
  fi

  mapfile -t log_files < <(find "${log_dir}" -type f -name "*.log" -size +"${LOG_SIZE_THRESHOLD}" -print 2>/dev/null)
  if (( ${#log_files[@]} == 0 )); then
    log_info "No Docker logs larger than ${LOG_SIZE_THRESHOLD}"
    return
  fi

  local total_size truncated=0
  total_size="$(du -ch "${log_files[@]}" 2>/dev/null | tail -1 | awk '{print $1}')"
  log_info "Truncating ${#log_files[@]} Docker log file(s) larger than ${LOG_SIZE_THRESHOLD} (approx. ${total_size})"

  for log_file in "${log_files[@]}"; do
    if truncate -s 0 "${log_file}" 2>/dev/null; then
      truncated=$((truncated + 1))
    else
      log_warn "Unable to truncate ${log_file}; insufficient permissions?"
    fi
  done

  log_info "Truncated ${truncated}/${#log_files[@]} Docker log file(s)"
}

###############################################################################
# Main deployment flow
###############################################################################

ensure_command git
ensure_command docker
ensure_env_file
load_env_file
backup_env_file

# We don't block on dirty worktree; we force-reset anyway
check_worktree_clean || true

REMOTE=${DEPLOY_GIT_REMOTE:-origin}
BRANCH=${DEPLOY_GIT_BRANCH:-main}   # set in .env (e.g. main or gamecore)

if ! git -C "${REPO_ROOT}" remote get-url "${REMOTE}" >/dev/null 2>&1; then
  log_error "Git remote '${REMOTE}' is not configured. Update DEPLOY_GIT_REMOTE or add the remote."
  exit 1
fi

log_disk_usage "Disk usage before stopping services"

log_info "Stopping running services"
if ! compose down --remove-orphans; then
  log_warn "docker compose down failed; continuing with deployment"
fi

if [[ "${SKIP_CLEANUP}" == "false" ]]; then
  cleanup_docker_resources
  if [[ "${SKIP_LOG_CLEANUP}" == "false" ]]; then
    truncate_docker_logs
  else
    log_info "Skipping Docker log cleanup (--skip-log-cleanup)"
  fi
  log_disk_usage "Disk usage after Docker cleanup"
else
  log_info "Skipping Docker cleanup (--skip-cleanup)"
fi

###############################################################################
# Git force update (supports main/gamecore/etc via DEPLOY_GIT_BRANCH)
###############################################################################

log_info "Fetching updates from ${REMOTE}/${BRANCH}"
git -C "${REPO_ROOT}" fetch "${REMOTE}" "${BRANCH}"

# Force-local branch to exactly fetched commit using FETCH_HEAD (avoids origin/BRANCH issues)
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

###############################################################################
# Docker build & restart
###############################################################################

if [[ "${SKIP_PULL}" == "false" ]]; then
  log_info "Pulling latest upstream images"
  compose pull || log_warn "Pull failed; continuing"
else
  log_info "Skipping docker compose pull (--skip-pull)"
fi

if [[ "${SKIP_BUILD}" == "false" ]]; then
  log_info "Building images"
  if [[ "${SKIP_PULL}" == "false" ]]; then
    compose build --pull
  else
    compose build
  fi
else
  log_info "Skipping docker compose build (--skip-build)"
fi

if [[ "${SKIP_MIGRATIONS}" == "false" ]]; then
  run_migrations
else
  log_warn "Skipping migrations as requested (--skip-migrations)"
fi

log_info "Restarting services"
if [[ "${WITH_NGINX}" == "true" ]]; then
  compose up -d --remove-orphans --profile nginx
else
  compose up -d --remove-orphans
fi

log_success "Deployment updated successfully"
log_info "Active services:"
compose ps
log_disk_usage "Disk usage after deployment"
