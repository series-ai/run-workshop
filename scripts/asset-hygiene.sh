#!/usr/bin/env bash
#
# Asset-hygiene scanner for run-workshop.
#
# Catches the class of mistake that license/secret scanners cannot: third-party
# media that "snuck in" (e.g. competitor store screenshots saved as
# "unnamed (1).webp", or anything dumped into a reference/scratch folder).
# Image provenance is not machine-detectable, so this is a heuristic tripwire on
# the *signals around* such files: download-style filenames and scratch/reference
# locations.
#
# Usage:
#   scripts/asset-hygiene.sh [path ...]
#
# With path arguments, only those paths are checked (CI passes the PR's
# added/changed files). With no arguments, every git-tracked file is checked
# (CI backstop on main). Operates purely on path strings, so it is safe with Git
# LFS pointers and with files not present in the working tree.
#
# Exits non-zero if any path trips a rule. Intentional exceptions go in
# scripts/asset-hygiene-allowlist.txt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST_FILE="${SCRIPT_DIR}/asset-hygiene-allowlist.txt"

# Extensions whose provenance we cannot review from a diff. Only these are
# subject to the rules below; source/text files are ignored.
MEDIA_EXT="png|jpg|jpeg|gif|webp|avif|bmp|tiff|tif|tga|ico|icns|heic|heif|svg|svgz|psd|mp3|wav|ogg|flac|aac|m4a|aiff|aif|opus|mp4|mov|webm|mkv|avi|m4v|glb|gltf|fbx|obj|blend|usd|usdz|ttf|otf|woff|woff2|eot"

# Download/export filename smells, as "Label::ERE" matched against the lowercased
# basename. Data-driven so the policy lives in this table, not in branching.
NAME_PATTERNS=(
  "Browser download ('unnamed')::^unnamed([ _-][^.]*)?\.[a-z0-9]+$"
  "Browser duplicate ('(n)')::\([0-9]+\)\.[a-z0-9]+$"
  "Screenshot::^(screenshot|screen[ _-]shot)"
  "Camera/phone export (IMG/DSC/PXL)::^(img|dsc|dscn|pxl|mvimg)[ _-]?[0-9]{3,}"
  "Untitled export::^untitled([ _-][^.]*)?\.[a-z0-9]+$"
  "Generic 'download'::^download([ _-][^.]*)?\.[a-z0-9]+$"
  "Pasted image::^pasted[ _-]?image"
)

# Directories that are scratch/inspiration dumping grounds. Media committed here
# is flagged unless explicitly allowlisted (e.g. our own generation templates).
DIR_PATTERNS=(
  "Reference/scratch dir::(^|/)(references?|inspo|inspiration|scratch|temp|tmp|reference-dump|assets-dump)/"
)

# Load allowlist (path prefixes or globs; '#' comments and blank lines ignored).
ALLOW=()
if [ -f "$ALLOWLIST_FILE" ]; then
  while IFS= read -r line; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -n "$line" ] && ALLOW+=("$line")
  done < "$ALLOWLIST_FILE"
fi

is_allowed() {
  local path="$1" entry
  for entry in "${ALLOW[@]}"; do
    # shellcheck disable=SC2053
    [[ "$path" == $entry ]] && return 0      # exact or glob match
    [[ "$path" == "$entry"* ]] && return 0   # directory-prefix match
  done
  return 1
}

to_lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

is_media() {
  local lower
  lower="$(to_lower "$1")"
  [[ "$lower" =~ \.($MEDIA_EXT)$ ]]
}

findings=0
checked=0

check_path() {
  local path="$1"
  is_media "$path" || return 0
  checked=$((checked + 1))
  is_allowed "$path" && return 0

  local base="${path##*/}"
  local lower
  lower="$(to_lower "$base")"
  local entry label regex

  for entry in "${NAME_PATTERNS[@]}"; do
    label="${entry%%::*}"
    regex="${entry#*::}"
    if [[ "$lower" =~ $regex ]]; then
      printf '  %s  [%s]\n' "$path" "$label" >&2
      findings=$((findings + 1))
      return 0
    fi
  done

  for entry in "${DIR_PATTERNS[@]}"; do
    label="${entry%%::*}"
    regex="${entry#*::}"
    if [[ "$path" =~ $regex ]]; then
      printf '  %s  [%s]\n' "$path" "$label" >&2
      findings=$((findings + 1))
      return 0
    fi
  done
}

if [ "$#" -gt 0 ]; then
  for path in "$@"; do
    [ -n "$path" ] && check_path "$path"
  done
else
  while IFS= read -r -d '' path; do
    [ -n "$path" ] && check_path "$path"
  done < <(git ls-files -z)
fi

if [ "$findings" -gt 0 ]; then
  {
    echo ""
    echo "Asset-hygiene blocked: $findings media file(s) above look third-party or scratch."
    echo "Reference/store screenshots and inspiration grabs must not be committed —"
    echo "they conflict with the original-work contribution certification."
    echo ""
    echo "Fix one of these ways:"
    echo "  - Remove the file if it is not our original work (it is almost certainly"
    echo "    not needed to ship)."
    echo "  - Rename it to a descriptive, non-download name if it IS ours."
    echo "  - If it is intentional and owned, add its path (or a dir prefix) to"
    echo "    scripts/asset-hygiene-allowlist.txt."
  } >&2
  exit 1
fi

echo "Asset hygiene passed ($checked media file(s) checked)."
