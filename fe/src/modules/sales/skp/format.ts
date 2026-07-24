// Small formatting helpers for the SKP module (kept local to avoid a cross-module
// import into keuangan/purchasing).

/** Full-Rupiah label, e.g. 1856000 → "Rp 1.856.000". */
export function rpFull(n: number): string {
  return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
}

/** Human date label, e.g. "2026-07-24" → "24 Juli 2026". */
export function dateLabel(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Today as YYYY-MM-DD (local). */
export function todayISO(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
