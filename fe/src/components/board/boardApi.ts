// Self-contained fetch client for the shared Papan Tugas board. The board is
// served by the perencanaan backend, but its routes accept the dashboard SSO
// token from ANY division — so this client works from every module without the
// perencanaan api/client.ts. Keep this file free of module imports.
import type {
  BoardAiCheck,
  BoardAiFinding,
  BoardAttachment,
  BoardCard,
  BoardChecklist,
  BoardChecklistItem,
  BoardComment,
  BoardData,
  BoardLabel,
  BoardList,
  BoardSkill,
  BoardTaskAi,
  BoardTaskStatus,
} from "./types";

/** Raw Deep Analisis fields on the task object returned by the deep-analisis
 *  GET endpoint (all omitempty — absent until a run happens). */
interface RawTaskAi {
  aiStatus?: string; // "" | "running" | "done" | "failed"
  aiFindings?: BoardAiFinding[];
  aiError?: string;
  aiCheckedAt?: string;
  aiAnnotated?: { name?: string } | null;
  aiDone?: number;
  aiTotal?: number;
}

/** Backend base URL — override with VITE_PERENCANAAN_API at build/dev time. */
const BASE = (import.meta.env.VITE_PERENCANAAN_API ?? "http://localhost:8082") + "/api";

/** Perencanaan users carry a module token; every other division only has the
 *  dashboard SSO token (accepted by all board routes). Read fresh on every
 *  call so cross-module navigation / re-login is picked up immediately. */
function getToken(): string {
  return (
    localStorage.getItem("gp_perencanaan_token") ||
    localStorage.getItem("gp_dashboard_token") ||
    ""
  );
}

