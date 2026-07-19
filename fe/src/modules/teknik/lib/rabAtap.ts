// RAB "Pekerjaan Atap Pelana Baja Ringan" (AHSP PUPR 2026 style).
//
// Alur: dimensi bangunan -> geometri atap (kemiringan, panjang miring, luas) ->
// takeoff volume bahan & tenaga -> harga satuan -> total. Semua koefisien di
// bawah bisa disetel agar cocok dengan AHSP/standar internal. Geometri atap
// PELANA (dua bidang miring simetris).

/** Roof-cover options — effective coverage + typical batten (reng) spacing. */
export interface RoofCover {
  key: string;
  label: string;
  luasEfektif: number; // m² tertutup per lembar/unit
  jarakReng: number; // m, jarak antar reng bawaan
  satuanPenutup: string; // "lembar" | "bh" | "m²"
}

export const ROOF_COVERS: RoofCover[] = [
  { key: "metal_pasir", label: "Metal Pasir", luasEfektif: 0.48, jarakReng: 0.385, satuanPenutup: "lembar" },
  { key: "genteng_metal", label: "Genteng Metal", luasEfektif: 0.63, jarakReng: 0.38, satuanPenutup: "lembar" },
  { key: "spandek", label: "Spandek", luasEfektif: 0.9, jarakReng: 1.0, satuanPenutup: "lembar" },
  { key: "genteng_beton", label: "Genteng Beton", luasEfektif: 0.09, jarakReng: 0.32, satuanPenutup: "bh" },
];

/** Tunable takeoff coefficients. Defaults are practical rules-of-thumb. */
export const COEF = {
  panjangBatang: 6, // m per batang C75 / reng
  c75PerM2: 4.0, // m profil C75 per m² atap (kuda-kuda + top chord)
  bautPerM2: 15, // screw per m² atap
  dynaboltPerKuda: 2, // dynabolt per kuda-kuda (angkur tumpuan)
  nokEfektif: 0.86, // m tertutup per unit nok
  // mortar dudukan nok (untuk penutup genteng; metal pasir ~0)
  semenPerNok: 0, // kg PC per m' nok
  pasirPerNok: 0, // m³ pasir per m' nok
  semenWarnaPerNok: 0, // kg per m' nok
  pakuPerM2: 0, // kg paku per m² (baja ringan pakai screw)
};

/** AHSP labor coefficients (OH per m² luas atap terpasang). */
export const LABOR = {
  pekerja: 0.15,
  tukang: 0.15,
  kepalaTukang: 0.015,
  mandor: 0.0075,
};

export interface RabInput {
  lebar: number; // Lebar bangunan (m)
  panjang: number; // Panjang bangunan (m)
  tinggiKuda: number; // Tinggi kuda-kuda (m) -> menentukan kemiringan
  overstekLebar: number; // Overstek sisi lebar / tritisan (m)
  overstekPanjang: number; // Overstek sisi panjang / gable (m)
  jarakKuda: number; // Jarak antar kuda-kuda (m)
  cover: string; // key RoofCover
  jarakReng: number; // m (override; default dari cover)
}

export const DEFAULT_INPUT: RabInput = {
  lebar: 6,
  panjang: 12,
  tinggiKuda: 1.5,
  overstekLebar: 0.8,
  overstekPanjang: 0.6,
  jarakKuda: 1.2,
  cover: "metal_pasir",
  jarakReng: 0.385,
};

export interface Geometry {
  kemiringanDeg: number;
  panjangBidangMiring: number; // ridge -> dinding (per sisi)
  panjangMiringOverstek: number; // bagian overstek (per sisi)
  slopedPerSide: number; // total miring per sisi
  panjangAtap: number; // panjang sepanjang nok (L + 2·overstek panjang)
  jumlahKuda: number;
  luasAtap: number; // total dua bidang
}

export function computeGeometry(i: RabInput): Geometry {
  const run = i.lebar / 2;
  const rad = run > 0 ? Math.atan2(i.tinggiKuda, run) : 0;
  const cos = Math.cos(rad);
  const kemiringanDeg = (rad * 180) / Math.PI;
  const panjangBidangMiring = cos > 0 ? run / cos : 0;
  const panjangMiringOverstek = cos > 0 ? i.overstekLebar / cos : 0;
  const slopedPerSide = panjangBidangMiring + panjangMiringOverstek;
  const panjangAtap = i.panjang + 2 * i.overstekPanjang;
  const jumlahKuda = i.panjang > 0 && i.jarakKuda > 0 ? Math.ceil(i.panjang / i.jarakKuda) + 1 : 0;
  const luasAtap = 2 * slopedPerSide * panjangAtap;
  return { kemiringanDeg, panjangBidangMiring, panjangMiringOverstek, slopedPerSide, panjangAtap, jumlahKuda, luasAtap };
}

export interface Recap {
  panjangC75: number; // m total
  batangC75: number; // btg
  rengRowsPerSide: number;
  panjangReng: number; // m total
  batangReng: number; // btg
  jumlahPenutup: number; // lembar/bh
  panjangNok: number; // m
  jumlahNok: number; // bh
  panjangListplank: number; // m
}

