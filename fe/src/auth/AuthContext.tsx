import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * The two departments ("divisi") the unified dashboard serves. The logged-in
 * user's division decides which module is rendered after login.
 */
export type Division = "perencanaan" | "permit" | "marketing" | "sales" | "keuangan" | "teknik";

/** A unified session identity, independent of which backend authenticated it. */
export interface SessionUser {
  /** Login identifier — a username (perencanaan) or e-mail (permit/marketing). */
  username: string;
  name: string;
  /** Department-specific role, e.g. "ceo" | "kadep" | "drafter" | "dirops" | "legal_permit" | "staff" | "viewer". */
  role: string;
  division: Division;
  email?: string;
  /** Job position — used by the Marketing module (e.g. "Talent", "Copywriter"). */
  position?: string;
  /** When true (CEO / Dirops) the user may open every division's dashboard. */
  allAccess?: boolean;
  /** All-access users only: true = may approve/edit data (Dirops); false = overview-only (CEO). */
  canApprove?: boolean;
}

type AuthStatus = "checking" | "in" | "out";

interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "gp_dashboard_session";
const TOKEN_KEY = "gp_dashboard_token";

/* ─────────────────────────────────────────────────────────────────────────
 * MOCK AUTH — replace with the unified backend when it lands.
 *
 * The contract the real API must satisfy:
 *   POST {VITE_AUTH_API}/auth/login  { username, password }
 *     → 200 { token: string, user: { username, name, role, division, email? } }
 *
 * To switch over, set USE_REAL_AUTH = true and the `authenticate()` below will
 * call the real endpoint instead of the demo table. Everything else (session
 * persistence, the division-aware routing in App.tsx) stays the same.
 * ──────────────────────────────────────────────────────────────────────── */
const USE_REAL_AUTH = true;

interface MockAccount extends SessionUser {
  password: string;
}

const MOCK_ACCOUNTS: MockAccount[] = [
  // ── Direktur (akses SEMUA divisi) ──
  // CEO = overview saja; Dirops = sama persis, bedanya boleh approve/edit data.
  { username: "ceo@greenpark.id", password: "ceo123", name: "Direktur Utama", role: "ceo", division: "perencanaan", email: "ceo@greenpark.id", allAccess: true, canApprove: false },
  { username: "dirops@greenpark.id", password: "dirops123", name: "Direktur Operasional", role: "dirops", division: "permit", email: "dirops@greenpark.id", allAccess: true, canApprove: true },
  // ── Departemen Perencanaan ──
  { username: "kadep", password: "kadep123", name: "Kepala Dept. Perencanaan", role: "kadep", division: "perencanaan" },
  { username: "randi", password: "randi123", name: "Randi", role: "drafter", division: "perencanaan" },
  { username: "ananto", password: "ananto123", name: "Ananto", role: "drafter", division: "perencanaan" },
  { username: "agus", password: "agus123", name: "Agus", role: "drafter", division: "perencanaan" },
  // ── Departemen Legal & Perizinan (Permit) ──
  { username: "kadep@greenpark.id", password: "kadep123", name: "Kepala Dept. Legal", role: "kadep", division: "permit", email: "kadep@greenpark.id" },
  { username: "legal@greenpark.id", password: "legal123", name: "Staf Legal Permit", role: "legal_permit", division: "permit", email: "legal@greenpark.id" },
  // ── Departemen Marketing ── (role kadep/staff/viewer + job `position`)
  // Tim internal = akun per orang; satu posisi utama per akun. Kredensial harus
  // sinkron dengan seed marketing backend agar token bridge berhasil.
  { username: "marketing@greenpark.id", password: "kadep123", name: "Kepala Dept. Marketing", role: "kadep", division: "marketing", email: "marketing@greenpark.id", position: "Kepala Departemen Marketing" },
  { username: "ichsan@greenpark.id", password: "yqfZ2hWtMQ", name: "Ichsan", role: "staff", division: "marketing", email: "ichsan@greenpark.id", position: "Copywriter" },
  { username: "sohee@greenpark.id", password: "ByxZQnQ7Rc", name: "Sohee", role: "staff", division: "marketing", email: "sohee@greenpark.id", position: "Social Media Specialist" },
  { username: "mila@greenpark.id", password: "QpkdKGfZcf", name: "Mila", role: "staff", division: "marketing", email: "mila@greenpark.id", position: "Social Media Specialist" },
  { username: "hilman@greenpark.id", password: "PPWrxk7stW", name: "Hilman", role: "staff", division: "marketing", email: "hilman@greenpark.id", position: "Design Grafis" },
  { username: "hakim@greenpark.id", password: "MazUSccPKC", name: "Hakim", role: "staff", division: "marketing", email: "hakim@greenpark.id", position: "Videografer" },
  { username: "hanif@greenpark.id", password: "vrnzxpPsMg", name: "Hanif", role: "staff", division: "marketing", email: "hanif@greenpark.id", position: "Video Editor" },
  { username: "ivan@greenpark.id", password: "AVqhqec2ca", name: "Ivan", role: "staff", division: "marketing", email: "ivan@greenpark.id", position: "Video Editor" },
  { username: "fatimah@greenpark.id", password: "agHYVXCArP", name: "Fatimah", role: "staff", division: "marketing", email: "fatimah@greenpark.id", position: "Digital Marketing" },
  { username: "rahadian@greenpark.id", password: "38fpPu2GtU", name: "Rahadian", role: "staff", division: "marketing", email: "rahadian@greenpark.id", position: "Digital Marketing" },
  // ── Departemen Sales ── (Control Tower war-room; reads the sales backend :8085)
  { username: "sales@greenpark.id", password: "sales123", name: "Kepala Dept. Sales", role: "kadep", division: "sales", email: "sales@greenpark.id" },
  { username: "viewer@greenpark.id", password: "viewer123", name: "Sales Viewer", role: "viewer", division: "sales", email: "viewer@greenpark.id" },
  // ── Departemen Keuangan ── (Akad/KPR control tower; reads the finance backend :8084)
  { username: "keuangan@greenpark.id", password: "keuangan123", name: "Kepala Dept. Keuangan", role: "kadep", division: "keuangan", email: "keuangan@greenpark.id" },
  // ── Departemen Teknik ── (kendali progres pembangunan; reads the teknik backend :8083)
  { username: "teknik@greenpark.id", password: "teknik123", name: "Kepala Dept. Teknik", role: "kadep", division: "teknik", email: "teknik@greenpark.id" },
];

