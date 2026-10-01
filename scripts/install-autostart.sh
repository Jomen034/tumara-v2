#!/usr/bin/env bash
# Pasang 3 launchd agent supaya Tumara (MongoDB + backend + frontend) otomatis
# hidup setiap kali Mac login. Jalankan sekali:  ./scripts/install-autostart.sh
# Copot dengan:                        ./scripts/uninstall-autostart.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$HOME"
AGENTS_DIR="$HOME_DIR/Library/LaunchAgents"
LOG_DIR="$HOME_DIR/tumara-logs"
UID_NUM="$(id -u)"
MONGOD="$HOME_DIR/.mongodb-local/mongodb-macos-aarch64-8.0.4/bin/mongod"
# macOS memblokir launchd membaca/menjalankan file di ~/Downloads (TCC).
# Karena itu skrip disalin ke ~/.tumara/ (folder rumah, di luar area terlindungi).
RUNTIME_DIR="$HOME_DIR/.tumara"
NODE_BIN="${NODE_BIN:-$(dirname "$(command -v node || echo /usr/bin/node)")}"

mkdir -p "$AGENTS_DIR" "$LOG_DIR" "$RUNTIME_DIR" \
         "$HOME_DIR/.mongodb-local/data" "$HOME_DIR/.mongodb-local/logs"

if [ ! -x "$MONGOD" ]; then
  echo "ERROR: mongod tidak ditemukan di $MONGOD"
  echo "Jalankan ./scripts/install-mongodb.sh terlebih dahulu."
  exit 1
fi

cp "$ROOT/scripts/run-backend.sh" "$RUNTIME_DIR/run-backend.sh"
cp "$ROOT/scripts/run-frontend.sh" "$RUNTIME_DIR/run-frontend.sh"
chmod +x "$RUNTIME_DIR/run-backend.sh" "$RUNTIME_DIR/run-frontend.sh"

write_plist() {
  local name="$1" label="$2" short="$3"
  cat > "$AGENTS_DIR/$name" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/$short.out.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/$short.err.log</string>
  <key>ProcessType</key><string>Background</string>
  <key>ProgramArguments</key>
  <array>
PLIST
}

# ---------- 1. MongoDB ----------
write_plist "com.tumara.mongodb.plist" "com.tumara.mongodb" "mongodb"
cat >> "$AGENTS_DIR/com.tumara.mongodb.plist" <<PLIST
    <string>$MONGOD</string>
    <string>--dbpath</string><string>$HOME_DIR/.mongodb-local/data</string>
    <string>--logpath</string><string>$HOME_DIR/.mongodb-local/logs/mongod.log</string>
    <string>--bind_ip</string><string>127.0.0.1</string>
    <string>--port</string><string>27017</string>
  </array>
</dict>
</plist>
PLIST

# ---------- 2. Backend ----------
# Catatan: pakai "/bin/bash <skrip>" (bukan eksekusi langsung) karena macOS
# memblokir eksekusi file .sh di folder ~/Downloads (TCC: Operation not permitted).
write_plist "com.tumara.backend.plist" "com.tumara.backend" "backend"
cat >> "$AGENTS_DIR/com.tumara.backend.plist" <<PLIST
    <string>/bin/bash</string>
    <string>$RUNTIME_DIR/run-backend.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TUMARA_ROOT</key><string>$ROOT</string>
  </dict>
</dict>
</plist>
PLIST

# ---------- 3. Frontend ----------
write_plist "com.tumara.frontend.plist" "com.tumara.frontend" "frontend"
cat >> "$AGENTS_DIR/com.tumara.frontend.plist" <<PLIST
    <string>/bin/bash</string>
    <string>$RUNTIME_DIR/run-frontend.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BROWSER</key><string>none</string>
    <key>TUMARA_ROOT</key><string>$ROOT</string>
    <key>PATH</key><string>$NODE_BIN:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST

for label in com.tumara.mongodb com.tumara.backend com.tumara.frontend; do
  plist="$AGENTS_DIR/$label.plist"
  launchctl bootout "gui/$UID_NUM/$label" 2>/dev/null || true
  sleep 1
  if ! launchctl bootstrap "gui/$UID_NUM" "$plist" 2>/dev/null; then
    launchctl load -w "$plist" 2>/dev/null || true
  fi
  if launchctl list | awk -v l="$label" '$3 == l {found=1} END {exit !found}'; then
    echo "terpasang: $label"
  else
    echo "GAGAL   : $label  (lihat $LOG_DIR)"
  fi
done

echo
echo "Selesai. Tumara akan otomatis hidup saat login."
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:8001/api/"
echo "  MongoDB  : 127.0.0.1:27017  (data di ~/.mongodb-local/data)"
echo "  Log      : $LOG_DIR"
echo "  Status   : ./scripts/status.sh"
