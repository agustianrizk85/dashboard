import type { CardInfo } from "./ui";

/**
 * Tooltip content for every Teknik dashboard card: where the number comes from
 * in the source spreadsheet (tab + column) and the business logic behind it.
 *
 * Source sheet: "MASTER DATABASE · Monitoring Progres Pembangunan Unit Rumah —
 * Greenpark Group". The per-unit master is the "Master Database" tab (1 baris =
 * 1 unit, auto-detected by header NAMA PROYEK + BLOK + TIPE). Bobot progres per
 * unit dihitung dari akumulasi 92 item RAB Tipe Jade 54m² (kolom "TOTAL BOBOT
 * PROGRES (%)"). Baseline Kurva S rencana dipakai untuk menghitung target/deviasi.
 */
export const INFO: Record<string, CardInfo> = {
  // ---- Overview KPI row ----
  totalProyek: {
    source: "Tab Master Database · kolom NAMA PROYEK",
    logic: "Jumlah proyek unik dari seluruh unit yang tersinkron dari sheet.",
  },
  totalUnit: {
    source: "Tab Master Database · 1 baris = 1 unit (NAMA PROYEK + BLOK)",
    logic: "Jumlah seluruh unit/kavling terdaftar di master database.",
  },
  totalSpk: {
    source: "Tab Master Database · kolom NO. SPK & NAMA KONTRAKTOR",
    logic: "Jumlah SPK terbit — unit yang sudah punya nomor SPK / kontraktor.",
  },
  overall: {
    source: "kolom TOTAL BOBOT PROGRES (%) tiap unit",
    logic: "Rata-rata progres seluruh unit — akumulasi bobot 92 item RAB (Tipe Jade 54m²) yang sudah dicentang ✓. Hijau bila ≥ 50%.",
  },
  onSchedule: {
    source: "Dihitung: TOTAL BOBOT PROGRES (%) vs target Kurva S (acuan mulai = TGL ACC GAMBAR KERJA)",
    logic: "Target = posisi Kurva S pada minggu berjalan (dihitung sejak tgl ACC gambar kerja, fallback tgl SPK). Deviasi = aktual − target; ≥ −1% = tidak tertinggal. Klik → buka Deviasi & SPI.",
  },
  warning: {
    source: "Dihitung dari deviasi per proyek (aktual vs target Kurva S)",
    logic: "Proyek dengan deviasi −1% s/d −5% (mulai tertinggal dari jadwal ACC-gambar-vs-Kurva-S, perlu dipantau).",
  },
  critical: {
    source: "Dihitung dari deviasi per proyek (aktual vs target Kurva S)",
    logic: "Proyek dengan deviasi < −5% (kritis, wajib Recovery Plan).",
  },
  avgSpi: {
    source: "Dihitung: aktual ÷ target per proyek, lalu dirata-rata",
    logic: "Schedule Performance Index (target = Kurva S sejak tgl ACC gambar kerja). ≥ 1,0 = sesuai/lebih cepat; < 1 = tertinggal jadwal.",
  },

  // ---- Overview panels ----
  attention: {
    source: "Proyek berstatus Warning/Critical — deviasi aktual vs target (acuan TGL ACC GAMBAR KERJA → Kurva S)",
    logic: "Daftar proyek tertinggal/berisiko, diurutkan paling kritis dulu. Klik kartu → rincian per blok (aktual vs target tiap unit) + rekomendasi tindakan.",
  },
  alert: {
    source: "Turunan status proyek + status BAST (master)",
    logic: "Red/Yellow/Green otomatis: Critical → Red, Warning → Yellow, komplain/defect terbuka ikut Red; sisanya Green.",
  },
  ceo: {
    source: "Proyek bermasalah + rekomendasi rule-based",
    logic: "Issue → Command → PIC (kontraktor/SPV) → Deadline. Critical = 48 jam, Warning = mingguan.",
  },
  kurva: {
    source: "Baseline Kurva S rencana (kumulatif per minggu) + TOTAL BOBOT PROGRES (%) per unit",
    logic: "Garis biru = rencana kumulatif per minggu; tiap titik = posisi aktual pada minggu berjalannya (dihitung sejak TGL ACC GAMBAR KERJA, fallback tgl SPK); titik di bawah garis = tertinggal.",
  },
  jadwal: {
    source: "Tahap konstruksi (bobot metodologi) vs baseline Kurva S",
    logic: "Perkiraan minggu mulai–selesai tiap tahap, dihitung dari bobot kumulatif terhadap kurva rencana (acuan mulai = tgl ACC gambar kerja).",
  },
  proyekTable: {
    source: "Agregasi unit per proyek (TOTAL BOBOT PROGRES %, NO. SPK, NAMA KONTRAKTOR)",
    logic: "Aktual = rata-rata progres unit; Target = Kurva S pada minggu berjalan sejak TGL ACC GAMBAR KERJA; Deviasi, SPI & Telat (mgg) dihitung dari keduanya.",
  },
  kontraktorRank: {
    source: "kolom NAMA KONTRAKTOR + NILAI KONTRAK (Rp) / TOTAL KONTRAK (Rp)",
    logic: "Kontraktor diranking dari jumlah SPK yang dikerjakan dan total nilai kontraknya.",
  },

  // ---- Deviasi & SPI ----
  avgDeviasi: {
    source: "Dihitung: rata-rata (aktual − target) semua proyek",
    logic: "Target = Kurva S sejak tgl ACC gambar kerja. Negatif = tertinggal dari rencana, positif = lebih cepat. Target ±3%.",
  },
  deviasiTable: {
    source: "Per proyek: TOTAL BOBOT PROGRES (%) vs target Kurva S (acuan TGL ACC GAMBAR KERJA)",
    logic: "Deviasi & SPI tiap proyek, diurut paling kritis dulu. Klik baris → rincian per blok (aktual vs target tiap unit) + rekomendasi.",
  },

  // ---- KPI Direksi ----
  onTime: {
    source: "Proyek selesai/berjalan tepat waktu ÷ total proyek",
    logic: "% proyek on-time — deviasi di ambang aman (aktual vs target Kurva S sejak tgl ACC gambar kerja). Target ≥ 95%.",
  },
  cluster: {
    source: "Agregasi proyek per group/kawasan (GP 1/2/3/4)",
    logic: "Rata-rata progres aktual vs target & deviasi per kawasan.",
  },
  kontraktorDev: {
    source: "Agregasi unit per NAMA KONTRAKTOR",
    logic: "Aktual, deviasi & SPI tiap kontraktor, paling kritis dulu (top 12).",
  },
  mutu: {
    source: "Master Database (belum ada kolom komplain/defect)",
    logic: "Master database ini belum memuat kolom komplain/defect → angka mutu diisi manual lewat Master Data.",
  },
};
