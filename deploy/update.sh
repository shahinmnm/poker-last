#!/usr/bin/env bash

set -euo pipefail

###############################################################################
# PokerBot incremental updater
# - Builds backend from current local source (never pulls images)
# - Rebuilds only when backend code or deps change (checksum-driven)
# - Keeps dependency layers cached; trims cache only when requested
# - Shows before/after main.py fingerprints from inside the API container
# - Optional fast log cleanup; never touches database volumes
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

export DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1}
export COMPOSE_DOCKER_CLI_BUILD=${COMPOSE_DOCKER_CLI_BUILD:-1}

WITH_NGINX=false
SKIP_MIGRATIONS=false
SKIP_GIT_SYNC=false
FORCE_BACKEND_BUILD=false
PURGE_BACKEND_CACHE=false
TRIM_BUILD_CACHE=false
CLEAN_LOGS=false

LOG_SIZE_THRESHOLD="${LOG_SIZE_THRESHOLD:-100M}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
STATE_DIR="${STATE_DIR:-${REPO_ROOT}/deploy/.state}"
API_CONTAINER_NAME="${API_CONTAINER_NAME:-pokerbot_api}"
BACKEND_IMAGE_REF="${BACKEND_IMAGE_REF:-pokerbot/backend:latest}"

usage() {
  cat <<'USAGE'
Incremental PokerBot updater (backend-first, zero pulls).

Usage: ./update.sh [options]

Options:
  --with-nginx            Start/refresh nginx profile too.
  --skip-migrations       Do not run Alembic migrations.
  --skip-git              Keep current working tree (no fetch/reset).
  --force-backend-build   Rebuild backend even if checksums match.
  --purge-backend-cache   Drop backend images/dangling layers before rebuilding.
  --trim-build-cache      Run docker builder prune for unused layers after build.
  --clean-logs            Truncate oversized Docker json logs (>LOG_SIZE_THRESHOLD).
  --log-threshold <SIZE>  Override log truncate threshold (default: 100M).
  -h, --help              Show this help and exit.

Rules enforced:
  - No docker compose pull and no --pull on builds.
  - Backend rebuilds only when telegram_poker_bot/api/** or bot/** (or deps) change.
  - Database volumes are never pruned.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx)          WITH_NGINX=true ;;
    --skip-migrations)     SKIP_MIGRATIONS=true ;;
    --skip-git)            SKIP_GIT_SYNC=true ;;
    --force-backend-build) FORCE_BACKEND_BUILD=true ;;
    --purge-backend-cache) PURGE_BACKEND_CACHE=true ;;
    --trim-build-cache)    TRIM_BUILD_CACHE=true ;;
    --clean-logs)          CLEAN_LOGS=true ;;
    --log-threshold)
      shift
      LOG_SIZE_THRESHOLD="${1:-}"
      if [[ -z "${LOG_SIZE_THRESHOLD}" ]]; then
        echo "Missing value for --log-threshold" >&2
        exit 1
      fi
      ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

read_hash_file() {
  local path="$1"
  [[ -f "${path}" ]] && cat "${path}" || echo ""
}

write_hash_file() {
  local path="$1"
  local value="$2"
  printf '%s\n' "${value}" > "${path}"
}

hash_paths() {
  local paths=("$@")
  if (( ${#paths[@]} == 0 )); then
    echo ""
    return 0
  fi
  (
    cd "${REPO_ROOT}"
    find "${paths[@]}" \
      \( -path '*/__pycache__/*' -o -path '*/node_modules/*' -o -path '*/dist/*' -o -name '*.pyc' \) -prune -o \
      -type f -print0 |
      LC_ALL=C sort -z |
      xargs -0 sha256sum |
      sha256sum |
      awk '{print $1}'
  )
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

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -Fxq "$1"
}

container_main_fingerprints() {
  local when="$1"
  if ! docker inspect -f '{{.State.Running}}' "${API_CONTAINER_NAME}" >/dev/null 2>&1; then
    if container_exists "${API_CONTAINER_NAME}"; then
      log_info "API container present but not running; skipping ${when} fingerprint"
    else
      log_info "API container not found; skipping ${when} fingerprint"
    fi
    return 0
  fi

  local output
  if output=$(docker exec "${API_CONTAINER_NAME}" sh -c 'for f in /opt/app/telegram_poker_bot/api/main.py /opt/app/telegram_poker_bot/bot/main.py; do if [ -f "$f" ]; then sha256sum "$f"; fi; done' 2>/dev/null); then
    log_info "API container main.py (${when}):"
    while IFS= read -r line; do
      [[ -n "${line}" ]] && log_info "  ${line}"
    done <<<"${output}"
  else
    log_warn "Unable to read main.py from ${API_CONTAINER_NAME} (${when})"
  fi
}

local_main_fingerprints() {
  log_info "Local main.py fingerprints:"
  for file in telegram_poker_bot/api/main.py telegram_poker_bot/bot/main.py; do
    if [[ -f "${REPO_ROOT}/${file}" ]]; then
      log_info "  $(cd "${REPO_ROOT}" && sha256sum "${file}")"
    else
      log_warn "  ${file} not found locally"
    fi
  done
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
  log_info "Truncating ${#log_files[@]} Docker log file(s) larger than ${LOG_SIZE_THRESHOLD}"
  for log_file in "${log_files[@]}"; do
    truncate -s 0 "${log_file}" 2>/dev/null || log_warn "Unable to truncate ${log_file}"
  done
}

git_sync() {
  local remote="${DEPLOY_GIT_REMOTE:-origin}"
  local branch="${DEPLOY_GIT_BRANCH:-main}"

  if ! git -C "${REPO_ROOT}" remote get-url "${remote}" >/dev/null 2>&1; then
    log_error "Git remote '${remote}' is not configured. Update DEPLOY_GIT_REMOTE or add the remote."
    exit 1
  fi

  local before after
  before="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "none")"
  log_info "Syncing git branch ${remote}/${branch}"
  git -C "${REPO_ROOT}" fetch "${remote}" "${branch}"
  if git -C "${REPO_ROOT}" rev-parse --verify "${branch}" >/dev/null 2>&1; then
    git -C "${REPO_ROOT}" checkout -f "${branch}"
  else
    git -C "${REPO_ROOT}" checkout -f -b "${branch}" FETCH_HEAD
  fi
  git -C "${REPO_ROOT}" reset --hard FETCH_HEAD
  after="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
  log_info "Repository at ${after} (was ${before})"
}

purge_backend_image_cache() {
  log_warn "Purging backend image cache (backend-only layers)"
  mapfile -t backend_refs < <(docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' --filter=reference='pokerbot/backend*' | sort -u)
  if (( ${#backend_refs[@]} == 0 )); then
    log_info "No backend images to purge"
    return
  fi
  for ref in "${backend_refs[@]}"; do
    local tag id
    tag="$(awk '{print $1}' <<<"${ref}")"
    id="$(awk '{print $2}' <<<"${ref}")"
    if docker ps --format '{{.Image}}' | grep -Fxq "${tag}"; then
      log_info "Keeping in-use backend image ${tag}"
      continue
    fi
    if docker image rm "${id}" >/dev/null 2>&1; then
      log_info "Removed backend image ${tag} (${id})"
    else
      log_warn "Unable to remove backend image ${tag}; it may still be referenced"
    fi
  done
  # Remove dangling layers created by previous backend builds without touching base/system layers.
  docker image prune -f --filter "dangling=true" >/dev/null || true
}

maybe_prune_builder_cache() {
  if [[ "${TRIM_BUILD_CACHE}" == "true" ]]; then
    log_info "Pruning unused build cache (docker builder prune)"
    docker builder prune -f --filter type=regular --filter unused-for=24h >/dev/null || log_warn "Builder prune skipped or failed"
  fi
}

wait_for_container() {
  local name="$1"
  local retries=20
  local delay=0.5
  for ((i=0; i<retries; i++)); do
    if docker inspect -f '{{.State.Running}}' "${name}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

ensure_command git docker
ensure_env_file
load_env_file
backup_env_file
mkdir -p "${STATE_DIR}"

log_info "Starting incremental update (no pulls, cache-aware)"

if [[ "${SKIP_GIT_SYNC}" == "false" ]]; then
  git_sync
else
  log_info "Skipping git fetch/reset (--skip-git)"
fi

container_main_fingerprints "before"

# Compute fingerprints to drive rebuild decisions
API_HASH=$(hash_paths telegram_poker_bot/api)
BOT_HASH=$(hash_paths telegram_poker_bot/bot)
BACKEND_SUPPORT_HASH=$(hash_paths telegram_poker_bot/config telegram_poker_bot/engine_adapter telegram_poker_bot/game_core telegram_poker_bot/shared telegram_poker_bot/scripts telegram_poker_bot/alembic.ini telegram_poker_bot/migrations)
BACKEND_REQ_HASH=$(hash_paths telegram_poker_bot/requirements.runtime.txt telegram_poker_bot/requirements.txt docker/app.Dockerfile setup.py pokerkit)
FRONTEND_HASH=$(hash_paths telegram_poker_bot/frontend docker/frontend.Dockerfile)

PREV_API_HASH=$(read_hash_file "${STATE_DIR}/backend_api.sha")
PREV_BOT_HASH=$(read_hash_file "${STATE_DIR}/backend_bot.sha")
PREV_SUPPORT_HASH=$(read_hash_file "${STATE_DIR}/backend_support.sha")
PREV_REQ_HASH=$(read_hash_file "${STATE_DIR}/backend_req.sha")
PREV_FRONTEND_HASH=$(read_hash_file "${STATE_DIR}/frontend.sha")

log_info "Backend source fingerprint:"
log_info "  api:     ${API_HASH}"
log_info "  bot:     ${BOT_HASH}"
log_info "  support: ${BACKEND_SUPPORT_HASH}"
log_info "  deps:    ${BACKEND_REQ_HASH}"
log_info "Frontend fingerprint:"
log_info "  ${FRONTEND_HASH}"
local_main_fingerprints

CURRENT_BACKEND_IMAGE_ID=$(docker image inspect -f '{{.Id}}' "${BACKEND_IMAGE_REF}" 2>/dev/null || echo "")
BACKEND_BUILD_NEEDED=false
BACKEND_REASONS=()
DEPS_CHANGED=false

if [[ -z "${CURRENT_BACKEND_IMAGE_ID}" ]]; then
  BACKEND_BUILD_NEEDED=true
  BACKEND_REASONS+=("backend image missing")
fi
if [[ "${API_HASH}" != "${PREV_API_HASH}" ]]; then
  BACKEND_BUILD_NEEDED=true
  BACKEND_REASONS+=("api code changed")
fi
if [[ "${BOT_HASH}" != "${PREV_BOT_HASH}" ]]; then
  BACKEND_BUILD_NEEDED=true
  BACKEND_REASONS+=("bot code changed")
fi
if [[ "${BACKEND_SUPPORT_HASH}" != "${PREV_SUPPORT_HASH}" ]]; then
  BACKEND_BUILD_NEEDED=true
  BACKEND_REASONS+=("shared backend code changed")
fi
if [[ "${BACKEND_REQ_HASH}" != "${PREV_REQ_HASH}" ]]; then
  BACKEND_BUILD_NEEDED=true
  DEPS_CHANGED=true
  BACKEND_REASONS+=("backend requirements changed")
fi
if [[ "${FORCE_BACKEND_BUILD}" == "true" ]]; then
  BACKEND_BUILD_NEEDED=true
  BACKEND_REASONS+=("forced rebuild requested")
fi
if [[ "${PURGE_BACKEND_CACHE}" == "true" ]]; then
  BACKEND_BUILD_NEEDED=true
  BACKEND_REASONS+=("cache purge requested")
fi

FRONTEND_BUILD_NEEDED=false
if [[ -z "${PREV_FRONTEND_HASH}" || "${FRONTEND_HASH}" != "${PREV_FRONTEND_HASH}" ]]; then
  FRONTEND_BUILD_NEEDED=true
fi

if [[ "${BACKEND_BUILD_NEEDED}" == "true" ]]; then
  log_info "Backend rebuild required: ${BACKEND_REASONS[*]}"
  if [[ "${DEPS_CHANGED}" == "true" ]]; then
    log_info "Backend dependencies changed; pip layers will be refreshed"
  else
    log_info "Backend dependencies unchanged; cached dependency layers will be reused"
  fi
else
  log_info "Backend build not needed (checksums match and image present)"
fi

if [[ "${FRONTEND_BUILD_NEEDED}" == "true" ]]; then
  log_info "Frontend build required (source changed or first run)"
else
  log_info "Frontend build skipped (fingerprint unchanged)"
fi

if [[ "${CLEAN_LOGS}" == "true" ]]; then
  truncate_docker_logs
else
  log_info "Skipping Docker log truncation (--clean-logs not set)"
fi

if [[ "${PURGE_BACKEND_CACHE}" == "true" ]]; then
  purge_backend_image_cache
fi

# Build images that actually need work (parallel where possible, no pulls)
BUILD_TARGETS=()
if [[ "${BACKEND_BUILD_NEEDED}" == "true" ]]; then
  BUILD_TARGETS+=("migrations" "bot" "api")
fi
if [[ "${FRONTEND_BUILD_NEEDED}" == "true" ]]; then
  BUILD_TARGETS+=("frontend")
fi

if (( ${#BUILD_TARGETS[@]} > 0 )); then
  log_info "Building services: ${BUILD_TARGETS[*]}"
  compose build --parallel "${BUILD_TARGETS[@]}"
  maybe_prune_builder_cache
else
  log_info "No builds triggered; reusing cached images"
fi

if [[ "${SKIP_MIGRATIONS}" == "false" ]]; then
  run_migrations
else
  log_warn "Skipping migrations (--skip-migrations)"
fi

# Start core dependencies without recreation; recreate backend only when rebuilt.
compose up -d postgres redis

if [[ "${BACKEND_BUILD_NEEDED}" == "true" ]]; then
  log_info "Refreshing backend containers with new image"
  compose up -d --no-deps --force-recreate api bot
else
  log_info "Backend build skipped; ensuring backend containers are up"
  compose up -d --no-deps api bot
fi

if [[ "${FRONTEND_BUILD_NEEDED}" == "true" ]]; then
  log_info "Refreshing frontend container"
  compose up -d --no-deps --force-recreate frontend
else
  compose up -d --no-deps frontend
fi

if [[ "${WITH_NGINX}" == "true" ]]; then
  compose up -d --no-deps --profile nginx nginx
fi

# Save state fingerprints after successful build/restart
write_hash_file "${STATE_DIR}/backend_api.sha" "${API_HASH}"
write_hash_file "${STATE_DIR}/backend_bot.sha" "${BOT_HASH}"
write_hash_file "${STATE_DIR}/backend_support.sha" "${BACKEND_SUPPORT_HASH}"
write_hash_file "${STATE_DIR}/backend_req.sha" "${BACKEND_REQ_HASH}"
write_hash_file "${STATE_DIR}/frontend.sha" "${FRONTEND_HASH}"

if [[ "${BACKEND_BUILD_NEEDED}" == "true" ]]; then
  NEW_BACKEND_IMAGE_ID=$(docker image inspect -f '{{.Id}}' "${BACKEND_IMAGE_REF}" 2>/dev/null || echo "")
  log_info "Backend image id: ${NEW_BACKEND_IMAGE_ID}"
fi

if wait_for_container "${API_CONTAINER_NAME}"; then
  container_main_fingerprints "after"
  API_IMAGE_ID=$(docker inspect -f '{{.Image}}' "${API_CONTAINER_NAME}" 2>/dev/null || echo "")
  BACKEND_IMAGE_ID=$(docker image inspect -f '{{.Id}}' "${BACKEND_IMAGE_REF}" 2>/dev/null || echo "")
  if [[ -n "${API_IMAGE_ID}" && -n "${BACKEND_IMAGE_ID}" ]]; then
    if [[ "${API_IMAGE_ID}" == "${BACKEND_IMAGE_ID}" ]]; then
      log_success "API container is running the freshly built backend image"
    else
      log_warn "API container image (${API_IMAGE_ID}) differs from backend image (${BACKEND_IMAGE_ID})"
    fi
  fi
else
  log_warn "API container did not reach running state in time; inspect manually"
fi

log_success "Update complete"
compose ps
