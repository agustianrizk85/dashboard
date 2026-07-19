import type {
  AlertItem,
  AssignedTask,
  AuthUser,
  Blok,
  BuildingType,
  Division,
  DivisionOutputs,
  GKFinding,
  GP,
  Kavling,
  Lebar,
  Lokasi,
  MasterData,
  ProjectDetail,
  ProjectRollup,
  StaffMember,
  Summary,
  TaskStatus,
  WorkDrawing,
} from "../types";

/** A checklist skill file the AI features can apply. */
export interface SkillMeta {
  name: string; // slug id (filename without .md)
  title: string; // first heading, else the name
  size: number;
}

/** Deep Analisis AI state for a task's review PDF (poll response). */
export interface TaskAIState {
  aiStatus?: "" | "idle" | "running" | "done" | "failed";
  aiDone?: number; // pages analysed so far (progress while running)
  aiTotal?: number; // total pages to analyse
  aiFindings?: GKFinding[];
  aiSkills?: string[]; // skill names applied this run
  aiAnnotated?: { name: string; size: number }; // result PDF present when set
  aiError?: string;
  aiCheckedAt?: string;
}

/** Backend base URL — override with VITE_PERENCANAAN_API at build/dev time. */
const BASE = (import.meta.env.VITE_PERENCANAAN_API ?? "http://localhost:8082") + "/api";

/** Deep Revisi AI status (read-only): central Kunci AI is set (Panel Admin) and
 *  which models it uses. The vision model is managed centrally, not here. */
export interface GkConfig {
  keyConfigured: boolean; // central Kunci AI set in Panel Admin (via auth)
  keyModel: string; // general (text) model — info only
  visionModel: string; // vision model used by Deep Revisi (set in Panel Admin)
}
const TOKEN_KEY = "gp_perencanaan_token";

