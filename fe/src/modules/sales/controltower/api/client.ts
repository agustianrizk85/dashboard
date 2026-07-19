import type { Alert, AutoSyncStatus, Dashboard, ImportRecord, ImportResult, LoginResponse, User } from "../types";
import type { AssessRequest, ScreeningQuestion, ScreeningSubmission } from "../../staff/types";

/** AI Alert & Action Plan response (OpenRouter, with rule-based fallback). */
export interface AiAlerts {
  alerts: Alert[];
  source: "ai" | "rules";
  cached?: boolean;
  error?: string;
}

/** Sales (Control Tower) backend base URL — override with VITE_SALES_API. */
const BASE = (import.meta.env.VITE_SALES_API ?? "http://localhost:8085") + "/api";
const TOKEN_KEY = "gp_sales_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

/** Thrown when the backend rejects the session (401) — App falls back to login. */
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
  // 204 / empty body guard
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  base: BASE,
  hasToken: () => !!token,

  // ---- auth ----
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
  me: () => req<User>("GET", "/auth/me"),

  // ---- reads ----
  dashboard: () => req<Dashboard>("GET", "/dashboard"),
  /** AI-generated alerts (OpenRouter); falls back to rule-based server-side. */
  aiAlerts: () => req<AiAlerts>("GET", "/ai/alerts"),
  version: () => req<{ rev: number }>("GET", "/version"),
  /** WebSocket URL for realtime push (null when not authenticated). Builds an
   *  absolute ws/wss URL even when BASE is relative ("/api" in production). */
  realtimeURL: () => {
    if (!token) return null;
    const httpBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  },

  // ---- collection writes ----
  saveEntity: <T>(collection: string, item: T) => req<T>("POST", "/" + collection, item),
  deleteEntity: (collection: string, id: string) =>
    req<{ status: string }>("DELETE", `/${collection}/${encodeURIComponent(id)}`),

  // ---- singleton writes (PUT) ----
  putSingleton: <T>(path: string, body: T) => req<T>("PUT", "/" + path, body),

  // ---- konsumen screening (staff tools) ----
  screeningQuestions: () => req<ScreeningQuestion[]>("GET", "/screening/questions"),
  /** Replace the whole questionnaire (Kadep/admin only — backend enforces). */
  setScreeningQuestions: (qs: ScreeningQuestion[]) =>
    req<ScreeningQuestion[]>("PUT", "/screening/questions", qs),
  /** Staff sees only their own; the Kadep sees every submission. */
  screeningSubmissions: () => req<ScreeningSubmission[]>("GET", "/screening/submissions"),
  /** Run an eligibility assessment (AI, rule-based fallback) and persist it. */
  assessScreening: (body: AssessRequest) => req<ScreeningSubmission>("POST", "/screening/assess", body),
  deleteScreening: (id: string) =>
    req<{ status: string }>("DELETE", `/screening/submissions/${encodeURIComponent(id)}`),

  // ---- import / upload pipeline ----
  importPreview: (file: File) => upload<ImportResult>("/import/preview", file),
  importApprove: (file: File) => upload<ImportRecord>("/import/approve", file),
  importHistory: () => req<ImportRecord[]>("GET", "/import/history"),
  importRollback: (id: string) =>
    req<ImportRecord>("POST", `/import/rollback/${encodeURIComponent(id)}`),
  importReset: () => req<ImportRecord>("POST", "/import/reset"),

  // ---- Google Sheets sync ----
  syncPreview: () => req<ImportResult>("POST", "/import/sync-preview"),
  syncApprove: () => req<ImportRecord>("POST", "/import/sync-approve"),
  autoStatus: () => req<AutoSyncStatus>("GET", "/import/auto"),
  autoSet: (enabled: boolean, intervalSec: number) =>
    req<AutoSyncStatus>("PUT", "/import/auto", { enabled, intervalSec }),
};

/** upload posts a single file as multipart/form-data under field "file". */
async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(BASE + path, { method: "POST", headers, body: form });
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
