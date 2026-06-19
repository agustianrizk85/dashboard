// Frontend-only persistence for fields the planning backend does not model yet
// (per-deliverable schedule dates, and image attachments on a gambar-kerja flow).
// These live in localStorage so the demo keeps them across reloads until the
// unified backend grows real columns for them. When the backend catches up,
// swap these helpers for API calls — the call sites only use these functions.

/* ---- Per-task schedule dates (Proyek view) ----------------------------- */

export interface TaskDates {
  start?: string; // tanggal mulai (YYYY-MM-DD)
  deadline?: string; // batas waktu
  finish?: string; // tanggal selesai
}

const TASK_DATES_KEY = "gp_perencanaan_task_dates";
const WD_ATTACH_KEY = "gp_perencanaan_wd_attachments";

function readMap<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}

function writeMap<T>(key: string, map: Record<string, T>): void {
  localStorage.setItem(key, JSON.stringify(map));
}

export function getTaskDates(taskId: string): TaskDates {
  return readMap<TaskDates>(TASK_DATES_KEY)[taskId] ?? {};
}

export function setTaskDates(taskId: string, dates: TaskDates): void {
  const map = readMap<TaskDates>(TASK_DATES_KEY);
  const cleaned: TaskDates = {
    start: dates.start || undefined,
    deadline: dates.deadline || undefined,
    finish: dates.finish || undefined,
  };
  if (!cleaned.start && !cleaned.deadline && !cleaned.finish) delete map[taskId];
  else map[taskId] = cleaned;
  writeMap(TASK_DATES_KEY, map);
}

/* ---- Attachments on a gambar-kerja flow (Gambar Kerja view) ------------ */

export interface Attachment {
  name: string;
  /** Data URL of the uploaded image, so it survives a reload. */
  dataUrl: string;
  uploadedAt: string;
}

export function getAttachments(drawingId: string): Attachment[] {
  return readMap<Attachment[]>(WD_ATTACH_KEY)[drawingId] ?? [];
}

export function setAttachments(drawingId: string, list: Attachment[]): void {
  const map = readMap<Attachment[]>(WD_ATTACH_KEY);
  if (list.length === 0) delete map[drawingId];
  else map[drawingId] = list;
  writeMap(WD_ATTACH_KEY, map);
}

/* ---- Schedule alert helpers -------------------------------------------- */

/** Whole calendar days from today until an ISO date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = new Date(iso + "T00:00:00");
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

import type { Rag } from "../types";

/**
 * Severity of a task deadline, mirroring the gambar-kerja alert logic: done is
 * never flagged, an empty deadline is neutral, otherwise red when overdue, amber
 * within 3 days, green when comfortably ahead.
 */
export function deadlineSev(deadline: string | undefined, done: boolean): Rag {
  if (!deadline || done) return "grey";
  const left = daysUntil(deadline);
  if (left < 0) return "red";
  if (left <= 3) return "amber";
  return "green";
}
