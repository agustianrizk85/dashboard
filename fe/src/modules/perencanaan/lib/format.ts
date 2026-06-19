// Shared display helpers: labels, colours and small formatters used across the
// planning dashboard views.

import type { Rag, TaskStatus } from "../types";

/** Display name for each author / PIC username. */
export const PIC_NAMES: Record<string, string> = {
  randi: "Randi",
  ananto: "Ananto",
  agus: "Agus",
};

export function picName(pic: string): string {
  return PIC_NAMES[pic] ?? pic;
}

/** Role labels (Indonesian). */
export const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  kadep: "Kepala Departemen",
  arsitek: "Arsitek",
  drafter: "Drafter",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Status labels + the traffic-light class each maps to. */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Belum",
  progress: "Proses",
  review: "Review",
  done: "Selesai",
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "progress", "review", "done"];

export function statusRag(status: TaskStatus): Rag {
  switch (status) {
    case "done":
      return "green";
    case "review":
      return "amber";
    case "progress":
      return "amber";
    default:
      return "grey";
  }
}

/** Map a RAG to the stylesheet's tone class (ok/warn/bad/grey). */
export function ragTone(rag: Rag): "ok" | "warn" | "bad" | "grey" {
  switch (rag) {
    case "green":
      return "ok";
    case "amber":
      return "warn";
    case "red":
      return "bad";
    default:
      return "grey";
  }
}

/** Format an ISO date (YYYY-MM-DD) as e.g. "23 Jun 2026"; passthrough if empty. */
export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** A short "n hari kerja" label, signed for overdue. */
export function fmtDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return `Telat ${-daysLeft} hk`;
  if (daysLeft === 0) return "Jatuh tempo hari ini";
  return `${daysLeft} hk lagi`;
}