export function computeRecap(i: RabInput, g: Geometry, cover: RoofCover): Recap {
  const panjangC75 = g.luasAtap * COEF.c75PerM2;
  const batangC75 = Math.ceil(panjangC75 / COEF.panjangBatang);
  const rengRowsPerSide = g.slopedPerSide > 0 && i.jarakReng > 0 ? Math.ceil(g.slopedPerSide / i.jarakReng) : 0;
  const panjangReng = 2 * rengRowsPerSide * g.panjangAtap;
  const batangReng = Math.ceil(panjangReng / COEF.panjangBatang);
  const jumlahPenutup = g.luasAtap > 0 && cover.luasEfektif > 0 ? Math.ceil(g.luasAtap / cover.luasEfektif) : 0;
  const panjangNok = g.panjangAtap;
  const jumlahNok = panjangNok > 0 ? Math.ceil(panjangNok / COEF.nokEfektif) : 0;
  const panjangListplank = 2 * g.panjangAtap; // tritisan dua sisi panjang
  return { panjangC75, batangC75, rengRowsPerSide, panjangReng, batangReng, jumlahPenutup, panjangNok, jumlahNok, panjangListplank };
}

export type LineKind = "tenaga" | "bahan";

export interface LineItem {
  id: string;
  kind: LineKind;
  uraian: string;
  satuan: string;
  volume: number;
  harga: number; // harga satuan (editable)
}

/** Default unit prices (Rp) — from the AHSP PUPR 2026 reference sheet. */
export const DEFAULT_PRICES: Record<string, number> = {
  pekerja: 100000,
  tukang: 145000,
  kepala_tukang: 175000,
  mandor: 200000,
  c75: 73000,
  baut: 200,
  dynabolt: 4000,
  reng: 32000,
  penutup: 112500,
  nok: 25600,
  semen: 1300,
  pasir: 275000,
  semen_warna: 7800,
  paku: 15000,
  listplank: 23000,
};

/** Build the priced line items for the 11.3 table. */
export function buildLines(g: Geometry, r: Recap, cover: RoofCover, prices: Record<string, number>): LineItem[] {
  const A = g.luasAtap;
  const P = (k: string) => prices[k] ?? DEFAULT_PRICES[k] ?? 0;
  return [
    { id: "pekerja", kind: "tenaga", uraian: "Pekerja", satuan: "OH", volume: A * LABOR.pekerja, harga: P("pekerja") },
    { id: "tukang", kind: "tenaga", uraian: "Tukang", satuan: "OH", volume: A * LABOR.tukang, harga: P("tukang") },
    { id: "kepala_tukang", kind: "tenaga", uraian: "Kepala Tukang", satuan: "OH", volume: A * LABOR.kepalaTukang, harga: P("kepala_tukang") },
    { id: "mandor", kind: "tenaga", uraian: "Mandor", satuan: "OH", volume: A * LABOR.mandor, harga: P("mandor") },

    { id: "c75", kind: "bahan", uraian: "Baja Ringan C75", satuan: "btg", volume: r.batangC75, harga: P("c75") },
    { id: "baut", kind: "bahan", uraian: "Baut (Screw driver)", satuan: "bh", volume: Math.ceil(A * COEF.bautPerM2), harga: P("baut") },
    { id: "dynabolt", kind: "bahan", uraian: "Dynabolt", satuan: "bh", volume: g.jumlahKuda * COEF.dynaboltPerKuda, harga: P("dynabolt") },
    { id: "reng", kind: "bahan", uraian: "Reng Baja Ringan", satuan: "btg", volume: r.batangReng, harga: P("reng") },
    { id: "penutup", kind: "bahan", uraian: cover.label, satuan: cover.satuanPenutup, volume: r.jumlahPenutup, harga: P("penutup") },
    { id: "nok", kind: "bahan", uraian: `Nok ${cover.label}`, satuan: "bh", volume: r.jumlahNok, harga: P("nok") },
    { id: "semen", kind: "bahan", uraian: "Semen Portland (PC)", satuan: "kg", volume: r.panjangNok * COEF.semenPerNok, harga: P("semen") },
    { id: "pasir", kind: "bahan", uraian: "Pasir Pasang", satuan: "m³", volume: r.panjangNok * COEF.pasirPerNok, harga: P("pasir") },
    { id: "semen_warna", kind: "bahan", uraian: "Semen Warna", satuan: "kg", volume: r.panjangNok * COEF.semenWarnaPerNok, harga: P("semen_warna") },
    { id: "paku", kind: "bahan", uraian: "Paku", satuan: "kg", volume: A * COEF.pakuPerM2, harga: P("paku") },
    { id: "listplank", kind: "bahan", uraian: "Lisplank GRC (L. 30 cm)", satuan: "m'", volume: r.panjangListplank, harga: P("listplank") },
  ];
}

export interface RabResult {
  geometry: Geometry;
  recap: Recap;
  lines: LineItem[];
  totalTenaga: number;
  totalBahan: number;
  total: number;
}

export function computeRAB(i: RabInput, prices: Record<string, number>): RabResult {
  const cover = ROOF_COVERS.find((c) => c.key === i.cover) ?? ROOF_COVERS[0];
  const geometry = computeGeometry(i);
  const recap = computeRecap(i, geometry, cover);
  const lines = buildLines(geometry, recap, cover, prices);
  const sum = (k: LineKind) => lines.filter((l) => l.kind === k).reduce((a, l) => a + l.volume * l.harga, 0);
  const totalTenaga = sum("tenaga");
  const totalBahan = sum("bahan");
  return { geometry, recap, lines, totalTenaga, totalBahan, total: totalTenaga + totalBahan };
}

/* ---- formatting helpers ---- */
export const fmtRp = (v: number) =>
  "Rp " + Math.round(v).toLocaleString("id-ID");
export const fmtNum = (v: number, d = 2) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
