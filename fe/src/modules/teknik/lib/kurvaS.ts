// Pure helpers for the construction progress / Kurva S engine. No React, no IO.
import type { ConstructionStage, ProgressUnit, Status, Tone } from "../types";

/** Unit completion % = Σ weight of checked stages ÷ Σ weight × 100. */
export function unitPct(unit: ProgressUnit, stages: ConstructionStage[]): number {
  const total = stages.reduce((a, s) => a + s.weight, 0) || 100;
  const done = stages.reduce((a, s) => a + (unit.stages?.[s.name] ? s.weight : 0), 0);
  return (done / total) * 100;
}

/** Traffic-light tone for a completion percentage. */
export function pctTone(pct: number): Status {
  if (pct >= 99.95) return "green";
  if (pct >= 50) return "yellow";
  return "red";
}

export interface DevStatus {
  label: string;
  tone: Tone;
}

/** Deviation category per the Modul Departemen Teknik (deviasi = aktual − target). */
export function deviationStatus(dev: number): DevStatus {
  if (dev >= 5) return { label: "Sangat Cepat", tone: "neutral" };
  if (dev >= 1) return { label: "Lebih Cepat", tone: "green" };
  if (dev >= -0.99) return { label: "On Schedule", tone: "green" };
  if (dev >= -4.99) return { label: "Warning", tone: "yellow" };
  return { label: "Critical Delay", tone: "red" };
}

/** Schedule Performance Index = aktual ÷ target. */
export function spi(actual: number, target: number): number {
  if (target <= 0) return actual > 0 ? 2 : 1;
  return actual / target;
}

/** Group stages by termin, preserving the stage order, for grid header colspans. */
export function groupByTermin(stages: ConstructionStage[]): { termin: string; stages: ConstructionStage[] }[] {
  const out: { termin: string; stages: ConstructionStage[] }[] = [];
  for (const s of stages) {
    const last = out[out.length - 1];
    if (last && last.termin === s.termin) last.stages.push(s);
    else out.push({ termin: s.termin, stages: [s] });
  }
  return out;
}
