#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
DOCKER_SHOULD_PRUNE=false
PULL_BASE_IMAGES=false

usage() {
  cat <<'USAGE'
Simplified PokerBot redeploy: stop containers, prune unused Docker resources, rebuild, and restart.

Usage:
  update.sh [options]

Options:
  --with-nginx   Include the nginx profile when starting services.
  --prune        Run docker system prune before rebuilding.
  --pull         Pull newer base images during the build.
  --no-pull      Do not pull newer base images during the build (default).
  -h, --help     Show this help message.
USAGE
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --with-nginx)
        WITH_NGINX=true
        ;;
      --prune)
        DOCKER_SHOULD_PRUNE=true
        ;;
      --skip-prune)
        log_warn "--skip-prune is deprecated; skipping prune is now the default."
        DOCKER_SHOULD_PRUNE=false
        ;;
      --pull)
        PULL_BASE_IMAGES=true
        ;;
      --no-pull)
        PULL_BASE_IMAGES=false
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
  ensure_command docker
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
  if [[ "${DOCKER_SHOULD_PRUNE}" != "true" ]]; then
    log_info "Skipping Docker prune (default)"
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

main() {
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
