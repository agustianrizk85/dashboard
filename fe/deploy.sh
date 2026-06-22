#!/usr/bin/env bash
# Deploy Dashboard terpadu (fe): tarik kode terbaru, build, sajikan via PM2 (static SPA).
# Jalankan di server dari dalam folder fe repo dashboard:  ./deploy.sh
#
#   cd /opt/apps && git clone https://github.com/agustianrizk85/dashboard.git
#   cd dashboard/fe && ./deploy.sh
#
# API tiap modul diarahkan ke path relatif /be/<dept> (lihat .env.production);
# nginx vhost domain dashboard yang mem-proxy ke backend lokal masing-masing.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> git pull"
git pull --ff-only

echo "==> npm ci + build"
npm ci
npm run build   # baca .env.production -> VITE_*_API (path relatif /be/<dept>)

echo "==> (re)serve PM2: dashboard-fe (port 8094)"
pm2 restart dashboard-fe 2>/dev/null || pm2 serve dist 8094 --spa --name dashboard-fe
pm2 save
echo "==> selesai. status:"
pm2 status dashboard-fe
