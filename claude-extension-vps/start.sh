#!/usr/bin/env bash
#
# start.sh — Jalankan layar virtual + Chrome + VNC secara manual
# (untuk uji coba / login pertama). Untuk produksi pakai systemd.
#
set -euo pipefail

DISPLAY_NUM=":99"
SCREEN="1920x1080x24"
PROFILE_DIR="${HOME}/chrome-profile"
START_URL="https://my.cicle.app/companies/68ee398e0d5377ba21c488f3"

export DISPLAY="${DISPLAY_NUM}"

echo "==> Membersihkan sisa proses lama"
pkill -f "Xvfb ${DISPLAY_NUM}" 2>/dev/null || true
pkill -f "x11vnc" 2>/dev/null || true
sleep 1

echo "==> Start Xvfb (layar virtual ${SCREEN} di ${DISPLAY_NUM})"
Xvfb "${DISPLAY_NUM}" -screen 0 "${SCREEN}" -ac +extension GLX +render -noreset &
sleep 2

echo "==> Start window manager ringan (fluxbox)"
fluxbox >/dev/null 2>&1 &
sleep 1

echo "==> Start x11vnc (akses jarak jauh di port 5900)"
x11vnc -display "${DISPLAY_NUM}" -rfbauth "${HOME}/.vnc/passwd" \
       -forever -shared -bg -o "${HOME}/.vnc/x11vnc.log"

echo "==> Start Google Chrome dengan profil permanen"
google-chrome \
  --user-data-dir="${PROFILE_DIR}" \
  --no-first-run \
  --no-default-browser-check \
  --disable-gpu \
  --start-maximized \
  "${START_URL}" &

echo ""
echo "============================================================"
echo " Berjalan. Konek VNC dari laptop Anda ke: <IP-VPS>:5900"
echo " Login pertama: pasang & sign-in ekstensi Claude via VNC."
echo " Tekan Ctrl+C di sini untuk menghentikan (Chrome tetap jalan"
echo " di background sampai proses dimatikan)."
echo "============================================================"
wait
