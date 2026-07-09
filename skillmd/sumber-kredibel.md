# SKILL: Sumber Kredibel — Hierarki & Cara Menilai Sumber Eksternal

Dipakai bersama SKILL Deep Analysis saat agent mencari data di internet.

## Hierarki kredibilitas (pakai yang tertinggi yang tersedia)

1. **Data resmi / regulator**: BI (suku bunga/KPR), BPS (demografi, inflasi),
   Kementerian PUPR (perumahan/subsidi FLPP), OJK. Paling kuat untuk konteks makro.
2. **Dokumentasi platform**: Meta Business Help Center / Meta for Business —
   satu-satunya sumber otoritatif soal aturan, metrik, dan fitur Meta Ads.
3. **Riset industri bernama**: Rumah123/99 Group, Lamudi, Colliers, Knight Frank,
   JLL, Bank Indonesia Residential Property Survey — untuk tren harga & permintaan
   properti Indonesia.
4. **Publikasi benchmark iklan**: WordStream, Databox, laporan agensi besar —
   untuk benchmark CTR/CPM/CPC/CPL per industri. Catat: mayoritas berbasis pasar
   AS/global; SELALU tandai bila bukan data Indonesia dan perlakukan sebagai
   indikasi kasar, bukan target pasti.
5. **Media bisnis/properti**: Kontan, Bisnis.com, Kompas Properti, detikProperti.
6. **Blog/forum/marketer perorangan**: hanya sebagai petunjuk arah, JANGAN
   dijadikan dasar rekomendasi tunggal.

## Cara menilai satu halaman

- **Tanggal**: benchmark iklan > 2 tahun = kedaluwarsa; sebut tahunnya selalu.
- **Metodologi**: apakah angka berasal dari data agregat nyata (berapa akun/spend)
  atau sekadar opini?
- **Relevansi pasar**: Indonesia > Asia Tenggara > global. Real estate > industri lain.
- **Konflik kepentingan**: vendor yang menjual jasa cenderung membesar-besarkan masalah.

## Format sitasi dalam output

- Inline singkat: `(sumber: businesshelp.meta.com, 2026)` atau `(sumber: BI, Feb 2026)`.
- Bila dua sumber bertentangan, tampilkan keduanya dan jelaskan mana yang lebih
  dipercaya dan mengapa.
- Bila sumber spesifik tidak ditemukan: JANGAN langsung jatuh ke baseline
  internal — jalankan dulu seluruh tangga eskalasi di SKILL Deep Analysis
  (variasi istilah → bahasa Inggris → perluas cakupan → pivot sudut data).
  Baseline internal tanpa satu pun sumber terbuka hanya boleh SETELAH semua
  eskalasi habis, dan wajib mencantumkan strategi pencarian yang sudah dicoba
  + sumber relevan terdekat yang berhasil dibuka.