function stripPassword({ password: _pw, ...user }: MockAccount): SessionUser {
  return user;
}

/* ─────────────────────────────────────────────────────────────────────────
 * MODULE-BACKEND TOKEN BRIDGE
 *
 * The dashboard's own auth is mocked, but each module (Perencanaan, Permit,
 * Marketing) talks to a SEPARATE Go backend that requires a real bearer token
 * on every request. So at login we additionally authenticate against the
 * logged-in division's backend and stash its native token under the key that
 * module's API client reads. Without this every module call 401s — Marketing &
 * Permit would even redirect-loop to /login.
 *
 * The demo accounts above match each backend's seeded users, so the same
 * credentials work. `apiId` overrides the identifier sent to the backend when
 * the dashboard username differs from the backend's (Marketing's Kadep).
 * ──────────────────────────────────────────────────────────────────────── */
interface ModuleBackend {
  /** Base URL including `/api`. */
  base: string;
  /** localStorage key the module's API client reads its token from. */
  tokenKey: string;
  /** Login body field name for the identifier. */
  idField: "username" | "email";
}

const env = import.meta.env;
const MODULE_BACKENDS: Record<Division, ModuleBackend> = {
  perencanaan: {
    base: ((env.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082").replace(/\/$/, "") + "/api",
    tokenKey: "gp_perencanaan_token",
    idField: "username",
  },
  marketing: {
    base: ((env.VITE_MARKETING_API as string) ?? "http://localhost:8086").replace(/\/$/, "") + "/api",
    tokenKey: "marketingflow_token",
    idField: "email",
  },
  // Permit's client uses the Vite `/api` dev-proxy (-> :8080).
  permit: {
    base: ((env.VITE_API_BASE_URL as string) ?? "/api").replace(/\/$/, ""),
    tokenKey: "legalpermit_token",
    idField: "email",
  },
  // Sales Control Tower backend (:8085). The token key matches the one the
  // Control Tower's own client reads, so a bridged login (e.g. the CEO's viewer
  // account) is reused directly; otherwise the war-room self-authenticates.
  sales: {
    base: ((env.VITE_SALES_API as string) ?? "http://localhost:8085").replace(/\/$/, "") + "/api",
    tokenKey: "gp_sales_token",
    idField: "username",
  },
  // Finance (Keuangan) backend (:8084). Token key matches the keuangan module's
  // own client; the dashboard self-authenticates there too if not bridged.
  keuangan: {
    base: ((env.VITE_KEUANGAN_API as string) ?? "http://localhost:8084").replace(/\/$/, "") + "/api",
    tokenKey: "gp_keuangan_token",
    idField: "username",
  },
  // Teknik (engineering) control dashboard backend (:8083). Token key matches
  // the teknik module's own client; the dashboard self-authenticates there too.
  teknik: {
    base: ((env.VITE_TEKNIK_API as string) ?? "http://localhost:8083").replace(/\/$/, "") + "/api",
    tokenKey: "gp_teknik_token",
    idField: "username",
  },
};

const ALL_MODULE_TOKEN_KEYS = Object.values(MODULE_BACKENDS).map((m) => m.tokenKey);

/** Dashboard usernames whose module backend expects a different identifier. */
const API_ID_OVERRIDE: Record<string, string> = {
  // Marketing's Kadep is `marketing@greenpark.id` here (to avoid colliding with
  // Permit's Kadep) but seeded as `kadep@greenpark.id` in the Marketing backend.
  "marketing@greenpark.id": "kadep@greenpark.id",
};

/**
 * Best-effort: obtain the module backend's bearer token and store it where the
 * module's API client looks. Never throws — if the backend is down the module
 * surfaces its own error rather than blocking the (mock) dashboard login.
 */
async function bridgeModuleToken(division: Division, identifier: string, password: string): Promise<boolean> {
  const cfg = MODULE_BACKENDS[division];
  const id = API_ID_OVERRIDE[identifier.toLowerCase()] ?? identifier;
  const body = cfg.idField === "username" ? { username: id, password } : { email: id, password };
  try {
    const res = await fetch(`${cfg.base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token?: string };
    if (data.token) {
      localStorage.setItem(cfg.tokenKey, data.token);
      return true;
    }
    return false;
  } catch {
    /* backend unreachable — leave the module to report it */
    return false;
  }
}

function clearModuleTokens(): void {
  ALL_MODULE_TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
}

/**
 * Backend credentials for the all-access accounts (CEO / Dirops). They do NOT
 * need dedicated ceo/dirops backend accounts — they simply borrow existing
 * module accounts: `kadep` everywhere for read (and approve in Perencanaan /
 * Marketing). The ONE exception is Permit, where SPK approval is restricted to
 * the Dirops role, so an approver bridges the real Permit `dirops` account.
 * (The Marketing Control Tower self-authenticates to the sales backend.)
 */
function allAccessCreds(approver: boolean): Record<Division, { id: string; pass: string }> {
  return {
    perencanaan: { id: "kadep", pass: "kadep123" },
    permit: approver
      ? { id: "dirops@greenpark.id", pass: "dirops123" }
      : { id: "kadep@greenpark.id", pass: "kadep123" },
    marketing: { id: "kadep@greenpark.id", pass: "kadep123" },
    // Sales module signs in as admin so the Master Data / sync tab works
    // (the war-room reads only; /sales is gated by the unified login).
    sales: { id: "admin", pass: "admin123" },
    // Finance module signs in as admin so the Sync / Import tab works.
    keuangan: { id: "admin", pass: "admin123" },
    // Teknik module signs in as admin so the Sync Spreadsheet / Master tabs work.
    teknik: { id: "admin", pass: "admin123" },
  };
}

/** Bridge tokens for every division so an all-access user can switch freely. */
async function bridgeAllDivisions(approver: boolean): Promise<void> {
  const creds = allAccessCreds(approver);
  await Promise.all(
    (Object.keys(creds) as Division[]).map((div) => bridgeModuleToken(div, creds[div].id, creds[div].pass)),
  );
}

/** Marketing per-person job positions (the auth user model carries no position;
 *  the Marketing module needs it, so we map it from the login identifier). */
const MARKETING_POSITIONS: Record<string, string> = {
  "marketing@greenpark.id": "Kepala Departemen Marketing",
  "ichsan@greenpark.id": "Copywriter",
  "sohee@greenpark.id": "Social Media Specialist",
  "mila@greenpark.id": "Social Media Specialist",
  "hilman@greenpark.id": "Design Grafis",
  "hakim@greenpark.id": "Videografer",
  "hanif@greenpark.id": "Video Editor",
  "ivan@greenpark.id": "Video Editor",
  "fatimah@greenpark.id": "Digital Marketing",
  "rahadian@greenpark.id": "Digital Marketing",
};

async function authenticate(identifier: string, password: string): Promise<{ token: string; user: SessionUser }> {
  if (USE_REAL_AUTH) {
    const base = (import.meta.env.VITE_AUTH_API as string) ?? "/api";
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identifier, password }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { error?: string }).error ?? "";
      } catch {
        /* ignore */
      }
      throw new Error(detail || "Login gagal — periksa kredensial Anda.");
    }
    const data = (await res.json()) as {
      accessToken: string;
      user: { username: string; name?: string; email?: string; super?: boolean; roles?: Record<string, string> };
    };
    const au = data.user;
    const roles = au.roles ?? {};
    const deptCodes = Object.keys(roles);
    // super, OR roles across many depts (a director), ⇒ all-access overview.
    const all = !!au.super || deptCodes.length >= 3;
    // Map an auth department code → the dashboard's Division.
    const DEPT2DIV: Record<string, Division> = {
      finance: "keuangan",
      legalpermit: "permit",
      marketing: "marketing",
      sales: "sales",
      perencanaan: "perencanaan",
      teknik: "teknik",
    };
    const ownDept = deptCodes.find((d) => DEPT2DIV[d]);
    const division: Division = (ownDept && DEPT2DIV[ownDept]) || "keuangan";
    const user: SessionUser = {
      username: au.username,
      name: au.name || au.username,
      email: au.email,
      role: au.super ? "ceo" : ownDept ? roles[ownDept] : "viewer",
      division,
      allAccess: all,
      canApprove: !!au.super,
    };
    if (division === "marketing") {
      user.position = MARKETING_POSITIONS[au.username.toLowerCase()] ?? (user.role === "kadep" ? "Kepala Departemen Marketing" : "Tim Marketing");
    }
    return { token: data.accessToken, user };
  }

  // Mock path — match against the demo account table (case-insensitive id).
  const id = identifier.trim().toLowerCase();
  const account = MOCK_ACCOUNTS.find((a) => a.username.toLowerCase() === id);
  if (!account || account.password !== password) {
    throw new Error("Username atau password salah.");
  }
  // Simulate a tiny network round-trip so the UI shows its busy state.
  await new Promise((r) => setTimeout(r, 250));
  return { token: `mock.${account.username}.${account.division}`, user: stripPassword(account) };
}

/** Decode a JWT access token's `exp` (epoch seconds). Returns null for the mock
 *  token (non-JWT) or anything unparseable. */
function tokenExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Any API client can fire this when a call returns 401, so the session ends
 *  immediately (handles a token revoked/invalidated before its natural expiry,
 *  e.g. after an auth-service restart). */
export const AUTH_EXPIRED_EVENT = "gp-auth-expired";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");

  // Restore a persisted session on first load.
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) {
      setStatus("out");
      return;
    }
    try {
      setUser(JSON.parse(raw) as SessionUser);
      setStatus("in");
    } catch {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      setStatus("out");
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const { token, user: u } = await authenticate(identifier, password);
    // The auth service (SSO) is the identity source, but each department backend
    // still verifies its OWN token — so obtain a native data token per backend
    // BEFORE the module mounts (otherwise the first calls 401 → redirect loop).
    // Auth passwords are seeded to match the backends, so the typed credentials
    // bridge the user's own division AS THAT SAME PERSON (preserving "tugas saya"
    // etc.); all-access users additionally borrow service accounts for the rest.
    const bridged = await bridgeModuleToken(u.division, identifier, password);
    if (!bridged) {
      // Per-person bridge failed — typically the backend rotated that user's
      // password away from the auth seed (e.g. Marketing team), or the backend
      // has no matching account (Sales/Keuangan self-serve). Fall back to the
      // division's service account so the dashboard still loads its data.
      const svc = allAccessCreds(!!u.canApprove)[u.division];
      await bridgeModuleToken(u.division, svc.id, svc.pass);
    }
    if (u.allAccess) await bridgeAllDivisions(!!u.canApprove);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    setUser(u);
    setStatus("in");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    clearModuleTokens();
    setUser(null);
    setStatus("out");
  }, []);

  // Auto-logout on session expiry: schedule a logout exactly when the access
  // token's `exp` passes (immediately if already expired on load), and also log
  // out the moment any API call reports 401 (AUTH_EXPIRED_EVENT). Without this
  // an expired token just makes every call 401 silently.
  useEffect(() => {
    if (status !== "in") return;
    const onExpired = () => logout();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const token = localStorage.getItem(TOKEN_KEY);
    const exp = token ? tokenExp(token) : null;
    if (exp !== null) {
      const ms = exp * 1000 - Date.now();
      if (ms <= 0) {
        logout();
      } else {
        timer = setTimeout(logout, ms + 500); // small buffer past expiry
      }
    }
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      if (timer) clearTimeout(timer);
    };
  }, [status, logout]);

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
