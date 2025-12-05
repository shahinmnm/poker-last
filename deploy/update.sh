#!/usr/bin/env bash
set -euo pipefail

###############################################################################
#            ██████╗  ██████╗ ██╗  ██╗███████╗██████╗ ████████╗
#            ██╔══██╗██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗╚══██╔══╝
#            ██████╔╝██║   ██║█████╔╝ █████╗  ██████╔╝   ██║
#            ██╔═══╝ ██║   ██║██╔═██╗ ██╔══╝  ██╔══██╗   ██║
#            ██║     ╚██████╔╝██║  ██╗███████╗██║  ██║   ██║
#            ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝
#
# PokerBot Full Deployment Script (Final Clean Edition)
#
# 1) FULL CLEANUP (containers, networks, images, cache, logs)
# 2) Git force update (reset to remote)
# 3) Optional: pull images
# 4) Build backend fresh (no-cache when desired)
# 5) Run migrations
# 6) Restart stack
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
SKIP_PULL=false
SKIP_BUILD=false
SKIP_MIGRATIONS=false
PRUNE_IMAGES=false
PRUNE_VOLUMES=false
SKIP_LOG_CLEANUP=false
SKIP_CLEANUP=false     # master switch

LOG_SIZE_THRESHOLD="${LOG_SIZE_THRESHOLD:-200M}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"

###############################################################################
# CLI OPTIONS
###############################################################################
usage() {
  cat <<EOF
Usage: ./update.sh [options]

Options:
  --with-nginx         Restart including nginx profile
  --skip-pull          Skip docker compose pull
  --skip-build         Skip docker compose build
  --skip-migrations    Skip alembic migrations
  --prune-images       Remove ALL unused images (slow)
  --prune-volumes      Remove unused volumes (dangerous)
  --skip-cleanup       Skip initial Docker cleanup steps
  --skip-log-cleanup   Skip large log truncation
  -h, --help           Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx)       WITH_NGINX=true ;;
    --skip-pull)        SKIP_PULL=true ;;
    --skip-build)       SKIP_BUILD=true ;;
    --skip-migrations)  SKIP_MIGRATIONS=true ;;
    --prune-images)     PRUNE_IMAGES=true ;;
    --prune-volumes)    PRUNE_VOLUMES=true ;;
    --skip-cleanup)     SKIP_CLEANUP=true ;;
    --skip-log-cleanup) SKIP_LOG_CLEANUP=true ;;
    -h|--help)          usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

###############################################################################
# UI HELPERS
###############################################################################
green() { printf "\033[1;32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[1;33m%s\033[0m\n" "$1"; }
blue() { printf "\033[1;34m%s\033[0m\n" "$1"; }
red() { printf "\033[1;31m%s\033[0m\n" "$1"; }

hr() { echo "-----------------------------------------------------------------------"; }

section() {
  hr
  blue "▶ $1"
  hr
}

###############################################################################
# SYSTEM CHECKS & ENV
###############################################################################
ensure_command git
ensure_command docker
ensure_env_file
load_env_file

REMOTE=${DEPLOY_GIT_REMOTE:-origin}
BRANCH=${DEPLOY_GIT_BRANCH:-main}

###############################################################################
# BACKUP .ENV
###############################################################################
section "Backing up .env"

timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}"
cp "${ENV_FILE}" "${BACKUP_DIR}/.env.backup.${timestamp}" && \
  green "✔ Environment backed up" || yellow "⚠ Failed to back up .env"

###############################################################################
# CLEANUP (FIRST THING)
###############################################################################
if [[ "${SKIP_CLEANUP}" == "false" ]]; then
  section "Docker Cleanup (Initial)"

  yellow "Removing unused containers..."
  docker container prune -f >/dev/null || true

  yellow "Removing unused networks..."
  docker network prune -f >/dev/null || true

  if [[ "${PRUNE_IMAGES}" == "true" ]]; then
    yellow "Pruning ALL unused images (may take time)..."
    docker image prune -af >/dev/null || true
  else
    yellow "Removing dangling images..."
    docker image prune -f >/dev/null || true
  fi

  if [[ "${PRUNE_VOLUMES}" == true ]]; then
    yellow "Pruning unused volumes (CAUTION)..."
    docker volume prune -f >/dev/null || true
  fi

  yellow "Pruning Docker build cache..."
  docker builder prune -af >/dev/null || true

  if [[ "${SKIP_LOG_CLEANUP}" == "false" ]]; then
    yellow "Truncating large Docker logs..."
    LOG_DIR="/var/lib/docker/containers"
    find "${LOG_DIR}" -type f -name "*.log" -size +"${LOG_SIZE_THRESHOLD}" -print0 | \
      while IFS= read -r -d '' file; do
        truncate -s 0 "$file" || true
      done
  fi

  green "✔ Cleanup complete"
else
  yellow "Skipping Docker cleanup (--skip-cleanup)"
fi

###############################################################################
# STOP SERVICES
###############################################################################
section "Stopping services"
compose down --remove-orphans || yellow "compose down failed; continuing"

###############################################################################
# GIT FORCE UPDATE
###############################################################################
section "Git force update (${REMOTE}/${BRANCH})"

git -C "${REPO_ROOT}" fetch "${REMOTE}" "${BRANCH}"

if git -C "${REPO_ROOT}" rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
  git -C "${REPO_ROOT}" checkout -f "${BRANCH}"
else
  git -C "${REPO_ROOT}" checkout -f -b "${BRANCH}" FETCH_HEAD
fi

git -C "${REPO_ROOT}" reset --hard FETCH_HEAD
green "✔ Repository synced with ${REMOTE}/${BRANCH}"

###############################################################################
# DOCKER BUILD & REDEPLOY
###############################################################################
section "Docker build"

if [[ "${SKIP_PULL}" == "false" ]]; then
  yellow "Pulling upstream images..."
  compose pull || yellow "Pull failed; continuing"
else
  yellow "Skipping pull (--skip-pull)"
fi

if [[ "${SKIP_BUILD}" == "false" ]]; then
  yellow "Building backend images..."
  if [[ "${SKIP_PULL}" == "false" ]]; then
    compose build --pull
  else
    compose build
  fi
else
  yellow "Skipping build (--skip-build)"
fi

###############################################################################
# RUN MIGRATIONS
###############################################################################
if [[ "${SKIP_MIGRATIONS}" == "false" ]]; then
  section "Running migrations"
  run_migrations
else
  yellow "Skipping migrations (--skip-migrations)"
fi

###############################################################################
# START SERVICES
###############################################################################
section "Starting services"

if [[ "${WITH_NGINX}" == "true" ]]; then
  compose up -d --remove-orphans --profile nginx
else
  compose up -d --remove-orphans
fi

green "✔ Deployment updated successfully!"
blue  "To check status: docker compose ps"

hr
