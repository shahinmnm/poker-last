#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="main"   # اگر master داری تغییر بده

# این سه مقدار باید قبل از اجرای اسکریپت از طرف Copilot داده شده باشند
: "${BRANCH_NAME:?BRANCH_NAME is required}"
: "${PR_TITLE:?PR_TITLE is required}"
PR_BODY="${PR_BODY:-$PR_TITLE}"

echo "=== auto-pr-core ==="
echo "Base branch : $BASE_BRANCH"
echo "Branch name : $BRANCH_NAME"
echo "PR title    : $PR_TITLE"
echo

# چک ابزارها
if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not found in PATH"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh (GitHub CLI) not found"
  exit 1
fi

# 0) چک اینکه چیزی برای commit هست
if [[ -z "$(git status --porcelain)" ]]; then
  echo "No changes to commit. Exiting."
  exit 0
fi

# 1) sync با main
git fetch origin
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH"

# 2) ساخت برنچ جدید
git checkout -b "$BRANCH_NAME"

# 3) دوباره چک تغییرات
if [[ -z "$(git status --porcelain)" ]]; then
  echo "No changes detected after branch switch."
  exit 0
fi

# 4) Commit
git add -A
git commit -m "$PR_TITLE"

# 5) Push
git push -u origin "$BRANCH_NAME"

# 6) ساخت PR
gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH_NAME" \
  --title "$PR_TITLE" \
  --body "$PR_BODY"

echo "PR created. Attempting auto-merge..."

# 7) Auto-merge
gh pr merge "$BRANCH_NAME" --squash --auto || {
  echo "Auto-merge could not be completed (maybe waiting checks)."
}

echo "✅ Done."
