import type {
  ARData,
  ARSource,
  AutoSyncStatus,
  Dashboard,
  ImportRecord,
  ImportResult,
  LoginResponse,
  User,
} from "../types";

/** Finance backend base URL — override with VITE_KEUANGAN_API. */
const ORIGIN = import.meta.env.VITE_KEUANGAN_API ?? "http://localhost:8084";
const BASE = ORIGIN + "/api";
const TOKEN_KEY = "gp_keuangan_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

/** Thrown when the backend rejects the session (401). */
export class AuthError extends Error {}

function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

async function upload<T>(path: string, file: File): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(BASE + path, { method: "POST", headers, body: form });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    setToken(null);
    throw new AuthError("Sesi berakhir, silakan login kembali.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* no JSON body */
    }
    throw new Error(`HTTP ${res.status} ${detail}`.trim());
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  base: BASE,
  hasToken: () => !!token,

  async login(username: string, password: string): Promise<User> {
    const res = await req<LoginResponse>("POST", "/auth/login", { username, password });
    setToken(res.token);
    return res.user;
  },
  async logout(): Promise<void> {
    try {
      await req("POST", "/auth/logout");
    } finally {
      setToken(null);
    }
  },

  dashboard: () => req<Dashboard>("GET", "/dashboard"),
  ar: () => req<ARData>("GET", "/ar"),
  arSheets: () => req<{ sheets: ARSource[] }>("GET", "/ar/sheets"),
  arSetSheets: (sheets: { code: string; url: string }[]) =>
    req<{ sheets: ARSource[] }>("PUT", "/ar/sheets", { sheets }),
  arSyncPreview: () => req<ARData>("POST", "/ar/sync-preview"),
  arSyncApprove: () => req<ARData>("POST", "/ar/sync-approve"),
  version: () => req<{ rev: number }>("GET", "/version"),
  realtimeURL: () => {
    if (!token) return null;
    const httpBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  },

  // ingest / sync (admin)
  importPreview: (file: File) => upload<ImportResult>("/import/preview", file),
  importApprove: (file: File) => upload<ImportRecord>("/import/approve", file),
  syncPreview: () => req<ImportResult>("POST", "/import/sync-preview"),
  syncApprove: () => req<ImportRecord>("POST", "/import/sync-approve"),
  autoStatus: () => req<AutoSyncStatus>("GET", "/import/auto"),
  autoSet: (enabled: boolean, intervalSec: number) =>
    req<AutoSyncStatus>("PUT", "/import/auto", { enabled, intervalSec }),
  importHistory: () => req<ImportRecord[]>("GET", "/import/history"),
  importReset: () => req<ImportRecord>("POST", "/import/reset"),
  importRollback: (id: string) => req<ImportRecord>("POST", `/import/rollback/${encodeURIComponent(id)}`),
};
