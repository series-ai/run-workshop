#!/usr/bin/env bash
#
# Secret scanner for run-workshop.
#
# Single source of truth shared by:
#   - the local pre-commit hook (.githooks/pre-commit)
#   - the CI backstop (.github/workflows/secret-scan.yml)
#
# Usage:
#   scripts/secret-scan.sh [file ...]
#
# With file arguments, only those files are scanned (used by the pre-commit
# hook for staged files). With no arguments, every git-tracked file is scanned
# (used by CI).
#
# Exits non-zero if any likely secret is found. To suppress a confirmed false
# positive, append "secret-scan: allow" to the offending line.

set -euo pipefail

# Detection patterns, declared as "Human label::ERE regex" so behavior is driven
# by this table rather than branching logic. Value suffixes are deliberately long
# so prose that mentions a prefix (e.g. "block rk_ keys") does not match.
PATTERNS=(
  "RUN per-game API key (rk_)::rk_[A-Za-z0-9]{6,}_[A-Za-z0-9]{24,}"
  "Publishable key (pk_)::pk_(live|test)_[A-Za-z0-9]{16,}"
  "Generic pk_ key::pk_[A-Za-z0-9]{24,}"
  "OpenAI key (sk-)::sk-[A-Za-z0-9_-]{20,}"
  "Generic sk_ key::sk_[A-Za-z0-9]{24,}"
  "Google API key::AIza[0-9A-Za-z_-]{35}"
  "AWS access key id::AKIA[0-9A-Z]{16}"
  "GitHub token::gh[pousr]_[A-Za-z0-9]{36,}"
  "GitHub fine-grained PAT::github_pat_[A-Za-z0-9_]{60,}"
  "Slack token::xox[baprs]-[A-Za-z0-9-]{10,}"
  "Private key block::-----BEGIN [A-Z ]*PRIVATE KEY-----"
  "Generic credential assignment::(API[_-]?KEY|SECRET|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|PASSWORD)[\"' ]*[:=][\"' ]*[A-Za-z0-9/+_-]{16,}"
)

# Files that legitimately contain key-shaped regex literals. Excluding them keeps
# the scanner from flagging its own pattern table.
EXCLUDES=(
  "scripts/secret-scan.sh"
  ".githooks/pre-commit"
)

is_excluded() {
  local candidate="$1"
  local ex
  for ex in "${EXCLUDES[@]}"; do
    [ "$candidate" = "$ex" ] && return 0
  done
  return 1
}

findings=0
scanned=0

scan_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  is_excluded "$file" && return 0
  # Skip binary files; -I makes grep treat binary as non-matching.
  if ! grep -Iq . "$file" 2>/dev/null; then
    return 0
  fi
  scanned=$((scanned + 1))

  local entry label regex nums n
  for entry in "${PATTERNS[@]}"; do
    label="${entry%%::*}"
    regex="${entry#*::}"
    # Report line numbers only — never echo matched content into logs.
    nums="$(grep -nIE -- "$regex" "$file" 2>/dev/null | grep -v 'secret-scan: allow' | cut -d: -f1 || true)"
    for n in $nums; do
      printf '  %s:%s  [%s]\n' "$file" "$n" "$label" >&2
      findings=$((findings + 1))
    done
  done
}

files=()
if [ "$#" -gt 0 ]; then
  files=("$@")
else
  while IFS= read -r f; do
    [ -n "$f" ] && files+=("$f")
  done < <(git ls-files)
fi

for file in "${files[@]}"; do
  scan_file "$file"
done

if [ "$findings" -gt 0 ]; then
  {
    echo ""
    echo "Secret scan blocked: $findings likely secret(s) found in the files above."
    echo "Remove the secret (use .env, which is gitignored, or a CI secret)."
    echo "If a match is a confirmed false positive, append '  # secret-scan: allow' to that line."
  } >&2
  exit 1
fi

echo "Secret scan passed ($scanned file(s) checked)."
