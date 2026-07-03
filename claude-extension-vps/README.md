# Claude in Chrome di VPS (versi ekstensi, tanpa Claude API)

Menjalankan **ekstensi "Claude in Chrome"** di VPS Linux headless, dengan
layar virtual (Xvfb) + akses jarak jauh (VNC) untuk login sekali, lalu
profil Chrome disimpan permanen supaya tidak login ulang.

> ⚠️ **Penting dipahami sebelum pakai**
> Ekstensi Claude in Chrome adalah produk *interaktif*, bukan dibuat untuk
> server unattended. Cara ini **bisa jalan** tapi:
> - Sesi login Claude bisa expired → sesekali harus VNC & login ulang manual.
> - Butuh RAM cukup (min 2 GB, ideal 4 GB).
> - Mode "Act without asking" berarti agen bertindak tanpa konfirmasi di
>   server tanpa pengawasan — pakai dengan hati-hati.
> Untuk otomasi andal 24/7, pertimbangkan Playwright.

---

## Kebutuhan
- VPS Ubuntu/Debian (RAM ≥ 2 GB)
- Akun Claude berlangganan (Pro/Max) untuk ekstensinya
- VNC viewer di komputer Anda (TigerVNC / RealVNC / Remmina)

## Isi paket
```
claude-extension-vps/
├── setup.sh                     # pasang Chrome, Xvfb, x11vnc, dll
├── start.sh                     # jalan manual (uji coba / login pertama)
├── README.md
└── systemd/
    ├── xvfb.service             # layar virtual otomatis saat boot
    ├── x11vnc.service           # akses VNC otomatis
    └── chrome-claude.service    # Chrome + profil otomatis
```

---

## Langkah pakai

### 1. Upload & setup
```bash
scp -r claude-extension-vps user@IP-VPS:~/
ssh user@IP-VPS
cd ~/claude-extension-vps
chmod +x setup.sh start.sh
./setup.sh        # akan minta bikin password VNC
```

### 2. Jalankan & login pertama (manual)
```bash
./start.sh
```
Lalu dari laptop Anda, konek VNC ke `IP-VPS:5900` (pakai password VNC tadi).
Di layar VNC:
1. Chrome sudah terbuka.
2. Buka Chrome Web Store → cari **"Claude in Chrome"** → **Add to Chrome**.
3. **Sign in** akun Claude Anda.
4. **Pin** ikon ekstensi.
5. Login ke cicle.app juga kalau perlu (ketik password sendiri).

Semua tersimpan di `~/chrome-profile`, jadi tidak perlu diulang.

> 🔒 **Password akun jangan ditaruh di file/script.** Ketik langsung di
> layar login lewat VNC. Profil Chrome yang menyimpan sesinya.

### 3. Jadikan otomatis saat boot (systemd)
Edit ketiga file di `systemd/` → ganti `user` dengan username VPS Anda,
lalu:
```bash
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now xvfb.service
sudo systemctl enable --now x11vnc.service
sudo systemctl enable --now chrome-claude.service
```
Cek status:
```bash
systemctl status chrome-claude.service
```

### 4. Pakai Claude-nya
Konek VNC → panel Claude di kanan Chrome → ketik perintah di
kotak "Type / for commands", misalnya:
```
Buka cicle.app dan login, lalu ambil ringkasan datanya
```

---

## Troubleshooting
| Masalah | Solusi |
|---|---|
| VNC tak bisa konek | Buka port 5900 di firewall VPS / security group |
| Chrome "profile in use" | Pastikan hanya 1 instance; hapus `~/chrome-profile/Singleton*` |
| Ekstensi minta login lagi | Sesi expired → VNC & sign-in ulang |
| Layar hitam di VNC | Pastikan `fluxbox` jalan & `DISPLAY=:99` benar |
| Chrome berat/crash | Tambah RAM VPS atau tambahkan `--disable-dev-shm-usage` |

## Keamanan
- Batasi akses VNC: pakai firewall / SSH tunnel (`ssh -L 5900:localhost:5900`)
  daripada expose 5900 ke publik.
- Jangan simpan password akun di repo/script.
- Pertimbangkan ganti password akun yang sempat tampil di chat.
