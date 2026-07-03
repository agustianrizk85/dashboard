@echo off
REM ============================================================
REM run-local.bat - Tes lokal di Windows (meniru setup VPS)
REM Windows sudah punya layar sungguhan, jadi TANPA Xvfb/VNC.
REM Chrome dijalankan dengan profil khusus (--user-data-dir),
REM persis seperti nanti di VPS, supaya sesi login tersimpan.
REM ============================================================

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "PROFILE=%~dp0chrome-profile-local"
set "URL=https://my.cicle.app/companies/68ee398e0d5377ba21c488f3"

if not exist "%PROFILE%" mkdir "%PROFILE%"

echo Menjalankan Chrome dengan profil lokal:
echo   %PROFILE%
echo Membuka: %URL%
echo.
echo Langkah pertama (sekali saja):
echo   1. Pasang ekstensi "Claude in Chrome" dari Web Store
echo   2. Sign-in akun Claude, lalu pin ekstensinya
echo   3. Login cicle.app (ketik password sendiri)
echo Sesi tersimpan di profil, jadi tidak perlu diulang.
echo.

start "" "%CHROME%" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --start-maximized "%URL%"
