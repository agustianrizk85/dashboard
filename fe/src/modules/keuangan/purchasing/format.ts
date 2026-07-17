// Formatting + client-side compute helpers for the Purchasing module.
// Money here is FULL Rupiah integers (not the millions used by the akad dashboard).

import type { POItem, POTier } from "../types";

/** Full-Rupiah label, e.g. 1856000 → "Rp 1.856.000". */
export function rpFull(n: number): string {
  return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
}

/** Plain integer with thousands separators, e.g. 1856000 → "1.856.000". */
export function numId(n: number): string {
  return (Number(n) || 0).toLocaleString("id-ID");
}

/** Today as YYYY-MM-DD (local). */
export function todayISO(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Human date label, e.g. "2025-11-03" → "3 November 2025". */
export function dateLabel(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Threshold tier for a PO total (mirrors the backend rule):
 *  - < 500.000            → "none"   (tanpa PO, auto-approved)
 *  - 500.000 – 1.000.000  → "kadep"  (Kepala Departemen Keuangan)
 *  - > 1.000.000          → "dirops" (Dirops / CEO)
 */
export function tierFor(total: number): POTier {
  if (total < 500_000) return "none";
  if (total <= 1_000_000) return "kadep";
  return "dirops";
}

export function tierLabel(tier: POTier): string {
  switch (tier) {
    case "none":
      return "Tanpa PO (< Rp500.000)";
    case "kadep":
      return "Approval Kadep (≤ Rp1jt)";
    case "dirops":
      return "Approval Dirops (> Rp1jt)";
    default:
      return tier;
  }
}

/** Client-side preview of PO totals (backend is authoritative on save). */
export function computePoTotals(items: POItem[], potongan: number, biayaPengiriman: number) {
  const rows = items.map((it) => ({ ...it, jumlah: Math.round((Number(it.qty) || 0) * (Number(it.hargaSatuan) || 0)) }));
  const subTotal = rows.reduce((a, r) => a + r.jumlah, 0);
  const total = subTotal - (Number(potongan) || 0) + (Number(biayaPengiriman) || 0);
  return { rows, subTotal, total, tier: tierFor(total) };
}

/* ── terbilang (Indonesian number words) ──────────────────────────────────
 * e.g. 1_856_000 → "satu juta delapan ratus lima puluh enam ribu rupiah".
 * Mirrors the backend helper so the client preview reads the same.        */
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function terbilangInt(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilangInt(n - 10) + " belas";
  if (n < 100) return terbilangInt(Math.floor(n / 10)) + " puluh" + (n % 10 ? " " + terbilangInt(n % 10) : "");
  if (n < 200) return "seratus" + (n % 100 ? " " + terbilangInt(n % 100) : "");
  if (n < 1000) return terbilangInt(Math.floor(n / 100)) + " ratus" + (n % 100 ? " " + terbilangInt(n % 100) : "");
  if (n < 2000) return "seribu" + (n % 1000 ? " " + terbilangInt(n % 1000) : "");
  if (n < 1_000_000) return terbilangInt(Math.floor(n / 1000)) + " ribu" + (n % 1000 ? " " + terbilangInt(n % 1000) : "");
  if (n < 1_000_000_000) return terbilangInt(Math.floor(n / 1_000_000)) + " juta" + (n % 1_000_000 ? " " + terbilangInt(n % 1_000_000) : "");
  return terbilangInt(Math.floor(n / 1_000_000_000)) + " miliar" + (n % 1_000_000_000 ? " " + terbilangInt(n % 1_000_000_000) : "");
}

/** Full terbilang string ending in "rupiah". */
export function terbilang(n: number): string {
  const v = Math.floor(Math.abs(Number(n) || 0));
  if (v === 0) return "nol rupiah";
  return (terbilangInt(v) + " rupiah").replace(/\s+/g, " ").trim();
}
