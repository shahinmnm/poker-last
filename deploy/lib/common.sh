#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${LIB_DIR}/../.." && pwd)"

readonly LIB_DIR
readonly REPO_ROOT
readonly ENV_FILE="${REPO_ROOT}/.env"

COMPOSE_BIN=()
COMPOSE_USES_PROJECT_DIR=false

_log() {
  local level="$1"
  shift
  local message="$*"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  if [[ "${level}" == "ERROR" ]]; then
    printf '%s [%s] %s\n' "${ts}" "${level}" "${message}" >&2
  else
    printf '%s [%s] %s\n' "${ts}" "${level}" "${message}"
  fi
}

log_info() {
  _log INFO "$@"
}

log_warn() {
  _log WARN "$@"
}

log_error() {
  _log ERROR "$@"
}

log_success() {
  _log SUCCESS "$@"
}

ensure_command() {
  local missing=()
  for cmd in "$@"; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
      missing+=("${cmd}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log_error "Missing required command(s): ${missing[*]}"
    exit 1
  fi
}

ensure_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log_error "Missing ${ENV_FILE}. Copy .env.example and configure it before deploying."
    exit 1
  fi
}

load_env_file() {
  ensure_env_file

  local allexport_was_on=false
  if [[ "$(set -o | grep '^allexport')" =~ [[:space:]]on$ ]]; then
    allexport_was_on=true
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  if [[ "${allexport_was_on}" == "false" ]]; then
    set +a
  fi
}

_init_compose_bin() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN=(docker compose)
    COMPOSE_USES_PROJECT_DIR=true
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN=(docker-compose)
    log_warn "Falling back to legacy docker-compose binary. Consider installing the Docker Compose plugin."
  else
    log_error "Docker Compose is not available. Install the Docker Compose plugin or docker-compose binary."
    exit 1
  fi
}

compose() {
  if [[ "${COMPOSE_USES_PROJECT_DIR}" == "true" ]]; then
    "${COMPOSE_BIN[@]}" --project-directory "${REPO_ROOT}" "$@"
  else
    (cd "${REPO_ROOT}" && "${COMPOSE_BIN[@]}" "$@")
  fi
}

run_migrations() {
  log_info "Running database migrations"
  compose run --rm migrations
}

check_worktree_clean() {
  if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain)" ]]; then
    log_error "Repository has uncommitted changes. Commit, stash, or clean the worktree before deploying."
    exit 1
  fi
}

_init_compose_bin
