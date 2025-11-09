#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
SKIP_PULL=false
SKIP_BUILD=false
SKIP_MIGRATIONS=false
PRUNE_IMAGES=false

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
  --prune-images       Remove dangling images after deployment.
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
    -h|--help) usage; exit 0 ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

ensure_command git
ensure_command docker
ensure_env_file
check_worktree_clean

REMOTE=${DEPLOY_GIT_REMOTE:-origin}
BRANCH=${DEPLOY_GIT_BRANCH:-main}

if ! git -C "${REPO_ROOT}" remote get-url "${REMOTE}" >/dev/null 2>&1; then
  log_error "Git remote '${REMOTE}' is not configured. Update DEPLOY_GIT_REMOTE or add the remote."
  exit 1
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
fi

if [[ "${SKIP_MIGRATIONS}" == "false" ]]; then
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

if [[ "${PRUNE_IMAGES}" == "true" ]]; then
  log_info "Pruning dangling Docker images"
  docker image prune -f
fi

log_success "Deployment updated successfully"
log_info "Active services:"
compose ps