/** Error carrying the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let token = localStorage.getItem(TOKEN_KEY) ?? "";

// Called when the server reports the session is no longer valid (401).
let onUnauthorized: () => void = () => {};

function setToken(value: string) {
  token = value;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken("");
    onUnauthorized();
    throw new ApiError("Sesi berakhir — silakan login kembali.", 401);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* no JSON body */
    }
    throw new ApiError(detail || `HTTP ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface AddProjectInput {
  gp: string;
  name: string;
  lokasi: string;
  luas: string;
  units: number;
  types: number;
  sitePlans: number;
  includeUnit: boolean;
  includeKawasan: boolean;
}

export interface AddTaskInput {
  category: string;
  group: string;
  name: string;
  pic: string;
  output: Division;
  weighted: boolean;
}

export interface CreateWorkDrawingInput {
  projectId: string;
  konsumen: string;
  unit: string;
  pic?: string;
  infoMasuk?: string;
}

export type WorkDrawingAction = "konsumen-selesai" | "ttd-konsumen" | "kontraktor-selesai";

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const api = {
  base: BASE,
  hasToken: () => !!token,
  setUnauthorizedHandler: (fn: () => void) => {
    onUnauthorized = fn;
  },

  /** WebSocket URL for realtime push (null when not authenticated). Builds an
   *  absolute ws/wss URL even when BASE is relative. */
  realtimeURL: (): string | null => {
    if (!token) return null;
    const httpBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  },

  // --- Auth ---
  login: async (username: string, password: string): Promise<AuthUser> => {
    const r = await request<LoginResponse>("POST", "/auth/login", { username, password });
    setToken(r.token);
    return r.user;
  },
  me: () => request<AuthUser>("GET", "/auth/me"),
  logout: async (): Promise<void> => {
    try {
      await request<void>("POST", "/auth/logout");
    } finally {
      setToken("");
    }
  },

  // --- Portfolio overview ---
  summary: () => request<Summary>("GET", "/summary"),

  // --- Full cicle Kanban board mirror ---
  cicleBoard: () => request<unknown>("GET", "/cicle-board"),

  // --- Projects + deliverable tree ---
  projects: () => request<ProjectRollup[]>("GET", "/projects"),
  project: (id: string) => request<ProjectDetail>("GET", `/projects/${id}`),
  addProject: (input: AddProjectInput) => request<ProjectDetail>("POST", "/projects", input),
  updateTask: (projectId: string, taskId: string, status: TaskStatus) =>
    request<ProjectDetail>("PATCH", `/projects/${projectId}/tasks/${taskId}`, { status }),

  // --- Dynamic deliverable structure editing (CEO/Kadep) ---
  addTask: (projectId: string, input: AddTaskInput) =>
    request<ProjectDetail>("POST", `/projects/${projectId}/tasks`, input),
  removeTask: (projectId: string, taskId: string) =>
    request<ProjectDetail>("DELETE", `/projects/${projectId}/tasks/${taskId}`),
  reassignTask: (projectId: string, taskId: string, pic: string, output: Division) =>
    request<ProjectDetail>("PATCH", `/projects/${projectId}/tasks/${taskId}/assign`, { pic, output }),

  // --- Review flow: upload PDF, view, approve (-> Selesai), reject ---
  uploadTaskDoc: async (projectId: string, taskId: string, file: File): Promise<ProjectDetail> => {
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(`${BASE}/projects/${projectId}/tasks/${taskId}/doc`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (res.status === 401) {
      setToken("");
      onUnauthorized();
      throw new ApiError("Sesi berakhir — silakan login kembali.", 401);
    }
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { error?: string }).error ?? "";
      } catch {
        /* no JSON body */
      }
      throw new ApiError(detail || `HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as ProjectDetail;
  },
  // Fetch the PDF (with auth) and return an object URL for in-app rendering.
  // The caller is responsible for URL.revokeObjectURL when done.
  taskDocUrl: async (projectId: string, taskId: string): Promise<string> => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(`${BASE}/projects/${projectId}/tasks/${taskId}/doc`, { headers });
    if (res.status === 401) {
      setToken("");
      onUnauthorized();
      throw new ApiError("Sesi berakhir — silakan login kembali.", 401);
    }
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  approveTask: (projectId: string, taskId: string) =>
    request<ProjectDetail>("POST", `/projects/${projectId}/tasks/${taskId}/approve`),
  rejectTask: (projectId: string, taskId: string) =>
    request<ProjectDetail>("POST", `/projects/${projectId}/tasks/${taskId}/reject`),

  // --- Deep Analisis AI on a task's review PDF (single-document vision QC) ---
  startTaskAI: (projectId: string, taskId: string, skills?: string[]) =>
    request<{ status: string }>("POST", `/projects/${projectId}/tasks/${taskId}/deep-analisis`, { skills: skills ?? [] }),
  taskAIStatus: (projectId: string, taskId: string) =>
    request<TaskAIState>("GET", `/projects/${projectId}/tasks/${taskId}/deep-analisis`),
  taskAIPdfUrl: async (projectId: string, taskId: string): Promise<string> => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(`${BASE}/projects/${projectId}/tasks/${taskId}/deep-analisis/pdf`, { headers });
    if (res.status === 401) {
      setToken("");
      onUnauthorized();
      throw new ApiError("Sesi berakhir — silakan login kembali.", 401);
    }
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return URL.createObjectURL(await res.blob());
  },

  // --- Multi-skill: checklist markdown files the AI features apply ---
  skills: () => request<SkillMeta[]>("GET", "/gk/skills"),
  skillGet: (name: string) => request<{ name: string; content: string }>("GET", `/gk/skills/${encodeURIComponent(name)}`),
  saveSkillNamed: (name: string, content: string) =>
    request<{ name: string; content: string; status: string }>("PUT", `/gk/skills/${encodeURIComponent(name)}`, { content }),
  createSkill: (name: string, title: string) =>
    request<SkillMeta>("POST", "/gk/skills", { name, title }),
  deleteSkill: (name: string) =>
    request<{ status: string }>("DELETE", `/gk/skills/${encodeURIComponent(name)}`),

  // --- Task assignment by PIC ---
  myTasks: (pic?: string) =>
    request<AssignedTask[]>("GET", pic ? `/my-tasks?pic=${encodeURIComponent(pic)}` : "/my-tasks"),

  // --- Outputs by division ---
  outputs: () => request<DivisionOutputs[]>("GET", "/outputs"),

  // --- Working-drawing flow + alerts ---
  workDrawings: () => request<WorkDrawing[]>("GET", "/workdrawings"),
  createWorkDrawing: (input: CreateWorkDrawingInput) =>
    request<WorkDrawing>("POST", "/workdrawings", input),
  advanceWorkDrawing: (id: string, action: WorkDrawingAction, date?: string) =>
    request<WorkDrawing>("PATCH", `/workdrawings/${id}`, { action, date }),
  reviseWorkDrawing: (id: string, instruction: string) =>
    request<WorkDrawing>("POST", `/workdrawings/${id}/revisi`, { instruction }),
  alerts: () => request<AlertItem[]>("GET", "/alerts"),

  // --- Deep Revisi AI (GK Kontraktor vs GK TTD vision check) ---
  uploadGK: async (id: string, kind: "kontraktor" | "ttd", file: File): Promise<WorkDrawing> => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/workdrawings/${id}/gk/${kind}`, {
      method: "POST",
      headers,
      body: form,
    });
    if (res.status === 401) {
      setToken("");
      onUnauthorized();
      throw new ApiError("Sesi berakhir — silakan login kembali.", 401);
    }
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { error?: string }).error ?? "";
      } catch {
        /* no JSON body */
      }
      throw new ApiError(detail || `HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as WorkDrawing;
  },
  startDeepRevisi: (id: string) =>
    request<{ status: string }>("POST", `/workdrawings/${id}/deep-revisi`),
  deepRevisiStatus: (id: string) => request<WorkDrawing>("GET", `/workdrawings/${id}/deep-revisi`),
  // Deep Revisi AI status (read-only): central Kunci AI + models from Panel Admin.
  gkConfig: () => request<GkConfig>("GET", "/gk/config"),
  // Deep Revisi AI "skill": the editable checklist markdown the vision AI follows.
  gkSkill: () => request<{ content: string; fromFile: boolean }>("GET", "/gk/skill"),
  saveGkSkill: (content: string) =>
    request<{ content: string; fromFile: boolean; status: string }>("PUT", "/gk/skill", { content }),
  // Fetch a GK PDF (kontraktor/ttd/annotated) with auth and return an object
  // URL for in-app rendering, same pattern as taskDocUrl.
  gkDocUrl: async (id: string, kind: "kontraktor" | "ttd" | "annotated"): Promise<string> => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(`${BASE}/workdrawings/${id}/gk/${kind}`, { headers });
    if (res.status === 401) {
      setToken("");
      onUnauthorized();
      throw new ApiError("Sesi berakhir — silakan login kembali.", 401);
    }
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // --- Staff / team ---
  staff: () => request<StaffMember[]>("GET", "/staff"),

  // --- Master reference data ---
  master: () => request<MasterData>("GET", "/master"),

  // --- GP (grup) master ---
  saveGP: (gp: Partial<GP>) =>
    gp.id
      ? request<GP>("PATCH", `/gps/${gp.id}`, gp)
      : request<GP>("POST", "/gps", gp),
  deleteGP: (id: string) => request<{ status: string }>("DELETE", `/gps/${id}`),

  // --- Building-type master ---
  saveBuildingType: (t: Partial<BuildingType>) =>
    t.id
      ? request<BuildingType>("PATCH", `/building-types/${t.id}`, t)
      : request<BuildingType>("POST", "/building-types", t),
  deleteBuildingType: (id: string) => request<{ status: string }>("DELETE", `/building-types/${id}`),

  // --- Lebar + Lokasi masters ---
  saveLebar: (l: Partial<Lebar>) => (l.id ? request<Lebar>("PATCH", `/lebars/${l.id}`, l) : request<Lebar>("POST", "/lebars", l)),
  deleteLebar: (id: string) => request<{ status: string }>("DELETE", `/lebars/${id}`),
  saveLokasi: (l: Partial<Lokasi>) => (l.id ? request<Lokasi>("PATCH", `/lokasis/${l.id}`, l) : request<Lokasi>("POST", "/lokasis", l)),
  deleteLokasi: (id: string) => request<{ status: string }>("DELETE", `/lokasis/${id}`),

  // --- Blok + Kavling per project (Fase 2) ---
  saveBlok: (projectId: string, b: Partial<Blok>) =>
    b.id
      ? request<Blok>("PATCH", `/projects/${projectId}/bloks/${b.id}`, b)
      : request<Blok>("POST", `/projects/${projectId}/bloks`, b),
  deleteBlok: (projectId: string, id: string) =>
    request<{ status: string }>("DELETE", `/projects/${projectId}/bloks/${id}`),
  saveKavling: (projectId: string, k: Partial<Kavling>) =>
    k.id
      ? request<Kavling>("PATCH", `/projects/${projectId}/kavling/${k.id}`, k)
      : request<Kavling>("POST", `/projects/${projectId}/kavling`, k),
  deleteKavling: (projectId: string, id: string) =>
    request<{ status: string }>("DELETE", `/projects/${projectId}/kavling/${id}`),

  // --- Admin (CEO & Kadep only) ---
  seed: () => request<{ status: string }>("POST", "/admin/seed"),
  resetProses: () => request<{ status: string }>("POST", "/admin/reset-proses"),
  resetMaster: () => request<{ status: string }>("POST", "/admin/reset-master"),
};
