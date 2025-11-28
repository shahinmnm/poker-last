#!/usr/bin/env bash
set -euo pipefail

# تنظیمات پایه
DEFAULT_BASE_BRANCH="main"   # اگر master داری اینو عوض کن
DEFAULT_COMMIT_MSG="chore: auto update"

# ورودی‌ها:
# $1 = نام برنچ (اختیاری)
# $2 = پیام کامیت (اختیاری)
# $3 = عنوان PR (اختیاری)

BRANCH_NAME="${1:-}"
COMMIT_MSG="${2:-$DEFAULT_COMMIT_MSG}"
PR_TITLE="${3:-}"

# اگر برنچ نام داده نشده، خودکار بساز
if [[ -z "$BRANCH_NAME" ]]; then
  TS="$(date +'%Y%m%d-%H%M%S')"
  BRANCH_NAME="auto/${TS}"
fi

# اگر عنوان PR خالی بود، از پیام کامیت استفاده کن
if [[ -z "$PR_TITLE" ]]; then
  PR_TITLE="$COMMIT_MSG"
fi

echo "=== Auto PR Script ==="
echo "Base branch : $DEFAULT_BASE_BRANCH"
echo "New branch  : $BRANCH_NAME"
echo "Commit msg  : $COMMIT_MSG"
echo "PR title    : $PR_TITLE"
echo

# 1) مطمئن شو روی برنچ اصلی آپدیت هستی
git fetch origin
git checkout "$DEFAULT_BASE_BRANCH"
git pull --ff-only origin "$DEFAULT_BASE_BRANCH"

# 2) برنچ جدید بساز از روی main
git checkout -b "$BRANCH_NAME"

# 3) چک کن چیزی برای commit وجود دارد یا نه
if [[ -z "$(git status --porcelain)" ]]; then
  echo "No changes to commit. Aborting."
  exit 1
fi

# 4) همه تغییرات را add + commit کن
git add -A
git commit -m "$COMMIT_MSG"

# 5) برنچ را push کن
git push -u origin "$BRANCH_NAME"

# 6) Pull Request بساز با GitHub CLI
gh pr create \
  --base "$DEFAULT_BASE_BRANCH" \
  --head "$BRANCH_NAME" \
  --title "$PR_TITLE" \
  --body "$COMMIT_MSG"

echo
echo "✅ Done. Pull Request created."
