// Pure formatting/derivation helpers shared by the Papan Tugas board views
// (BoardView + CardModal). UI language: Bahasa Indonesia; dates via id-ID.
import type { BoardAiFinding, BoardAttachment, BoardCard } from "./types";

/** Two-letter initials from a display name ("Budi Santoso" → "BS"). */
export function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Deterministic hue from a username so each person keeps one avatar color. */
function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** Avatar circle background for a username (hash → hue). */
export function avatarBg(username: string): string {
  return `hsl(${hueOf(username)}, 62%, 42%)`;
}

/** Dark or light text so a label chip stays readable on its color. */
export function labelTextColor(hex: string): string {
  const c = (hex || "").replace("#", "");
  if (c.length < 6) return "#fff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#fff";
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1f2937" : "#ffffff";
}

/** 8-color palette for new labels (Trello-like swatches). */
export const LABEL_COLORS = [
  "#61bd4f",
  "#f2d600",
  "#ff9f1a",
  "#eb5a46",
  "#c377e0",
  "#0079bf",
  "#00c2e0",
  "#51e898",
];

/** Human file size: 512 B / 87 KB / 4.2 MB / 1.05 GB. */
export function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(2) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

const MONTH_SHORT = new Intl.DateTimeFormat("id-ID", { month: "short" });

/** "6 Jul" — checklist done badges & card due chips. */
export function fmtDayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTH_SHORT.format(d)}`;
}

/** "Jul 06" — creator chip in the card modal header. */
export function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTH_SHORT.format(d)} ${String(d.getDate()).padStart(2, "0")}`;
}

/** "Jumat, 21 Nov 2025 04:00 PM" — the due-date pill. */
export function fmtDueLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const wk = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${wk}, ${date} ${String(h).padStart(2, "0")}:${mm} ${ap}`;
}

/** Relative when recent ("5 menit lalu"), absolute otherwise. */
export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** RFC3339 → value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type AttKind = "image" | "video" | "audio" | "pdf" | "other";

/** Classify an attachment for its renderer (img/video/audio/pdf/badge). */
export function attKind(a: BoardAttachment): AttKind {
  const m = a.mime || "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || /\.pdf$/i.test(a.name)) return "pdf";
  return "other";
}

/** Extension badge for non-previewable files ("DWG", "XLSX"). */
export function extBadge(a: BoardAttachment): string {
  const dot = a.name.lastIndexOf(".");
  if (dot > 0 && dot < a.name.length - 1) return a.name.slice(dot + 1).toUpperCase().slice(0, 5);
  return "FILE";
}

/** Aggregate checklist progress across all of a card's checklists. */
export function checklistAgg(card: BoardCard): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const cl of card.checklists ?? []) {
    for (const it of cl.items ?? []) {
      total++;
      if (it.done) done++;
    }
  }
  return { done, total };
}

/** Overdue = has a due date, not marked done, and the moment has passed. */
export function isOverdue(card: BoardCard): boolean {
  return !!card.due && !card.dueDone && new Date(card.due).getTime() < Date.now();
}

/** Split an AI finding (string or object) into { severity, text } for display. */
export function aiFindingParts(f: BoardAiFinding): { severity: string; text: string } {
  if (typeof f === "string") return { severity: "", text: f };
  // Deep Analisis/Revisi finding (GKFinding): page/wrong/correct/explain/confidence.
  if (f.wrong !== undefined || f.correct !== undefined || f.explain !== undefined) {
    const parts: string[] = [];
    if (f.page) parts.push(`Hal. ${f.page}`);
    if (f.wrong) parts.push(`❌ ${f.wrong}`);
    if (f.correct) parts.push(`✔ ${f.correct}`);
    if (f.explain) parts.push(f.explain);
    return { severity: f.confidence ?? "", text: parts.join(" · ") || JSON.stringify(f) };
  }
  const text = [f.title, f.text, f.detail, f.note].filter(Boolean).join(" — ");
  return { severity: f.severity ?? "", text: text || JSON.stringify(f) };
}
