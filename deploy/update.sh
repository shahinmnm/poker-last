#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# PokerBot — Ultimate Deterministic Rebuild Update Script (v3)
# نویسنده: GapGPT مخصوص شاهیـــــــــن
#
# هدف:
#   - همیشه سورس جدید وارد ایمیج شود (Zero chance برای کد قدیمی)
#   - بدون docker compose pull
#   - بدون build های خراب incremental
#   - با کش سیستم (apt/base) ولی بدون کش سورس backend
#   - تمیز، امن، بدون حذف volumeهای داده
#
# رفتار کلی:
#   1) وضعیت git → force reset به آخرین نسخه remote
#   2) توقف کامل سرویس‌ها
#   3) cleanup انتخابی
#   4) build backend با "--no-cache" برای سرویس‌های api و bot
#   5) build عادی برای frontend
#   6) migrations
#   7) restart deterministic
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

WITH_NGINX=false
SKIP_MIGRATIONS=false
SKIP_GIT_SYNC=false
PURGE_IMAGES=false

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
LOG_SIZE_THRESHOLD="${LOG_SIZE_THRESHOLD:-100M}"

usage() {
  cat <<'EOF'
Ultimate deterministic updater for PokerBot.

Options:
  --with-nginx         Include nginx profile.
  --skip-migrations    Skip Alembic migrations.
  --skip-git           Do not fetch/reset repo.
  --purge-images       Remove unused Docker images before rebuilding.
  -h, --help           Show help.

Behaviors:
  - No docker compose pull ever.
  - Always deterministic rebuild of backend (api, bot) with --no-cache.
  - Safe: DB volumes not touched.
  - Guaranteed latest backend code in container.
EOF
}

# --- Parse Args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx)      WITH_NGINX=true ;;
    --skip-migrations) SKIP_MIGRATIONS=true ;;
    --skip-git)        SKIP_GIT_SYNC=true ;;
    --purge-images)    PURGE_IMAGES=true ;;
    -h|--help)         usage; exit 0 ;;
    *)
      echo "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

# --- Ensure prerequisites ---
ensure_command git docker
ensure_env_file
load_env_file

# --- Backup .env ---
timestamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"
cp "${ENV_FILE}" "${BACKUP_DIR}/.env.backup.${timestamp}" || true
log_info "Backup saved to ${BACKUP_DIR}/.env.backup.${timestamp}"

# --- Git synchronization ---
if [[ "${SKIP_GIT_SYNC}" == false ]]; then
  REMOTE="${DEPLOY_GIT_REMOTE:-origin}"
  BRANCH="${DEPLOY_GIT_BRANCH:-main}"
  log_info "Fetching latest code from ${REMOTE}/${BRANCH}"
  git -C "${REPO_ROOT}" fetch "${REMOTE}" "${BRANCH}"
  git -C "${REPO_ROOT}" checkout -f "${BRANCH}" || git -C "${REPO_ROOT}" checkout -f -b "${BRANCH}" FETCH_HEAD
  git -C "${REPO_ROOT}" reset --hard FETCH_HEAD
  log_success "Repo synced to latest ${REMOTE}/${BRANCH}"
else
  log_warn "Skipping git sync (--skip-git)"
fi

# --- Stop services ---
log_info "Stopping all services"
compose down --remove-orphans || true

# --- Optional cleanup ---
if [[ "${PURGE_IMAGES}" == true ]]; then
  log_warn "Purging unused images (slow)"
  docker image prune -af || true
fi

# --- Build backend deterministically ---
log_info "Rebuilding backend with --no-cache (api, bot, migrations)"
compose build --no-cache api bot migrations

# --- Build frontend (cached allowed) ---
log_info "Building frontend (cached allowed)"
compose build frontend

# --- Run migrations ---
if [[ "${SKIP_MIGRATIONS}" == false ]]; then
  log_info "Running migrations"
  run_migrations
else
  log_warn "Skipping migrations (--skip-migrations)"
fi

# --- Restart everything ---
log_info "Restarting full stack"
if [[ "${WITH_NGINX}" == true ]]; then
  compose up -d --remove-orphans --profile nginx
else
  compose up -d --remove-orphans
fi

log_success "Deployment updated successfully"
compose ps
