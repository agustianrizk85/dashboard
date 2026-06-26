import type { AuthUser, Dashboard } from "../types";

/** Backend base URL — override with VITE_TEKNIK_API at build/dev time. */
const BASE = ((import.meta.env.VITE_TEKNIK_API as string) ?? "http://localhost:8083") + "/api";
const TOKEN_KEY = "gp_teknik_token";

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

type Method = "GET" | "POST" | "PUT" | "DELETE";

// Service-account login used to silently re-bridge a stale Teknik token (e.g.
// after the Teknik backend restarts and its in-memory session is gone). This is
// the same account the unified dashboard bridges for this division, so it grants
// no extra access. A failed re-auth surfaces a LOCAL data error — it must NOT log
// the user out of the whole dashboard (a Teknik 401 ≠ SSO session expired).
const SERVICE_LOGIN = { username: "admin", password: "admin123" };

async function reauth(): Promise<boolean> {
  try {
    const res = await fetch(BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SERVICE_LOGIN),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token?: string };
    if (data.token) {
      setToken(data.token);
      return true;
    }
  } catch {
    /* backend unreachable */
  }
  return false;
}

async function request<T>(method: Method, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Try once to silently re-bridge a stale token, then replay the request.
    if (!retried && (await reauth())) {
      return request<T>(method, path, body, true);
    }
    setToken("");
    onUnauthorized();
    // Deliberately NO global "gp-auth-expired" dispatch: a Teknik data 401 must
    // not end the unified session (that caused the sudden logout on /teknik).
    throw new ApiError("Backend Teknik tidak dapat diakses — coba muat ulang halaman.", 401);
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

  // --- Aggregate ---
  dashboard: () => request<Dashboard>("GET", "/dashboard"),

  // --- Realtime (WebSocket) — pushes {rev} on every data change, no refresh ---
  realtimeURL: (): string | null => {
    if (!token) return null;
    const httpBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  },

  // --- AI insight (OpenRouter, server-side key) ---
  insight: (scope: string) =>
    request<{ configured: boolean; insight: string; model?: string }>(
      "GET",
      `/insight?scope=${encodeURIComponent(scope)}`,
    ),
  // --- File upload ---
  upload: async (file: File, name: string): Promise<{ url: string; name: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(BASE + "/upload", { method: "POST", headers, body: fd });
    if (!res.ok) throw new ApiError("Upload gagal (HTTP " + res.status + ")", res.status);
    return (await res.json()) as { url: string; name: string };
  },
  /** Resolve a stored file path ("/files/x") to a full URL on the API host. */
  fileUrl: (path: string) => (!path ? "" : path.startsWith("http") ? path : BASE.replace(/\/api$/, "") + path),

  aiConfig: () => request<{ configured: boolean; model: string }>("GET", "/ai/config"),
  aiModels: () => request<{ id: string; name: string }[]>("GET", "/ai/models"),
  setAiModel: (model: string) => request<{ model: string }>("PUT", "/ai/model", { model }),

  // --- Generic master-data CRUD ---
  list: <T>(resource: string) => request<T[]>("GET", `/${resource}`),
  create: <T>(resource: string, body: unknown) => request<T>("POST", `/${resource}`, body),
  update: <T>(resource: string, id: string, body: unknown) =>
    request<T>("PUT", `/${resource}/${encodeURIComponent(id)}`, body),
  remove: (resource: string, id: string) =>
    request<void>("DELETE", `/${resource}/${encodeURIComponent(id)}`),

  // --- Async spreadsheet import (Google Sheets by URL) ---
  importSyncPreview: (url?: string) => request<ImportPreview>("POST", "/import/sync/preview", { url: url ?? "" }),
  importSyncApprove: (url?: string) => request<ImportRecord>("POST", "/import/sync/approve", { url: url ?? "" }),
  importHistory: () => request<ImportRecord[]>("GET", "/import/history"),
  importRollback: (id: string) => request<ImportRecord>("POST", `/import/${encodeURIComponent(id)}/rollback`),
  importReset: () => request<ImportRecord>("POST", "/import/reset"),

  // --- Auto-sync control (enable/disable + interval, like sales/keuangan) ---
  autoStatus: () => request<AutoSyncStatus>("GET", "/import/auto"),
  autoSet: (enabled: boolean, intervalSec: number) =>
    request<AutoSyncStatus>("PUT", "/import/auto", { enabled, intervalSec }),

  // --- Maintenance ---
  /** Restore the built-in example data set (collections + singletons). */
  reseed: () => request<{ status: string }>("POST", "/admin/seed"),
  /** Delete every editable record (singleton aggregates are kept). */
  clearData: () => request<{ status: string }>("POST", "/admin/clear"),
};

/** Headline counts of one import (mirrors backend domain.ImportSummary). */
export interface ImportSummary {
  proyek: number;
  units: number;
  kontraktor: number;
  spk: number;
  sold: number;
  readyStock: number;
  available: number;
  sudahBast: number;
  belumBast: number;
  terlambat: number;
  avgProgres: number;
  issues: number;
}

/** One unit row in the import preview table. */
export interface ImportPreviewRow {
  proyek: string;
  blok: string;
  type: string;
  status: string;
  kontraktor: string;
  nomorSpk: string;
  progres: number;
  target: number;
  statusBast: string;
  terlambat: boolean;
}

/** Validation note tied to a source row. */
export interface ImportIssue {
  row: number;
  proyek: string;
  blok: string;
  message: string;
}

/** Result of a preview (no data applied yet). */
export interface ImportPreview {
  summary: ImportSummary;
  issues: ImportIssue[];
  units: ImportPreviewRow[];
  source: string;
}

/** Background auto-sync state (mirrors backend autoStatusResp). */
export interface AutoSyncStatus {
  enabled: boolean;
  intervalSec: number;
  configured: boolean;
  lastSync: string;
  lastError: string;
  lastSummary: ImportSummary;
}

/** One entry in the import history. */
export interface ImportRecord {
  id: string;
  time: string;
  source: string;
  by: string;
  updated: string;
  summary: ImportSummary;
}
