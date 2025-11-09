#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
SKIP_PULL=false

usage() {
  cat <<'USAGE'
Bootstrap the PokerBot stack on a fresh server.

Usage:
  first-deploy.sh [--with-nginx] [--skip-pull]

Options:
  --with-nginx   Start the nginx profile alongside core services.
  --skip-pull    Skip pulling base images before building.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx)
      WITH_NGINX=true
      shift
      ;;
    --skip-pull)
      SKIP_PULL=true
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

log_info "PokerBot first-time deployment"
log_info "Repository root: ${REPO_ROOT}"

ensure_command git
ensure_command docker
ensure_env_file

if [[ "${SKIP_PULL}" == "false" ]]; then
  log_info "Pulling latest upstream images (if any)"
  compose pull || log_warn "Pull failed; continuing with local build"
fi

log_info "Building application images"
if [[ "${SKIP_PULL}" == "false" ]]; then
  compose build --pull
else
  compose build
fi

log_info "Starting data services (postgres, redis)"
compose up -d postgres redis

run_migrations

log_info "Starting application services"
if [[ "${WITH_NGINX}" == "true" ]]; then
  compose up -d --remove-orphans --profile nginx
else
  compose up -d --remove-orphans
fi

log_success "Deployment complete"
log_info "Check service status with: docker compose --project-directory \"${REPO_ROOT}\" ps"
log_info "Follow logs with: docker compose --project-directory \"${REPO_ROOT}\" logs -f"
