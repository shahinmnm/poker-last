#!/usr/bin/env bash

set -euo pipefail

###############################################################################
# PokerBot Deployment Helper
#
# Responsibilities:
#   - Optionally update the git repo to the latest upstream commit
#   - Stop running containers
#   - Optionally prune unused Docker resources
#   - Rebuild images (optionally pulling newer base images)
#   - Restart services (optionally including nginx profile)
#
# Relies on lib/common.sh for:
#   - REPO_ROOT
#   - compose, log_info, log_warn, log_error, log_success
#   - ensure_command, ensure_env_file, load_env_file, check_worktree_clean
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
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
Simplified PokerBot redeploy: update git (optional), stop containers, prune unused
Docker resources (optional), rebuild, and restart.

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
    --with-nginx) WITH_NGINX=true ;;
    --skip-pull) SKIP_PULL=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --skip-migrations) SKIP_MIGRATIONS=true ;;
    --prune-images) PRUNE_IMAGES=true ;;
    --skip-cleanup) SKIP_CLEANUP=true ;;
    --skip-log-cleanup) SKIP_LOG_CLEANUP=true ;;
    --prune-volumes) PRUNE_VOLUMES=true ;;
    -h|--help) usage; exit 0 ;;
    *)
      log_error "Unknown option: $1"
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

ensure_command git
ensure_command docker
ensure_env_file
load_env_file
backup_env_file
check_worktree_clean

REMOTE=${DEPLOY_GIT_REMOTE:-origin}
BRANCH=${DEPLOY_GIT_BRANCH:-main}

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

log_info "Fetching updates from ${REMOTE}/${BRANCH}"
git -C "${REPO_ROOT}" fetch "${REMOTE}" "${BRANCH}"

if ! git -C "${REPO_ROOT}" rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
  log_info "Creating local branch ${BRANCH}"
  git -C "${REPO_ROOT}" checkout -B "${BRANCH}" "${REMOTE}/${BRANCH}"
else
  git -C "${REPO_ROOT}" checkout "${BRANCH}"
  git -C "${REPO_ROOT}" reset --hard "${REMOTE}/${BRANCH}"
fi

log_success "Repository updated to ${REMOTE}/${BRANCH}"

if [[ "${SKIP_PULL}" == "false" ]]; then
  log_info "Pulling latest upstream images"
  compose pull || log_warn "Pull failed; continuing"
fi

if [[ "${SKIP_BUILD}" == "false" ]]; then
  log_info "Building images"
  if [[ "${SKIP_PULL}" == "false" ]]; then
    compose build --pull
  else
    compose build
  fi
}

start_services() {
  log_step "Starting services"
  if [[ "${WITH_NGINX}" == "true" ]]; then
    compose up -d --remove-orphans --profile nginx
  else
    compose up -d --remove-orphans
  fi
}

show_summary() {
  log_success "Deployment refreshed"
  log_info "Active services:"
  compose ps
  log_disk_usage "Disk usage after restart"
}

update_repository() {
  if [[ "${SKIP_GIT_UPDATE}" == "true" ]]; then
    log_info "Skipping git update (--no-git)"
    return
  fi

  # Ensure DEPLOY_GIT_REMOTE/DEPLOY_GIT_BRANCH defaults are available before
  # checking git state so we can heal detached HEAD deployments automatically.
  load_env_file

  local deploy_remote="${DEPLOY_GIT_REMOTE:-origin}"
  local deploy_branch="${DEPLOY_GIT_BRANCH:-gamecore}"

  log_step "Updating git repository"

  if [[ "${ALLOW_DIRTY_WORKTREE}" == "true" ]]; then
    log_warn "Skipping clean worktree check (--allow-dirty)"
  else
    check_worktree_clean
  fi

  local current_branch upstream_remote upstream_merge_ref upstream_branch upstream_ref

  current_branch="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD)"

  if [[ "${current_branch}" == "HEAD" ]]; then
    log_warn "Repository is in a detached HEAD state."
    log_info "Checking out '${deploy_branch}' so deployments track a branch."

    if git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${deploy_branch}"; then
      git -C "${REPO_ROOT}" checkout "${deploy_branch}"
    else
      log_info "Creating local '${deploy_branch}' from ${deploy_remote}/${deploy_branch}"
      git -C "${REPO_ROOT}" fetch --prune "${deploy_remote}"
      git -C "${REPO_ROOT}" checkout -b "${deploy_branch}" "${deploy_remote}/${deploy_branch}"
    fi

    current_branch="${deploy_branch}"
  fi

  upstream_remote="$(git -C "${REPO_ROOT}" config --get "branch.${current_branch}.remote" 2>/dev/null || true)"
  upstream_merge_ref="$(git -C "${REPO_ROOT}" config --get "branch.${current_branch}.merge" 2>/dev/null || true)"

  if [[ -z "${upstream_remote}" || -z "${upstream_merge_ref}" ]]; then
    log_warn "No upstream configured for branch '${current_branch}'. Configuring tracking."
    git -C "${REPO_ROOT}" branch --set-upstream-to="${deploy_remote}/${deploy_branch}" "${current_branch}"
    upstream_remote="${deploy_remote}"
    upstream_merge_ref="refs/heads/${deploy_branch}"
  fi

  upstream_branch="${upstream_merge_ref#refs/heads/}"
  upstream_ref="${upstream_remote}/${upstream_branch}"

  log_info "Current branch       : ${current_branch}"
  log_info "Tracking upstream    : ${upstream_ref}"

  log_info "Fetching latest changes from ${upstream_remote}"
  git -C "${REPO_ROOT}" fetch --prune "${upstream_remote}"

  log_info "Fast-forwarding '${current_branch}' to '${upstream_ref}'"
  if git -C "${REPO_ROOT}" merge --ff-only "${upstream_ref}"; then
    log_success "Repository updated to latest ${upstream_ref}"
  else
    log_error "Unable to fast-forward '${current_branch}'. Resolve manually and rerun."
    exit 1
  fi
}

log_step() {
  # Simple wrapper for consistent step logging
  local msg="$1"
  log_info ""
  log_info "────────────────────────────────────────────────────────"
  log_info "▶ ${msg}"
  log_info "────────────────────────────────────────────────────────"
}

main() {
  parse_args "$@"

  log_info "========================================================"
  log_info " PokerBot update started"
  log_info "  - with_nginx   : ${WITH_NGINX}"
  log_info "  - skip_prune   : ${SKIP_PRUNE}"
  log_info "  - pull_images  : ${PULL_BASE_IMAGES}"
  log_info "  - skip_git     : ${SKIP_GIT_UPDATE}"
  log_info "  - allow_dirty  : ${ALLOW_DIRTY_WORKTREE}"
  log_info "========================================================"

  update_repository
  prepare_environment

  log_disk_usage "Disk usage before restart"

  stop_services
  prune_docker_resources
  build_images
  run_migrations
else
  log_warn "Skipping migrations as requested"
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
