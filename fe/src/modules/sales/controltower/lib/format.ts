import type { Cat, Sev, StatusKey } from "../types";

/* ---------- formatters ---------- */
const nf = new Intl.NumberFormat("id-ID");

/** Integer with thousands separators (id-ID). */
export function num(n: number): string {
  return nf.format(Math.round(n));
}

/** Compact Rupiah label (full-Rupiah input). */
export function rpShort(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "Rp" + (n / 1e9).toFixed(2).replace(".", ",") + " M";
  if (abs >= 1e6) return "Rp" + (n / 1e6).toFixed(1).replace(".", ",") + " Jt";
  if (abs >= 1e3) return "Rp" + (n / 1e3).toFixed(0) + " Rb";
  return "Rp" + num(n);
}

/** Percentage with `d` decimals, comma decimal separator. */
export function pct(n: number, d = 0): string {
  return n.toFixed(d).replace(".", ",") + "%";
}

/* ---------- status palette ---------- */
export interface StatusDef {
  c: string;
  bg: string;
  label: string;
}

export const STATUS: Record<StatusKey, StatusDef> = {
  hijau: { c: "#1F9D54", bg: "#E8F6ED", label: "On Track" },
  kuning: { c: "#D9930B", bg: "#FCF4E2", label: "Risiko" },
  merah: { c: "#D6453A", bg: "#FBEAE8", label: "Off Track" },
  hitam: { c: "#3A4A40", bg: "#ECEFEC", label: "Data Kosong" },
};

/** Traffic-light status from a value against a target. */
export function statusFor(value: number, target: number | null, lowerBetter = false): StatusKey {
  if (!target) return "hijau";
  const r = value / target;
  if (lowerBetter) {
    if (value <= target) return "hijau";
    if (value <= target * 1.4) return "kuning";
    return "merah";
  }
  if (r >= 0.95) return "hijau";
  if (r >= 0.6) return "kuning";
  return "merah";
}

/* ---------- project categories ---------- */
export const CAT: Record<Cat, { label: string; c: string; bg: string }> = {
  utama: { label: "Mesin Utama", c: "#1F9D54", bg: "#E8F6ED" },
  pendukung: { label: "Pendukung", c: "#D9930B", bg: "#FCF4E2" },
  pembenahan: { label: "Pembenahan", c: "#D6453A", bg: "#FBEAE8" },
};

/* ---------- alert severities ---------- */
export const SEV: Record<Sev, { c: string; bg: string; label: string }> = {
  merah: { c: "#D6453A", bg: "#FBEAE8", label: "KRITIS" },
  kuning: { c: "#B97F09", bg: "#FCF4E2", label: "RISIKO" },
  hijau: { c: "#1F9D54", bg: "#E8F6ED", label: "PELUANG" },
};

/** Reason-code layer colours. */
export const LAYER_C: Record<string, string> = { L1: "#D6453A", L2: "#D9930B", L3: "#5FA8D3" };

/** Channel donut colour ramp. */
export const CH_C = ["#0E5C34", "#1F9D54", "#7CBE3B", "#5FA8D3", "#D9930B", "#A98BD0", "#C56B5C"];

/** Rank colour for the sales leaderboard. */
export function rankColor(i: number): string {
  return i === 0 ? "#0E5C34" : i < 3 ? "#1F9D54" : "#8FB89C";
}

/** Conversion colour: green ≥50, amber ≥33, red below. */
export function convColor(conv: number): string {
  return conv >= 50 ? "#1F9D54" : conv >= 33 ? "#D9930B" : "#D6453A";
}

/** Effectiveness CSS-class suffix (e.g. "No Akad" -> "noakad"). */
export function effClass(eff: string): string {
  return "eff-" + eff.toLowerCase().replace(/\s+/g, "");
}

/** Funnel conversion of stage i vs the previous stage (null for stage 0 / money). */
export function funnelConv(f: { value: number; isMoney?: boolean }[], i: number): number | null {
  if (i === 0) return null;
  if (f[i].isMoney) return null;
  const prev = f[i - 1].value;
  const cur = f[i].value;
  return prev ? (cur / prev) * 100 : 0;
}
