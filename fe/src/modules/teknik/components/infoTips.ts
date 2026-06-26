import type { CardInfo } from "./ui";

/**
 * Tooltip content for every Teknik dashboard card: where the number comes from
 * in the source spreadsheet (tab + column) and the business logic behind it.
 *
 * Source sheet: "DASHBOARD MONITORING PROGRES PEMBANGUNAN UNIT RUMAH". The
 * per-unit master lives in the SPK / ADMINO / ROBAIN / INPUT tabs (auto-detected
 * by header). The Kurva S baseline + work-item RAB come from the "Kurva S" tab.
 */
export const INFO: Record<string, CardInfo> = {
  // ---- Overview KPI row ----
  totalProyek: {
    source: 'Master unit (tab SPK – GP 1/2/3/4, ADMINO, dst.) · kolom NAMA PROYEK',
    logic: "Jumlah proyek unik dari seluruh unit yang tersinkron dari sheet.",
  },
  totalUnit: {
    source: "Master unit · 1 baris = 1 unit (NAMA PROYEK + BLOK)",
    logic: "Jumlah seluruh unit/kavling terdaftar (digabung dari beberapa tab yang tumpang-tindih).",
  },
  totalSpk: {
    source: "Master unit · kolom NOMOR SPK & NAMA KONTRAKTOR",
    logic: "Jumlah SPK terbit — unit yang sudah punya nomor SPK / kontraktor.",
  },
  overall: {
    source: "kolom PROGRES PEMBANGUNAN (%) tiap unit",
    logic: "Rata-rata progres seluruh unit (% master dipetakan ke bobot 17 tahap). Hijau bila ≥ 50%.",
  },
  onSchedule: {
    source: "Dihitung: PROGRES (%) vs TARGET (%) per proyek",
    logic: "Jumlah proyek dengan deviasi (aktual − target) ≥ −1% (tidak tertinggal). Klik → buka Deviasi & SPI.",
  },
  warning: {
    source: "Dihitung dari deviasi per proyek",
    logic: "Proyek dengan deviasi −1% s/d −5% (mulai tertinggal, perlu dipantau).",
  },
  critical: {
    source: "Dihitung dari deviasi per proyek",
    logic: "Proyek dengan deviasi < −5% (kritis, wajib Recovery Plan).",
  },
  avgSpi: {
    source: "Dihitung: aktual ÷ target per proyek, lalu dirata-rata",
    logic: "Schedule Performance Index. ≥ 1,0 = sesuai/lebih cepat; < 1 = tertinggal jadwal.",
  },

  // ---- Overview panels ----
  attention: {
    source: "Proyek berstatus Warning/Critical (deviasi vs Kurva S)",
    logic: "Daftar proyek tertinggal/berisiko, diurutkan paling kritis dulu. Klik kartu → detail + rekomendasi tindakan.",
  },
  alert: {
    source: "Turunan status proyek + kolom KOMPLAIN (master)",
    logic: "Red/Yellow/Green otomatis: Critical → Red, Warning → Yellow, komplain/defect terbuka ikut Red; sisanya Green.",
  },
  ceo: {
    source: "Proyek bermasalah + rekomendasi rule-based",
    logic: "Issue → Command → PIC (kontraktor/SPV) → Deadline. Critical = 48 jam, Warning = mingguan.",
  },
  kurva: {
    source: 'Tab "Kurva S" baris RENCANA (baseline kumulatif) + PROGRES (%) per unit',
    logic: "Garis biru = rencana kumulatif per minggu; tiap titik = posisi aktual 1 proyek pada minggu berjalannya; titik di bawah garis = tertinggal.",
  },
  jadwal: {
    source: "17 tahap konstruksi (metodologi) + bobot vs baseline Kurva S",
    logic: "Perkiraan minggu mulai–selesai tiap tahap, dihitung dari bobot kumulatif terhadap kurva rencana.",
  },
  proyekTable: {
    source: "Agregasi unit per proyek (PROGRES/TARGET %, NOMOR SPK, NAMA KONTRAKTOR)",
    logic: "Aktual = rata-rata progres unit; Target dari Kurva S; Deviasi, SPI & Telat (mgg) dihitung dari keduanya.",
  },
  kontraktorRank: {
    source: "kolom NAMA KONTRAKTOR + NILAI KONTRAK PER (m2)",
    logic: "Kontraktor diranking dari jumlah SPK yang dikerjakan dan total nilai kontraknya.",
  },

  // ---- Deviasi & SPI ----
  avgDeviasi: {
    source: "Dihitung: rata-rata (aktual − target) semua proyek",
    logic: "Negatif = tertinggal dari rencana, positif = lebih cepat. Target ±3%.",
  },
  deviasiTable: {
    source: "Per proyek dari PROGRES (%) vs TARGET (%)",
    logic: "Deviasi & SPI tiap proyek, diurut paling kritis dulu. Klik baris → detail + rekomendasi.",
  },

  // ---- KPI Direksi ----
  onTime: {
    source: "Proyek selesai/berjalan tepat waktu ÷ total proyek",
    logic: "% proyek on-time (deviasi di ambang aman). Target ≥ 95%.",
  },
  cluster: {
    source: "Agregasi proyek per cluster/kawasan (kode GP)",
    logic: "Rata-rata progres aktual vs target & deviasi per kawasan.",
  },
  kontraktorDev: {
    source: "Agregasi unit per NAMA KONTRAKTOR",
    logic: "Aktual, deviasi & SPI tiap kontraktor, paling kritis dulu (top 12).",
  },
  mutu: {
    source: "kolom KOMPLAIN & KETERANGAN KOMPLAIN (master)",
    logic: "Komplain open/total ditarik dari sheet. Defect & Recovery belum ada kolomnya di sheet → input manual.",
  },
};
