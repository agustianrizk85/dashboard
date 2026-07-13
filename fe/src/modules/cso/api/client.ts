import type {
  Alert,
  AuthUser,
  AutoSyncStatus,
  Dashboard,
  ImportPreview,
  ImportRecord,
  Ticket,
} from "../types";

/** Backend base URL — override with VITE_CSO_API at build/dev time. */
const BASE = ((import.meta.env.VITE_CSO_API as string) ?? "http://localhost:8088") + "/api";
const TOKEN_KEY = "gp_cso_token";

/** Error carrying the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let token = localStorage.getItem(TOKEN_KEY) ?? "";
let onUnauthorized: () => void = () => {};

function setToken(value: string) {
  token = value;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

// Service-account login used to silently re-bridge a stale CSO token (e.g. after
// the CSO backend restarts and its in-memory session is gone). A failed re-auth
// surfaces a LOCAL data error — it must NOT log the user out of the whole
// dashboard (a CSO 401 ≠ SSO session expired).
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
    if (!retried && (await reauth())) {
      return request<T>(method, path, body, true);
    }
    setToken("");
    onUnauthorized();
    throw new ApiError("Backend CSO tidak dapat diakses — coba muat ulang halaman.", 401);
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

  dashboard: () => request<Dashboard>("GET", "/dashboard"),
  tickets: () => request<Ticket[]>("GET", "/tickets"),
  createTicket: (t: Partial<Ticket>) => request<Ticket>("POST", "/tickets", t),
  alert: () => request<Alert>("GET", "/alerts"),

  realtimeURL: (): string | null => {
    if (!token) return null;
    const httpBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  },

  // Async spreadsheet import (Google Sheets by URL).
  importSyncPreview: (url?: string) => request<ImportPreview>("POST", "/import/sync/preview", { url: url ?? "" }),
  importSyncApprove: (url?: string) => request<ImportRecord>("POST", "/import/sync/approve", { url: url ?? "" }),
  importHistory: () => request<ImportRecord[]>("GET", "/import/history"),
  importRollback: (id: string) => request<ImportRecord>("POST", `/import/${encodeURIComponent(id)}/rollback`),
  importReset: () => request<ImportRecord>("POST", "/import/reset"),

  autoStatus: () => request<AutoSyncStatus>("GET", "/import/auto"),
  autoSet: (enabled: boolean, intervalSec: number) =>
    request<AutoSyncStatus>("PUT", "/import/auto", { enabled, intervalSec }),
};
