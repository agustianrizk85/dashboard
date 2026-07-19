# SKILL: Pengecekan & Koreksi Gambar Kerja (GK) - Greenpark Group

> Disusun dari `Penjelasan Skill Pengecekan Gambar kerja di Cicle.docx` (dokumen
> asli tim Greenpark, murni teks - tidak ada lampiran gambar). Skill ini untuk
> sesi Claude (Claude Code) yang diminta memeriksa/mengoreksi Gambar Kerja, BUKAN
> untuk pipeline Deep Analysis otomatis (`ai_deep.go`) - itu murni teks/data dan
> tidak punya akses baca gambar.

## 1. Tujuan

Memeriksa kesesuaian **GK Kontraktor** (gambar kerja draft dari kontraktor) terhadap
**GK TTD** (gambar kerja yang sudah disetujui/ditandatangani konsumen), menemukan
ketidaksesuaian sebelum konstruksi berjalan, lalu menghasilkan file PDF hasil
anotasi (coretan + keterangan) untuk dikirim balik sebagai revisi ke kontraktor.

## 2. Alat & Akses

- **Baca PDF**: pakai tool `Read` bawaan Claude Code langsung ke file PDF
  (mendukung vision native, bisa baca per-halaman dengan parameter `pages`).
  Tidak perlu OCR/tool terpisah untuk membaca teks & layout gambar.
- **Anotasi ke PDF**: Claude Code tidak punya tool "gambar ke PDF" bawaan - buat
  skrip Python kecil dengan **PyMuPDF (`fitz`)** via launcher `py` (Python 3.14
  sudah terpasang di environment ini; PyMuPDF belum - install sekali dengan
  `py -m pip install pymupdf` bila `import fitz` gagal). PyMuPDF bisa: render
  halaman PDF ke gambar (untuk dibaca ulang bila perlu presisi ekstra), dan
  menggambar anotasi (persegi, garis silang, lingkaran, highlight, teks) langsung
  ke halaman PDF asli lalu menyimpannya sebagai file baru.
- Prosedur manual aslinya pakai fitur *Draw*/anotasi PDF di Microsoft Edge
  (coretan pen + kotak teks) - skrip PyMuPDF di atas adalah versi terotomasinya.

## 3. Input
Dua file PDF per unit/lantai yang mau dicek (biasanya hasil export dari DWG
AutoCAD via Cicle atau software serupa):
1. **GK Kontraktor** - draft yang akan dikoreksi.
2. **GK TTD** - acuan yang sudah disetujui/ditandatangani konsumen.
Kedua file harus dibaca halaman-per-halaman (pakai `pages` range bila banyak
halaman) dan dibandingkan lembar demi lembar yang jenisnya sama (denah vs denah,
tampak vs tampak, dst).

## 4. Checklist Pengecekan (urutan wajib, jangan ada yang terlewat)

1. **Luas Bangunan** (kolom kanan kop gambar) - angka di GK Kontraktor harus
   **sama persis** dengan GK TTD. Ini kesalahan paling sering terlewat - cek
   duluan sebelum yang lain.
2. **Gambar Denah** tiap lantai: dimensi, keterangan, level lantai, posisi
   jendela, posisi carport, bentuk denah, posisi pintu, catatan lain di luar
   gambar kerja.
3. **Gambar Tampak**: harus sesuai denah - posisi carport, posisi jendela &
   pintu, serta elevasi ketinggian tiap lantai.
4. **Gambar Potongan**: tiap struktur, elevasi lantai, posisi balok, elevasi
   plafond, jendela & pintu, dimensi, dan keterangan - semua harus komposit
   (konsisten) dengan denah.
5. **Pola Lantai & Pola Plafond**: level elevasi dan keterangan finishing sesuai
   standar.
6. **Gambar detail lainnya** (detail tangga, detail kamar mandi, detail dapur,
   detail atap): harus komposit dengan denah utama, tidak boleh ada beda.
7. **Detail Kusen**: tinggi kusen/pintu/jendela pada sisi dinding YANG SAMA harus
   konsisten satu sama lain. Contoh: pintu utama di dinding depan tinggi 2.4 m ?
   jendela di sisi dinding yang sama juga wajib 2.4 m.
8. **Struktur**: gambar pondasi & pembalokan harus komposit dengan denahnya;
   posisi tiap balok harus tepat sesuai kaidah struktur & denah utama.
9. **Rencana Elektrikal**: semua titik stop kontak & saklar sesuai kaidah
   arsitektur yang tepat; pastikan semua fungsi/kegunaan terdefinisi pada denah
   elektrikal.

## 5. Prosedur Koreksi (anotasi)

- Tiap ketidaksesuaian yang ditemukan ? tandai lokasinya di halaman GK
  Kontraktor dengan coretan yang sesuai jenis kesalahan: tanda silang (elemen
  yang seharusnya tidak ada / hilang), lingkaran, garis, atau highlight - yang
  penting maksudnya jelas.
- Setiap coretan **wajib** didampingi keterangan teks singkat di sebelahnya yang
  menjelaskan kesalahannya (contoh: "tidak ada jendela", "level plafond tidak
  sama").
- Catatan & coretan harus **sesuai fakta yang benar-benar terlihat**, tidak
  mengada-ada, dan relevan dengan kebutuhan pengecekan GK.
- Simpan hasil sebagai file **baru** (jangan overwrite file asli), dengan prefix
  `notes_` di depan nama file asli GK Kontraktor - contoh:
  `GK_Kontraktor_Lt1.pdf` ? `notes_GK_Kontraktor_Lt1.pdf`.

## 6. Kesalahan yang Harus Dihindari

- Salah baca gambar - tertukar mana yang benar dan mana yang salah.
- Menandai/mencoret bagian yang sebenarnya sudah **benar**.
- Keterangan koreksi tidak jelas atau ambigu, atau memakan terlalu banyak ruang
  di halaman.
- **Lupa cek angka Luas Bangunan dan Luas Tanah** di kolom kanan kop gambar -
  ini yang paling sering terlewat, selalu cek paling awal (lihat poin 1).

## 7. Batasan & Kehati-hatian

- Membaca gambar teknis secara visual **bukan pengukuran presisi** seperti CAD.
  Untuk dimensi yang sangat berdekatan/sulit dibedakan secara visual, tandai
  sebagai **"perlu verifikasi manual"** - jangan memutuskan sepihak kalau tidak
  yakin.
- Hasil skill ini adalah **first-pass QC assistant**: tetap wajib direview
  manusia sebelum file `notes_...` dikirim balik ke kontraktor.

## Sumber

- `Penjelasan Skill Pengecekan Gambar kerja di Cicle.docx` (dokumen asli tim
  Greenpark, dibaca lengkap).
