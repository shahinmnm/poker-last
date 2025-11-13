#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
SKIP_PRUNE=false
PULL_BASE_IMAGES=true
SKIP_GIT_UPDATE=false
ALLOW_DIRTY_WORKTREE=false

usage() {
  cat <<'USAGE'
Simplified PokerBot redeploy: stop containers, prune unused Docker resources, rebuild, and restart.

Usage:
  update.sh [options]

Options:
    --with-nginx      Include the nginx profile when starting services.
    --skip-prune      Skip docker system prune.
    --no-pull         Do not pull newer base images during the build.
    --no-git          Skip updating the local git checkout.
    --allow-dirty     Skip enforcing a clean git worktree before updating.
    -h, --help        Show this help message.
USAGE
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --with-nginx)
        WITH_NGINX=true
        ;;
      --skip-prune)
        SKIP_PRUNE=true
        ;;
      --no-pull)
        PULL_BASE_IMAGES=false
        ;;
      --no-git)
        SKIP_GIT_UPDATE=true
        ;;
      --allow-dirty)
        ALLOW_DIRTY_WORKTREE=true
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
    shift
  done
}

log_disk_usage() {
  local label="$1"
  local usage
  usage="$(df -h / | awk 'NR==2 {print $3 " used of " $2 " (" $5 ")"}')"
  log_info "${label}: ${usage}"
}

prepare_environment() {
  ensure_command docker git
  ensure_env_file
  load_env_file
}

stop_services() {
  log_info "Stopping running services"
  if ! compose down --remove-orphans; then
    log_warn "docker compose down reported an error; continuing"
  fi
}

prune_docker_resources() {
  if [[ "${SKIP_PRUNE}" == "true" ]]; then
    log_info "Skipping Docker prune (--skip-prune)"
    return
  fi

  log_info "Pruning unused Docker resources"
  if docker system prune -af; then
    log_info "Docker resources pruned"
  else
    log_warn "Failed to prune Docker resources"
  fi
}

build_images() {
  log_info "Building Docker images"
  if [[ "${PULL_BASE_IMAGES}" == "true" ]]; then
    compose build --pull
  else
    compose build
  fi
}

start_services() {
  log_info "Starting services"
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

  ensure_command git
  if [[ "${ALLOW_DIRTY_WORKTREE}" == "true" ]]; then
    log_warn "Skipping clean worktree check (--allow-dirty)"
  else
    check_worktree_clean
  fi

  local current_branch upstream_ref
  current_branch="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD)"
  if ! upstream_ref="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref "${current_branch}@{upstream}" 2>/dev/null)"; then
    log_warn "No upstream configured for branch ${current_branch}. Skipping git update."
    return
  fi

  log_info "Fetching latest changes from remote"
  git -C "${REPO_ROOT}" fetch --prune

  log_info "Fast-forwarding ${current_branch} to ${upstream_ref}"
  if git -C "${REPO_ROOT}" merge --ff-only "${upstream_ref}"; then
    log_success "Repository updated to latest ${upstream_ref}"
  else
    log_error "Unable to fast-forward ${current_branch}. Resolve manually and rerun."
    exit 1
  fi
}

main() {
  update_repository
  prepare_environment
  log_disk_usage "Disk usage before restart"
  stop_services
  prune_docker_resources
  build_images
  start_services
  show_summary
}

parse_args "$@"
main
