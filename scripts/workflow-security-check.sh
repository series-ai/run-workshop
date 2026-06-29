#!/usr/bin/env bash
#
# Static checks for GitHub Actions workflow safety and action pinning.
#
# Usage:
#   scripts/workflow-security-check.sh [file ...]
#
# With file arguments, only those files are scanned. With no arguments, every
# workflow under .github/workflows/ is scanned.
#
# Exit codes:
#   0 - pass (warnings may still be printed)
#   1 - blocking findings

set -euo pipefail

WORKFLOW_DIR=".github/workflows"
SHA_PIN_RE='@[0-9a-f]{40}$'

failures=0
warnings=0

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  failures=$((failures + 1))
}

warn() {
  printf 'WARNING: %s\n' "$1" >&2
  warnings=$((warnings + 1))
}

is_workflow_file() {
  local file="$1"
  [[ "$file" == "$WORKFLOW_DIR/"* ]] || return 1
  [[ "$file" == *.yml || "$file" == *.yaml ]]
}

scan_workflow_file() {
  local file="$1"
  local line_num=0
  local line

  while IFS= read -r line || [ -n "$line" ]; do
    line_num=$((line_num + 1))

    if [[ "$line" =~ pull_request_target ]]; then
      fail "$file:$line_num: pull_request_target runs with base-repo privileges; use pull_request or workflow_dispatch instead"
    fi

    if [[ "$line" =~ ^[[:space:]]*uses:[[:space:]]+ ]]; then
      local ref="${line#*:}"
      ref="$(printf '%s' "$ref" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//')"

      if [[ "$ref" == ./* ]]; then
        warn "$file:$line_num: local action $ref cannot be SHA-pinned; review manually"
        continue
      fi

      if [[ "$ref" == docker://* ]]; then
        warn "$file:$line_num: docker image $ref is not SHA-pinned; pin by digest when possible"
        continue
      fi

      if [[ "$ref" =~ $SHA_PIN_RE ]]; then
        continue
      fi

      fail "$file:$line_num: action $ref is not pinned to a full commit SHA (use owner/repo@<40-char-sha> # tag)"
    fi

    if [[ "$line" =~ runs-on:[[:space:]]+ubuntu-latest ]]; then
      warn "$file:$line_num: ubuntu-latest drifts over time; prefer a fixed runner such as ubuntu-24.04"
    fi
  done <"$file"
}

files=()
if [ "$#" -gt 0 ]; then
  for file in "$@"; do
    if is_workflow_file "$file"; then
      files+=("$file")
    fi
  done
else
  while IFS= read -r f; do
    [ -n "$f" ] && files+=("$f")
  done < <(find "$WORKFLOW_DIR" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "Workflow security check passed (no workflow files to scan)."
  exit 0
fi

for file in "${files[@]}"; do
  [ -f "$file" ] || continue
  scan_workflow_file "$file"
done

if [ "$warnings" -gt 0 ]; then
  printf '\nWorkflow security check: %s warning(s).\n' "$warnings" >&2
fi

if [ "$failures" -gt 0 ]; then
  printf '\nWorkflow security check blocked: %s error(s).\n' "$failures" >&2
  exit 1
fi

echo "Workflow security check passed (${#files[@]} workflow file(s), $warnings warning(s))."
