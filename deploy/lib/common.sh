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

reset_postgres_password() {
  log_info "Resetting PostgreSQL password to match .env configuration"
  
  load_env_file
  
  # Extract password from DATABASE_URL if available, otherwise use POSTGRES_PASSWORD
  local new_password
  if [[ -n "${DATABASE_URL:-}" ]]; then
    # Extract password from postgresql+asyncpg://user:password@host:port/db
    if [[ "${DATABASE_URL}" =~ postgresql\+?[^:]*://([^:]+):([^@]+)@ ]]; then
      new_password="${BASH_REMATCH[2]}"
      # URL decode the password (basic decoding for common cases)
      # Note: This is a simple implementation. For full URL decoding, use a proper tool.
      new_password="${new_password//%2F//}"
      new_password="${new_password//%40/@}"
      new_password="${new_password//%3A/:}"
    else
      log_error "Could not parse password from DATABASE_URL"
      return 1
    fi
  else
    new_password="${POSTGRES_PASSWORD:-changeme}"
  fi
  
  local db_user="${POSTGRES_USER:-pokerbot}"
  local postgres_password="${POSTGRES_PASSWORD:-changeme}"
  
  # Check if postgres container is running
  if ! docker ps --format '{{.Names}}' | grep -q "^pokerbot_postgres$"; then
    log_error "PostgreSQL container is not running"
    return 1
  fi
  
  # Reset password using docker exec (connect as postgres superuser)
  # Try without password first (trust auth for local connections)
  log_info "Updating password for user '${db_user}'"
  
  # Escape single quotes in password for SQL
  local escaped_password="${new_password//\'/\'\'}"
  
  # Try connecting to postgres database (default database)
  if docker exec pokerbot_postgres psql -U postgres -d postgres -c "ALTER USER ${db_user} WITH PASSWORD '${escaped_password}';" >/dev/null 2>&1; then
    log_success "Password reset successfully"
    return 0
  fi
  
  # Try with POSTGRES_PASSWORD as PGPASSWORD
  if PGPASSWORD="${postgres_password}" docker exec -e PGPASSWORD="${postgres_password}" pokerbot_postgres psql -U postgres -d postgres -c "ALTER USER ${db_user} WITH PASSWORD '${escaped_password}';" >/dev/null 2>&1; then
    log_success "Password reset successfully"
    return 0
  fi
  
  # If both fail, provide manual instructions
  log_error "Failed to reset password automatically. You may need to manually reset it."
  log_info "Try running one of these commands:"
  log_info "  docker exec -it pokerbot_postgres psql -U postgres -c \"ALTER USER ${db_user} WITH PASSWORD '${new_password}';\""
  log_info "  Or if that requires a password:"
  log_info "  PGPASSWORD=<current_postgres_password> docker exec -e PGPASSWORD=<current_postgres_password> pokerbot_postgres psql -U postgres -c \"ALTER USER ${db_user} WITH PASSWORD '${new_password}';\""
  return 1
}

run_migrations() {
  log_info "Running database migrations"
  
  # Try running migrations first
  if compose --profile ops run --rm migrations; then
    return 0
  fi
  
  # If migrations failed, check if it's a password error
  local exit_code=$?
  if [[ ${exit_code} -ne 0 ]]; then
    log_warn "Migrations failed. Checking if password reset is needed..."
    
    # Try to reset password and retry
    if reset_postgres_password; then
      log_info "Retrying migrations after password reset"
      if compose --profile ops run --rm migrations; then
        return 0
      else
        local retry_exit_code=$?
        log_error "Migrations still failed after password reset (exit code: ${retry_exit_code})"
        return ${retry_exit_code}
      fi
    else
      log_error "Failed to reset password. Please check your database configuration."
      return ${exit_code}
    fi
  fi
}

check_worktree_clean() {
  if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain)" ]]; then
    log_error "Repository has uncommitted changes. Commit, stash, or clean the worktree before deploying."
    exit 1
  fi
}

_init_compose_bin
