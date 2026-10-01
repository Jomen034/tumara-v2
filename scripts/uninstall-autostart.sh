#!/usr/bin/env bash
# Copot launchd agent Tumara (MONGO + backend + frontend).
# Data di ~/.mongodb-local/data TIDAK dihapus.
set -uo pipefail
UID_NUM="$(id -u)"

for label in com.tumara.frontend com.tumara.backend com.tumara.mongodb; do
  launchctl bootout "gui/$UID_NUM/$label" 2>/dev/null && echo "dihentikan: $label" || echo "tidak aktif: $label"
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done

echo "Selesai. Untuk pasang lagi: ./scripts/install-autostart.sh"
