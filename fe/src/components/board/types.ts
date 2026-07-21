// DTO types for the shared Papan Tugas (Trello/Cycle-style kanban board).
// These mirror the Go backend board DTOs exactly so API responses map straight
// onto them. Shared across modules — keep this file free of module imports.

export interface BoardLabel {
  id: string;
  name: string;
  color: string; // hex, e.g. "#61bd4f"
}

export interface BoardChecklistItem {
  id: string;
  text: string;
  done: boolean;
  doneAt: string; // RFC3339, "" = not done
  due: string; // RFC3339, "" = unset
}

export interface BoardChecklist {
  id: string;
  title: string;
  items: BoardChecklistItem[];
}

export interface BoardAttachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  by: string; // username uploader
  at: string; // RFC3339
}

export interface BoardComment {
  id: string;
  author: string; // username; "ai" = posted by the AI checker
  text: string;
  at: string; // RFC3339
}

/** A normal, free-form team card — exactly today's board card. The optional
 *  `type` discriminant is absent for free cards (backend omits it); it exists
 *  only so the union with {@link BoardTaskCard} narrows cleanly. */
export interface BoardFreeCard {
  type?: "card";
  id: string;
  listId: string;
  title: string;
  desc: string;
  members: string[]; // usernames
  labels: string[]; // label ids
  division: string; // department code, "" = none
  due: string; // RFC3339, "" = unset
  dueDone: boolean;
  cover: string; // attachment id, "" = none
  checklists: BoardChecklist[];
  attachments: BoardAttachment[];
  comments: BoardComment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** The four fixed workflow states of a formal project task, mirrored by the
 *  four system lists (sys-todo / sys-progress / sys-review / sys-done). */
export type BoardTaskStatus = "todo" | "progress" | "review" | "done";

/** Project a task belongs to (shown on the task tile subtitle / modal header). */
export interface BoardTaskProject {
  id: string;
  name: string;
  gp: string; // GP block/cluster code
}

/** The formal deliverable payload carried by a TASK card (read-only board
 *  view of a Data Master project task). */
export interface BoardTaskInfo {
  projectId: string;
  taskId: string;
  category: string;
  group: string;
  pic: string; // username of the person responsible
  output: string; // output division/target code
  status: BoardTaskStatus;
  weighted: number;
  hasDoc: boolean; // a review PDF has been uploaded
  approvedBy: string; // username; "" = not approved
  approvedAt: string; // RFC3339, "" = not approved
  revisiNote: string; // "" = no revision requested
  updatedAt: string;
}

/** A caller's formal project task, injected read-only into the board per-viewer
 *  (only the task's PIC sees it). Shares the free-card shape for the fields the
 *  shared tile/helpers touch, plus `project`/`task` payloads. */
export interface BoardTaskCard {
  type: "task";
  id: string; // "task-<pid>-<tid>"
  listId: string; // "sys-<status>"
  title: string;
  members: string[]; // [pic]
  labels: string[]; // []
  division: string; // "perencanaan"
  due: string; // ""
  dueDone: boolean; // false
  cover: string; // ""
  checklists: BoardChecklist[]; // []
  attachments: BoardAttachment[]; // []
  comments: BoardComment[]; // []
  createdBy: string; // pic
  project: BoardTaskProject;
  task: BoardTaskInfo;
}

/** Either kind of tile that can live in a system list. Discriminated on `type`
 *  ("task" ⇒ formal task card; absent/"card" ⇒ free team card). */
export type BoardCard = BoardFreeCard | BoardTaskCard;

/** True for injected formal project-task cards (narrows to {@link BoardTaskCard}). */
export function isTaskCard(c: BoardCard): c is BoardTaskCard {
  return c.type === "task";
}

/** Array order = display order (both lists and their cards). All four lists are
 *  now fixed system lists (`system: true`); there are no user-created lists. */
export interface BoardList {
  id: string;
  title: string;
  createdBy: string;
  system?: boolean;
  cards: BoardCard[];
}

export interface BoardUser {
  username: string;
  name: string;
  role: string;
  division: string;
}

/** Department from the central catalogue (e.g. { code: "teknik", name: "Teknik" }). */
export interface BoardDept {
  code: string;
  name: string;
}

export interface BoardMe {
  username: string;
  role: string;
  admin: boolean;
  division: string;
}

export interface BoardData {
  lists: BoardList[];
  labels: BoardLabel[];
  users: BoardUser[];
  departments: BoardDept[];
  me: BoardMe;
}

/* ---- AI check (Cek AI) on a pdf/image attachment ------------------------- */

/** One finding from the AI check. The backend may send plain strings or
 *  objects; only `severity` has UI meaning (badge), the rest is display text. */
export type BoardAiFinding =
  | string
  | {
      severity?: string;
      title?: string;
      text?: string;
      detail?: string;
      note?: string;
      // Deep Analisis / Deep Revisi (GKFinding) shape:
      page?: number;
      wrong?: string;
      correct?: string;
      explain?: string;
      confidence?: string; // "tinggi" | "sedang" | "rendah"
    };

/** GET /board/cards/{id}/ai-check response. */
export interface BoardAiCheck {
  status: "idle" | "running" | "done" | "error";
  attId?: string;
  summary?: string;
  findings?: BoardAiFinding[];
  error?: string;
  checkedAt?: string; // RFC3339
}

/** One available Deep Analisis skill (GET /board/skills). `name` is the id sent
 *  back in the deep-analisis `skills` array; `title` is the display label. */
export interface BoardSkill {
  name: string;
  title: string;
}

/** Deep Analisis state for a TASK card. The backend returns the task object
 *  (aiStatus/aiFindings/aiError/aiCheckedAt/aiAnnotated) — boardApi.taskAI
 *  normalizes it into this shape (aiStatus "" → "idle", "failed" → "error"),
 *  reusing {@link BoardAiFinding} + the "Hasil" panel styling. */
export interface BoardTaskAi {
  status: "idle" | "running" | "done" | "error";
  findings?: BoardAiFinding[];
  summary?: string;
  error?: string;
  checkedAt?: string; // RFC3339
  annotated?: boolean; // an annotated result PDF is available
  done?: number; // pages analysed so far
  total?: number; // total pages to analyse
}
