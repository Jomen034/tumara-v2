#!/usr/bin/env bash
# Menjalankan stack dev Tumara: MongoDB lokal + backend FastAPI.
# Pakai:  ./dev-up.sh
# Stop:   Ctrl+C  (mongod ikut mati karena di background dalam sesi ini)

set -euo pipefail
cd "$(dirname "$0")"

MONGOD_BIN="$HOME/.mongodb-local/mongodb-macos-aarch64-8.0.4/bin/mongod"
DBPATH="$HOME/.mongodb-local/data"
LOGPATH="$HOME/.mongodb-local/logs/mongod.log"
PYTHON="./.venv312/bin/python"

mkdir -p "$DBPATH" "$(dirname "$LOGPATH")"

if ! nc -z 127.0.0.1 27017 2>/dev/null; then
  if [ ! -x "$MONGOD_BIN" ]; then
    echo "mongod tidak ditemukan di $MONGOD_BIN"
    echo "Unduh: https://fastdl.mongodb.org/osx/mongodb-macos-arm64-8.0.4.tgz"
    exit 1
  fi
  echo "[dev-up] Menjalankan MongoDB lokal di 127.0.0.1:27017 (data: $DBPATH)"
  "$MONGOD_BIN" --dbpath "$DBPATH" --logpath "$LOGPATH" --bind_ip 127.0.0.1 --port 27017 &
  MONGO_PID=$!
  trap 'kill $MONGO_PID 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do
    nc -z 127.0.0.1 27017 2>/dev/null && break
    sleep 0.5
  done
fi

echo "[dev-up] Menjalankan backend di http://localhost:8001 (Ctrl+C untuk stop)"
DB_STRICT=true exec "$PYTHON" -m uvicorn server:app --host 0.0.0.0 --port 8001
