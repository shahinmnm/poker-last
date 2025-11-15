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
SKIP_PRUNE=false
PULL_BASE_IMAGES=true
SKIP_GIT_UPDATE=false
ALLOW_DIRTY_WORKTREE=false

usage() {
  cat <<'USAGE'
Simplified PokerBot redeploy: update git (optional), stop containers, prune unused
Docker resources (optional), rebuild, and restart.

Usage:
  ./update.sh [options]

Options:
    --with-nginx      Include the nginx profile when starting services.
    --skip-prune      Skip 'docker system prune'.
    --no-pull         Do not pull newer base images during the build.
    --no-git          Skip updating the local git checkout.
    --allow-dirty     Skip enforcing a clean git worktree before updating.
    -h, --help        Show this help message.

Examples:
  ./update.sh --with-nginx
  ./update.sh --no-git --skip-prune
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
  log_step "Preparing environment"
  ensure_command docker git
  ensure_env_file
  load_env_file
}

stop_services() {
  log_step "Stopping running services"
  if ! compose down --remove-orphans; then
    log_warn "docker compose down reported an error; continuing"
  fi
}

prune_docker_resources() {
  if [[ "${SKIP_PRUNE}" == "true" ]]; then
    log_info "Skipping Docker prune (--skip-prune)"
    return
  fi

  log_step "Pruning unused Docker resources"
  if docker system prune -af; then
    log_info "Docker resources pruned"
  else
    log_warn "docker system prune failed; continuing"
  fi
}

build_images() {
  log_step "Building Docker images"
  if [[ "${PULL_BASE_IMAGES}" == "true" ]]; then
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
  start_services
  show_summary
}

main "$@"
