#!/usr/bin/env bash
# Menjalankan frontend dev Tumara (react-scripts) tanpa membuka browser otomatis.
# Dipakai oleh launchd (com.tumara.frontend) dan bisa dipanggil manual.
#   TUMARA_ROOT=... PATH=... bash run-frontend.sh
set -uo pipefail
ROOT="${TUMARA_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT/frontend" || { echo "[frontend] root proyek tidak ditemukan: $ROOT/frontend" >&2; exit 1; }
export BROWSER=none
exec npm start
