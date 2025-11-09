#!/usr/bin/env bash

set -euo pipefail

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
REMOTE=""
BRANCH=""

usage() {
  cat <<'USAGE'
Update the PokerBot deployment from the configured Git branch and redeploy the stack.

Usage:
  update.sh [options]

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

parse_args() {
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
}

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

docker_prune() {
  local success_message="$1"
  local failure_message="$2"
  shift 2

  if "$@" >/dev/null; then
    log_info "${success_message}"
  else
    log_warn "${failure_message}"
  fi
}

cleanup_docker_resources() {
  log_info "Cleaning up unused Docker resources"

  docker_prune "Removed unused containers" "Failed to prune containers" docker container prune -f
  docker_prune "Removed unused networks" "Failed to prune networks" docker network prune -f

  if [[ "${PRUNE_IMAGES}" == "true" ]]; then
    docker_prune "Removed unused images (including unreferenced layers)" "Failed to prune unused images" docker image prune -af
  else
    docker_prune "Removed dangling images" "Failed to prune dangling images" docker image prune -f
  fi

  if [[ "${PRUNE_VOLUMES}" == "true" ]]; then
    log_warn "Pruning unused volumes; ensure persistent data is backed up"
    docker_prune "Removed unused volumes" "Failed to prune volumes" docker volume prune -f
  else
    log_info "Skipping volume prune; pass --prune-volumes to enable (may delete persistent data)"
  fi

  docker_prune "Cleared Docker build cache" "Failed to clear Docker build cache" docker builder prune -af
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

prepare_environment() {
  ensure_command git
  ensure_command docker
  ensure_env_file
  load_env_file
  backup_env_file
  check_worktree_clean
}

ensure_remote_exists() {
  if ! git -C "${REPO_ROOT}" remote get-url "${REMOTE}" >/dev/null 2>&1; then
    log_error "Git remote '${REMOTE}' is not configured. Update DEPLOY_GIT_REMOTE or add the remote."
    exit 1
  fi
}

stop_services() {
  log_info "Stopping running services"
  if ! compose down --remove-orphans; then
    log_warn "docker compose down failed; continuing with deployment"
  fi
}

maybe_cleanup() {
  if [[ "${SKIP_CLEANUP}" == "true" ]]; then
    log_info "Skipping Docker cleanup (--skip-cleanup)"
    return
  fi

  cleanup_docker_resources

  if [[ "${SKIP_LOG_CLEANUP}" == "true" ]]; then
    log_info "Skipping Docker log cleanup (--skip-log-cleanup)"
  else
    truncate_docker_logs
  fi

  log_disk_usage "Disk usage after Docker cleanup"
}

update_repository() {
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
}

pull_images() {
  if [[ "${SKIP_PULL}" == "true" ]]; then
    log_info "Skipping docker compose pull (--skip-pull)"
    return
  fi

  log_info "Pulling latest upstream images"
  compose pull || log_warn "Pull failed; continuing"
}

build_images() {
  if [[ "${SKIP_BUILD}" == "true" ]]; then
    log_info "Skipping docker compose build (--skip-build)"
    return
  fi

  log_info "Building images"
  if [[ "${SKIP_PULL}" == "false" ]]; then
    compose build --pull
  else
    compose build
  fi
}

run_migrations_if_needed() {
  if [[ "${SKIP_MIGRATIONS}" == "true" ]]; then
    log_warn "Skipping migrations as requested"
    return
  fi

  run_migrations
}

restart_services() {
  log_info "Restarting services"
  if [[ "${WITH_NGINX}" == "true" ]]; then
    compose up -d --remove-orphans --profile nginx
  else
    compose up -d --remove-orphans
  fi
}

post_deploy_summary() {
  log_success "Deployment updated successfully"
  log_info "Active services:"
  compose ps
  log_disk_usage "Disk usage after deployment"
}

main() {
  prepare_environment

  REMOTE=${DEPLOY_GIT_REMOTE:-origin}
  BRANCH=${DEPLOY_GIT_BRANCH:-main}
  ensure_remote_exists

  log_disk_usage "Disk usage before stopping services"
  stop_services
  maybe_cleanup

  update_repository
  pull_images
  build_images
  run_migrations_if_needed
  restart_services
  post_deploy_summary
}

parse_args "$@"
main
