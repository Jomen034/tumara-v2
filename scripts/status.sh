#!/usr/bin/env bash
# Cek status semua service Tumara.
UID_NUM="$(id -u)"

for label in com.tumara.mongodb com.tumara.backend com.tumara.frontend; do
  pid=$(launchctl list | awk -v l="$label" '$3 == l {print $1}')
  if [ -n "$pid" ] && [ "$pid" != "-" ]; then
    echo "[OK]    $label  (pid $pid)"
  else
    echo "[MATI]  $label"
  fi
done

for port in 27017 8001 3000; do
  if nc -z 127.0.0.1 "$port" 2>/dev/null; then
    echo "[OK]    port $port terbuka"
  else
    echo "[MATI]  port $port tertutup"
  fi
done
