#!/usr/bin/env bash

set -euo pipefail

###############################################################################
# PokerBot Logs Helper
#
# View and follow logs from running containers.
#
# Usage:
#   ./logs.sh [service_name] [options]
#
# Examples:
#   ./logs.sh              # Show all logs
#   ./logs.sh backend      # Show backend logs
#   ./logs.sh -f           # Follow all logs
#   ./logs.sh backend -f   # Follow backend logs
#   ./logs.sh --tail=50    # Show last 50 lines
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

SERVICE=""
COMPOSE_ARGS=()

usage() {
  cat <<'USAGE'
View and follow logs from PokerBot containers.

Usage:
  logs.sh [service_name] [options]

Services:
  backend         FastAPI backend API
  telegram-bot    Telegram bot service
  frontend        React frontend
  postgres        PostgreSQL database
  redis           Redis cache
  nginx           Nginx reverse proxy
  (no service)    All services

Options:
  -f, --follow        Follow log output (like tail -f)
  -t, --tail=N        Show last N lines (default: all)
  --since=TIMESTAMP   Show logs since timestamp (e.g., 2023-01-01T00:00:00)
  --until=TIMESTAMP   Show logs until timestamp
  -h, --help          Show this help message

Examples:
  logs.sh                    # Show all logs
  logs.sh backend            # Show backend logs only
  logs.sh -f                 # Follow all logs
  logs.sh backend -f         # Follow backend logs
  logs.sh --tail=100         # Last 100 lines from all services
  logs.sh backend --tail=50  # Last 50 lines from backend
  logs.sh --since=1h         # Logs from last hour
USAGE
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    backend|telegram-bot|frontend|postgres|redis|nginx|migrations)
      SERVICE="$1"
      shift
      ;;
    -f|--follow)
      COMPOSE_ARGS+=("--follow")
      shift
      ;;
    -t|--tail)
      COMPOSE_ARGS+=("--tail" "$2")
      shift 2
      ;;
    --tail=*)
      COMPOSE_ARGS+=("--tail" "${1#*=}")
      shift
      ;;
    --since)
      COMPOSE_ARGS+=("--since" "$2")
      shift 2
      ;;
    --since=*)
      COMPOSE_ARGS+=("--since" "${1#*=}")
      shift
      ;;
    --until)
      COMPOSE_ARGS+=("--until" "$2")
      shift 2
      ;;
    --until=*)
      COMPOSE_ARGS+=("--until" "${1#*=}")
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option or service: $1"
      usage
      exit 1
      ;;
  esac
done

ensure_command docker
ensure_env_file
load_env_file

log_info "Viewing logs for: ${SERVICE:-all services}"

# Execute docker compose logs
if [[ -n "${SERVICE}" ]]; then
  compose logs "${COMPOSE_ARGS[@]}" "${SERVICE}"
else
  compose logs "${COMPOSE_ARGS[@]}"
fi
