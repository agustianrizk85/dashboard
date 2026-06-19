import type {
  AlertItem,
  AssignedTask,
  AuthUser,
  Division,
  DivisionOutputs,
  MasterData,
  ProjectDetail,
  ProjectRollup,
  StaffMember,
  Summary,
  TaskStatus,
  WorkDrawing,
} from "../types";

/** Backend base URL — override with VITE_PERENCANAAN_API at build/dev time. */
const BASE = (import.meta.env.VITE_PERENCANAAN_API ?? "http://localhost:8082") + "/api";
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

  // --- Staff / team ---
  staff: () => request<StaffMember[]>("GET", "/staff"),

  // --- Master reference data ---
  master: () => request<MasterData>("GET", "/master"),

  // --- Admin (CEO & Kadep only) ---
  seed: () => request<{ status: string }>("POST", "/admin/seed"),
  resetProses: () => request<{ status: string }>("POST", "/admin/reset-proses"),
  resetMaster: () => request<{ status: string }>("POST", "/admin/reset-master"),
};