/** Error carrying the HTTP status so callers can branch on it (e.g. 409). */
export class BoardApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Shared client: never clears tokens or logs the user out globally — the
    // owning module manages its own session. Just surface the error.
    throw new BoardApiError("Sesi berakhir — silakan login kembali.", 401);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* no JSON body */
    }
    throw new BoardApiError(detail || `HTTP ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** PATCH /board/cards/{id} — listId+index moves/reorders; due:"" clears;
 *  division:"" clears the division. */
export interface BoardCardPatch {
  title?: string;
  desc?: string;
  due?: string;
  dueDone?: boolean;
  listId?: string;
  index?: number;
  cover?: string;
  division?: string;
}

export const boardApi = {
  base: BASE,

  /** WebSocket URL for realtime board pushes (null when not authenticated).
   *  Builds an absolute ws/wss URL even when BASE is relative. */
  wsUrl: (): string | null => {
    const token = getToken();
    if (!token) return null;
    const httpBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  },

  // --- Board ---
  board: () => request<BoardData>("GET", "/board"),

  // Lists
  createBoardList: (title: string) => request<BoardList>("POST", "/board/lists", { title }),
  updateBoardList: (listId: string, patch: { title?: string; index?: number }) =>
    request<BoardList>("PATCH", `/board/lists/${listId}`, patch),
  deleteBoardList: (listId: string) => request<void>("DELETE", `/board/lists/${listId}`),

  // Cards
  createBoardCard: (listId: string, title: string) =>
    request<BoardCard>("POST", "/board/cards", { listId, title }),
  boardCard: (cardId: string) => request<BoardCard>("GET", `/board/cards/${cardId}`),
  updateBoardCard: (cardId: string, patch: BoardCardPatch) =>
    request<BoardCard>("PATCH", `/board/cards/${cardId}`, patch),
  deleteBoardCard: (cardId: string) => request<void>("DELETE", `/board/cards/${cardId}`),

  // Card members
  addBoardMember: (cardId: string, username: string) =>
    request<void>("POST", `/board/cards/${cardId}/members`, { username }),
  removeBoardMember: (cardId: string, username: string) =>
    request<void>("DELETE", `/board/cards/${cardId}/members/${encodeURIComponent(username)}`),

  // Labels (board-level) + card labels
  createBoardLabel: (name: string, color: string) =>
    request<BoardLabel>("POST", "/board/labels", { name, color }),
  updateBoardLabel: (labelId: string, patch: { name?: string; color?: string }) =>
    request<void>("PATCH", `/board/labels/${labelId}`, patch),
  deleteBoardLabel: (labelId: string) => request<void>("DELETE", `/board/labels/${labelId}`),
  addBoardCardLabel: (cardId: string, labelId: string) =>
    request<void>("POST", `/board/cards/${cardId}/labels`, { labelId }),
  removeBoardCardLabel: (cardId: string, labelId: string) =>
    request<void>("DELETE", `/board/cards/${cardId}/labels/${labelId}`),

  // Checklists + items
  createBoardChecklist: (cardId: string, title: string) =>
    request<BoardChecklist>("POST", `/board/cards/${cardId}/checklists`, { title }),
  updateBoardChecklist: (cardId: string, clId: string, patch: { title?: string }) =>
    request<void>("PATCH", `/board/cards/${cardId}/checklists/${clId}`, patch),
  deleteBoardChecklist: (cardId: string, clId: string) =>
    request<void>("DELETE", `/board/cards/${cardId}/checklists/${clId}`),
  addBoardChecklistItem: (cardId: string, clId: string, text: string, due?: string) =>
    request<BoardChecklistItem>(
      "POST",
      `/board/cards/${cardId}/checklists/${clId}/items`,
      due ? { text, due } : { text },
    ),
  updateBoardChecklistItem: (
    cardId: string,
    clId: string,
    itemId: string,
    patch: { text?: string; done?: boolean; due?: string },
  ) => request<void>("PATCH", `/board/cards/${cardId}/checklists/${clId}/items/${itemId}`, patch),
  deleteBoardChecklistItem: (cardId: string, clId: string, itemId: string) =>
    request<void>("DELETE", `/board/cards/${cardId}/checklists/${clId}/items/${itemId}`),

  // Attachments — direct URL usable in <img>/<video>/<iframe> src (server
  // supports HTTP Range so video seeking works). download=1 forces download.
  boardAttachmentUrl: (attId: string, download?: boolean): string =>
    `${BASE}/board/attachments/${attId}?token=${encodeURIComponent(getToken())}` +
    (download ? "&download=1" : ""),
  /** Multipart upload via XHR so callers get progress events. Rejects locally
   *  for files over 1 GiB before touching the network. */
  uploadBoardAttachment: (
    cardId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<BoardAttachment> =>
    new Promise<BoardAttachment>((resolve, reject) => {
      if (file.size > 1 << 30) {
        reject(new BoardApiError("Maksimal 1GB", 413));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/board/cards/${cardId}/attachments`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401) {
          reject(new BoardApiError("Sesi berakhir — silakan login kembali.", 401));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as BoardAttachment);
          } catch {
            reject(new BoardApiError("Respons server tidak valid.", xhr.status));
          }
          return;
        }
        let detail = "";
        try {
          detail = (JSON.parse(xhr.responseText) as { error?: string }).error ?? "";
        } catch {
          /* no JSON body */
        }
        reject(new BoardApiError(detail || `HTTP ${xhr.status}`, xhr.status));
      };
      xhr.onerror = () => reject(new BoardApiError("Gagal mengunggah — jaringan bermasalah.", 0));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    }),
  deleteBoardAttachment: (cardId: string, attId: string) =>
    request<void>("DELETE", `/board/cards/${cardId}/attachments/${attId}`),

  // Comments
  addBoardComment: (cardId: string, text: string) =>
    request<BoardComment>("POST", `/board/cards/${cardId}/comments`, { text }),
  deleteBoardComment: (cardId: string, commentId: string) =>
    request<void>("DELETE", `/board/cards/${cardId}/comments/${commentId}`),

  // AI check (Cek AI) on a pdf/image attachment. POST answers 409 while a
  // check is already running and 400 for unsupported attachment types; on
  // done the backend auto-posts a card comment authored by "ai".
  startAiCheck: (cardId: string, attId: string, skill?: string) =>
    request<{ status: string }>(
      "POST",
      `/board/cards/${cardId}/ai-check`,
      skill ? { attId, skill } : { attId },
    ),
  aiCheck: (cardId: string) => request<BoardAiCheck>("GET", `/board/cards/${cardId}/ai-check`),

  /* ---- Formal project TASK cards (read-only board projection) ------------- */
  // TASK cards are the caller's own deliverables injected per-viewer. They live
  // under /board/task/{pid}/{tid}/… and are keyed by the task's projectId+taskId
  // (the tile carries both in card.task). All routes accept the same SSO token.

  /** Move a task between the four workflow states (drag or the modal segmented
   *  control) — PATCH sets the backing task's status. */
  taskSetStatus: (pid: string, tid: string, status: BoardTaskStatus) =>
    request<void>("PATCH", `/board/task/${pid}/${tid}`, { status }),

  /** Inline PDF of the uploaded review document (usable in <iframe> src). */
  taskDocUrl: (pid: string, tid: string): string =>
    `${BASE}/board/task/${pid}/${tid}/doc?token=${encodeURIComponent(getToken())}`,

  /** Upload/replace the review PDF via XHR so callers get progress events.
   *  Mirrors uploadBoardAttachment (1 GiB cap, 401/error surfacing). */
  uploadTaskDoc: (
    pid: string,
    tid: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (file.size > 1 << 30) {
        reject(new BoardApiError("Maksimal 1GB", 413));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/board/task/${pid}/${tid}/doc`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401) {
          reject(new BoardApiError("Sesi berakhir — silakan login kembali.", 401));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        let detail = "";
        try {
          detail = (JSON.parse(xhr.responseText) as { error?: string }).error ?? "";
        } catch {
          /* no JSON body */
        }
        reject(new BoardApiError(detail || `HTTP ${xhr.status}`, xhr.status));
      };
      xhr.onerror = () => reject(new BoardApiError("Gagal mengunggah — jaringan bermasalah.", 0));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    }),

  // Task attachments — mirror the free-card attachment API (ANY type, 1 GiB,
  // Range-capable inline URL). Live under /board/task/{pid}/{tid}/attachments.

  /** Direct URL usable in <img>/<video>/<audio>/<iframe> src (server supports
   *  HTTP Range so video seeking works). download=1 forces download. */
  taskAttachmentUrl: (pid: string, tid: string, attId: string, download?: boolean): string =>
    `${BASE}/board/task/${pid}/${tid}/attachments/${attId}?token=${encodeURIComponent(getToken())}` +
    (download ? "&download=1" : ""),

  /** Multipart upload via XHR so callers get progress events. Rejects locally
   *  for files over 1 GiB before touching the network. */
  uploadTaskAttachment: (
    pid: string,
    tid: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<BoardAttachment> =>
    new Promise<BoardAttachment>((resolve, reject) => {
      if (file.size > 1 << 30) {
        reject(new BoardApiError("Maksimal 1GB", 413));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/board/task/${pid}/${tid}/attachments`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401) {
          reject(new BoardApiError("Sesi berakhir — silakan login kembali.", 401));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as BoardAttachment);
          } catch {
            reject(new BoardApiError("Respons server tidak valid.", xhr.status));
          }
          return;
        }
        let detail = "";
        try {
          detail = (JSON.parse(xhr.responseText) as { error?: string }).error ?? "";
        } catch {
          /* no JSON body */
        }
        reject(new BoardApiError(detail || `HTTP ${xhr.status}`, xhr.status));
      };
      xhr.onerror = () => reject(new BoardApiError("Gagal mengunggah — jaringan bermasalah.", 0));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    }),

  deleteTaskAttachment: (pid: string, tid: string, attId: string) =>
    request<void>("DELETE", `/board/task/${pid}/${tid}/attachments/${attId}`),

  /** Task discussion thread (mirrors free-card comments). */
  addTaskComment: (pid: string, tid: string, text: string) =>
    request<BoardComment>("POST", `/board/task/${pid}/${tid}/comments`, { text }),
  deleteTaskComment: (pid: string, tid: string, commentId: string) =>
    request<void>("DELETE", `/board/task/${pid}/${tid}/comments/${commentId}`),

  /** Available Deep Analisis skills (name = id sent back, title = label). */
  boardSkills: () => request<BoardSkill[]>("GET", "/board/skills"),

  /** Admin approves the reviewed task. */
  approveTask: (pid: string, tid: string) =>
    request<void>("POST", `/board/task/${pid}/${tid}/approve`, {}),

  /** Admin requests a revision with a note (reject). */
  rejectTask: (pid: string, tid: string, note: string) =>
    request<void>("POST", `/board/task/${pid}/${tid}/reject`, { note }),

  /** Kick a Deep Analisis AI run (409 = one already running). `skills` is the
   *  list of selected skill names (empty → backend default skill). `attId`, when
   *  given, analyses that PDF attachment; omitted analyses the review doc. */
  startTaskAI: (pid: string, tid: string, skills: string[], attId?: string) =>
    request<unknown>("POST", `/board/task/${pid}/${tid}/deep-analisis`, {
      skills,
      ...(attId ? { attId } : {}),
    }),

  /** Current Deep Analisis state. The endpoint returns the backing task object
   *  (aiStatus/aiFindings/aiError/aiCheckedAt/aiAnnotated); normalize it into the
   *  BoardTaskAi shape the modal consumes (aiStatus "" → "idle", "failed" →
   *  "error"). */
  taskAI: async (pid: string, tid: string): Promise<BoardTaskAi> => {
    const t = await request<RawTaskAi>("GET", `/board/task/${pid}/${tid}/deep-analisis`);
    const raw = (t.aiStatus ?? "").toLowerCase();
    const status: BoardTaskAi["status"] =
      raw === "running" ? "running" : raw === "done" ? "done" : raw === "failed" ? "error" : "idle";
    return {
      status,
      findings: t.aiFindings ?? [],
      error: t.aiError ?? "",
      checkedAt: t.aiCheckedAt ?? "",
      annotated: !!t.aiAnnotated,
      done: t.aiDone ?? 0,
      total: t.aiTotal ?? 0,
    };
  },

  /** Annotated PDF produced by Deep Analisis (usable in <iframe> src). */
  taskAIPdfUrl: (pid: string, tid: string): string =>
    `${BASE}/board/task/${pid}/${tid}/deep-analisis/pdf?token=${encodeURIComponent(getToken())}`,
};
