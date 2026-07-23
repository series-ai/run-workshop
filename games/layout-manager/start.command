#!/bin/bash
#═══════════════════════════════════════════════
#  Layout Manager — Mac Launcher (double-click me)
#═══════════════════════════════════════════════

cd "$(dirname "$0")" || exit 1

cleanup() {
    echo ""
    echo "Shutting down Layout Manager..."
    kill -- -$$ 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM SIGHUP

echo "═══════════════════════════════════════════════"
echo "  Layout Manager"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Your browser will open automatically."
echo "  Keep this window open while using the app."
echo "  Close this window (or press Ctrl+C) to stop."
echo ""
echo "═══════════════════════════════════════════════"
echo ""

# Node installers put node here, but double-clicked .command files
# don't always get the full shell PATH — add the common locations.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Download the LTS installer from https://nodejs.org"
    echo "  then run this again."
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

if [ ! -x "node_modules/.bin/vite" ]; then
    echo "  First run — installing dependencies (takes a minute)..."
    echo ""
    if ! npm install; then
        echo ""
        echo "  [ERROR] Failed to install dependencies."
        read -p "Press Enter to close..."
        exit 1
    fi
    echo ""
fi

npx vite --open
read -p "Press Enter to close..."
