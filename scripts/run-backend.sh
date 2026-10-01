#!/usr/bin/env bash
# Menunggu MongoDB siap, lalu menjalankan backend Tumara.
# Dipakai oleh launchd (com.tumara.backend) dan bisa dipanggil manual.
#   TUMARA_ROOT=... bash run-backend.sh
set -uo pipefail
ROOT="${TUMARA_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT/backend" || { echo "[backend] root proyek tidak ditemukan: $ROOT/backend" >&2; exit 1; }

for _ in $(seq 1 60); do
  nc -z 127.0.0.1 27017 2>/dev/null && break
  sleep 0.5
done

if ! nc -z 127.0.0.1 27017 2>/dev/null; then
  echo "[backend] MongoDB tidak tersedia di 127.0.0.1:27017" >&2
  exit 1
fi

DB_STRICT=true exec ./.venv312/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
