import type { Status, Tone } from "../types";

/** Human label for each traffic-light status. */
export const STATUS_LABEL: Record<Status, string> = {
  green: "Sehat",
  yellow: "Waspada",
  red: "Kritis",
};

/** Pill tone for each traffic-light status. */
export const STATUS_TONE: Record<Status, Tone> = {
  green: "green",
  yellow: "yellow",
  red: "red",
};

/** CSS colour-variable suffix for a status (var(--ok|warn|bad)). */
export function statusVar(st: Status): "ok" | "warn" | "bad" {
  return st === "green" ? "ok" : st === "yellow" ? "warn" : "bad";
}

/** Map a free-form state string (status / kpi state / trigger status) to a pill tone. */
export function toneClass(st: string): Tone {
  switch (st) {
    case "green":
      return "green";
    case "yellow":
      return "yellow";
    case "crisis":
      return "crisis";
    case "red":
      return "red";
    case "orange":
      return "orange";
    case "navy":
      return "navy";
    default:
      return "neutral";
  }
}

/**
 * Format a Rupiah amount given in millions (Rp juta) into a compact label.
 * Values ≥ 1.000 juta are shown in billions (miliar) to keep the war-room view tidy.
 */
export function rp(juta: number): string {
  // Null-safe: the backend may omit numeric fields (Go emits null/undefined for
  // empty sections), and `undefined.toLocaleString()` would crash the whole view.
  const v = Number(juta) || 0;
  if (Math.abs(v) >= 1000) {
    const miliar = v / 1000;
    return "Rp " + miliar.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
  }
  return "Rp " + v.toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
}
