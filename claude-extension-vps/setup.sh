#!/usr/bin/env bash
#
# setup.sh — Pasang semua kebutuhan untuk menjalankan ekstensi
# "Claude in Chrome" di VPS Linux headless (Ubuntu/Debian).
#
# Jalankan sekali sebagai user biasa (bukan root, tapi butuh sudo).
#   chmod +x setup.sh && ./setup.sh
#
set -euo pipefail

echo "==> [1/5] Update apt & tools dasar"
sudo apt-get update -y
sudo apt-get install -y \
  wget curl gnupg ca-certificates \
  xvfb x11vnc fluxbox \
  fonts-liberation libnss3 libgbm1 libasound2

echo "==> [2/5] Pasang Google Chrome stable (kalau belum ada)"
if ! command -v google-chrome >/dev/null 2>&1; then
  wget -q -O /tmp/chrome.deb \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo apt-get install -y /tmp/chrome.deb
  rm -f /tmp/chrome.deb
else
  echo "    Chrome sudah terpasang: $(google-chrome --version)"
fi

echo "==> [3/5] Siapkan folder profil Chrome (login Claude tersimpan di sini)"
PROFILE_DIR="${HOME}/chrome-profile"
mkdir -p "${PROFILE_DIR}"
echo "    Profil: ${PROFILE_DIR}"

echo "==> [4/5] Set password VNC (untuk login manual sekali via layar jarak jauh)"
if [ ! -f "${HOME}/.vnc/passwd" ]; then
  mkdir -p "${HOME}/.vnc"
  echo "    Membuat password VNC. Masukkan password saat diminta:"
  x11vnc -storepasswd "${HOME}/.vnc/passwd"
else
  echo "    Password VNC sudah ada di ${HOME}/.vnc/passwd"
fi

echo "==> [5/5] Selesai."
cat <<'EOF'

============================================================
 SETUP SELESAI. Langkah berikutnya:
------------------------------------------------------------
 1) Jalankan sesi:      ./start.sh
 2) Dari laptop Anda, konek VNC ke:  <IP-VPS>:5900
    (pakai TigerVNC / RealVNC / Remmina)
 3) Di layar VNC: buka Chrome yang sudah muncul,
    pasang ekstensi "Claude in Chrome" dari Web Store,
    sign-in akun Claude, lalu pin ekstensinya.
 4) Login Claude & cookie akan tersimpan di ~/chrome-profile
    sehingga tidak perlu login ulang tiap restart.

 Untuk jalan otomatis saat boot, pakai systemd:
    lihat folder ./systemd/ dan README.md
============================================================
EOF
