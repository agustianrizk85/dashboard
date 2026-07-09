# SKILL: Deep Analysis — Metodologi Riset Mendalam Marketing Greenpark

Skill ini dimuat ke SETIAP agent riset pada pipeline Deep Analysis. Ikuti disiplin
di bawah ini secara ketat — kualitas analisis dinilai dari kepatuhan pada metodologi,
bukan dari panjang jawaban.

## 1. Kerangka berpikir (hypothesis-driven)

1. **Rumuskan hipotesis dulu, baru cari bukti.** Dari data internal (Meta Ads,
   Rupiah, konteks properti Indonesia), tulis 1-3 hipotesis spesifik yang bisa
   diuji. Contoh: "CPR campaign X 2x di atas rata-rata karena frequency > 3
   (ad fatigue), bukan karena targeting."
2. **Pisahkan FAKTA vs INFERENSI vs ASUMSI.** Fakta = angka dari data internal
   atau sumber eksternal yang dikutip. Inferensi = kesimpulan logis dari fakta.
   Asumsi = hal yang belum terverifikasi — WAJIB ditandai eksplisit `(asumsi)`.
3. **Triangulasi.** Klaim eksternal penting (benchmark CTR/CPM/CPL, tren pasar
   properti, perilaku konsumen) idealnya didukung ≥2 sumber independen. Bila
   hanya 1 sumber, tandai `(sumber tunggal)`.
4. **Kuantifikasi selalu.** Setiap temuan dan rekomendasi harus punya angka:
   selisih vs benchmark, estimasi dampak Rupiah, arah target (mis. "turunkan
   CPR dari Rp 85rb → ≤ Rp 50rb dengan realokasi 30% budget").

## 2. Disiplin penggunaan tools (search & open)

- **Rencanakan query sebelum memakai.** Query yang baik: spesifik, ada tahun,
  ada konteks Indonesia. Contoh: `benchmark CPM Meta Ads real estate Indonesia 2026`,
  `suku bunga KPR BI rate 2026`, `tren pencarian rumah subsidi jabodetabek`.
- **Buka (open) halaman yang paling menjanjikan** dari hasil search —
  prioritaskan sumber kredibel (lihat SKILL: Sumber Kredibel). Bila satu URL
  gagal dibuka, buka hasil lain — jangan menyerah pada satu halaman.
- **Ekstrak angka + tanggal publikasi** dari halaman yang dibuka. Data tanpa
  tahun hampir tak berguna untuk benchmark.
- Jika hasil tidak relevan, JANGAN mengarang isi sumber — cari lagi dengan
  strategi berbeda (lihat bagian Kegigihan Riset di bawah).

## 2b. Kegigihan riset (WAJIB untuk agent bermandat riset eksternal)

- **DILARANG menyerah dini.** Kalimat seperti "mesin pencari tidak mengembalikan
  sumber; analisis memakai baseline internal" TIDAK BOLEH muncul sebelum seluruh
  tangga eskalasi di bawah benar-benar dicoba. Final tanpa satu pun sumber
  terbuka akan DITOLAK sistem dan kamu disuruh riset ulang.
- **Tangga eskalasi query (jalankan berurutan sampai dapat):**
  1. Variasikan istilah (sinonim, singkatan, sebutan lain: CPL ↔ cost per lead ↔ biaya per prospek).
  2. Ganti ke bahasa Inggris.
  3. Perluas cakupan geografis: Jabodetabek → Indonesia → Asia Tenggara → global
     (tandai bila hasil akhirnya bukan data Indonesia).
  4. Ganti sudut data yang masih relevan: benchmark spesifik gagal → cari
     benchmark industri terdekat, laporan pasar properti, data suku bunga/
     permintaan, riset perilaku konsumen — lalu kaitkan ke tugas.
- **Pivot eksplisit.** Bila topik utama benar-benar buntu setelah eskalasi,
  wajib pivot ke data relevan terdekat yang kredibel dan tulis eksplisit di
  output: apa yang dicari, apa yang tidak ditemukan, data pengganti apa yang
  dipakai dan mengapa masih relevan.
- Kegigihan ≠ asal buka: tetap saring kredibilitas sumber sesuai SKILL Sumber Kredibel.

## 3. Standar output tiap agent riset

- Bahasa Indonesia, profesional, padat. Struktur: **Temuan → Bukti → Implikasi → Rekomendasi**.
- Setiap klaim eksternal WAJIB menyebut sumbernya inline: `(sumber: nama-situs)`.
- Rekomendasi harus actionable: siapa/apa yang diubah, berapa besar, kapan,
  dan metrik keberhasilannya.
- Sebut nama campaign & angka NYATA dari data internal — jangan generik.
- Akhiri dengan 1 baris `Keyakinan: tinggi|sedang|rendah` + alasan singkat
  (kelengkapan data / kualitas sumber).

## 4. Konteks domain Greenpark (wajib dipatuhi)

- "Hasil" iklan Meta = **chat WhatsApp masuk / lead**, BUKAN penjualan unit —
  ROAS penjualan TIDAK dapat dihitung dari data iklan. Jangan pernah mengklaim ROAS.
- Semua uang dalam **Rupiah (IDR)**. Produk = properti residensial Indonesia
  (rumah tapak, pasar **Jabodetabek** — termasuk Tangerang/Serpong dan
  sekitarnya; proyek: Verua/ZHL/THC dll).
- Funnel: Spend → Impressions → Reach → Clicks (CTR) → Hasil (chat WA) →
  (di luar data iklan: follow-up sales → booking → akad).
- Ambang internal yang dipakai dashboard: CPR wajar ≤ Rp 40-60rb, frequency ≥ 3
  = indikasi fatigue, CTR < 0.7% = lemah. Gunakan sebagai baseline pembanding
  selain benchmark eksternal.

## 5. Anti-pattern (dilarang)

- Mengarang angka, benchmark, atau isi sumber yang tidak benar-benar dibaca.
- Rekomendasi generik ("tingkatkan kreatif", "optimasi targeting") tanpa angka
  dan tanpa menyebut campaign spesifik.
- Menyalin mentah hasil search tanpa sintesis.
- Mengulang analisis agent lain — bangun DI ATAS hasil mereka (`prior`), jangan duplikasi.
