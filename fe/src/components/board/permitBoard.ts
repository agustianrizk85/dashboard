// Cross-division bridge: pulls Legal Permit process steps (legalpermit :8081)
// and folds them into ONE read-only summary card per lahan for the shared Papan
// Tugas board. The board itself is served by perencanaan; this file talks to a
// DIFFERENT backend, so it keeps its own base URL + token and never throws — if
// permit is down or the SSO token is absent, it just yields an empty list and
// the board renders exactly as before.
import type { BoardTaskStatus } from "./types";

/** legalpermit base — override with VITE_LEGALPERMIT_API at build/dev time. */
const LP_RAW = import.meta.env.VITE_LEGALPERMIT_API ?? "http://localhost:8081";
const LP_BASE = LP_RAW + "/api";

/** Whether the configured permit API is actually reachable from this page. In
 *  production the app is served from a real host but VITE_LEGALPERMIT_API may be
 *  unset (falls back to localhost:8081) — fetching localhost from a real origin
 *  only yields noisy CORS/ERR_FAILED, so skip it entirely. Local dev (page on
 *  localhost) still hits the local permit backend; production only fetches once
 *  VITE_LEGALPERMIT_API is wired to a real path like /be/permit. */
function permitReachable(): boolean {
  if (typeof window === "undefined") return false;
  const baseLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(LP_RAW);
  const pageLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);
  return !baseLocal || pageLocal;
}

/** legalpermit only accepts the master-auth SSO token (or its own native permit
 *  JWT). The perencanaan module token is NOT valid there, so read the dashboard
 *  SSO token specifically. "" ⇒ no permit cards (graceful). */
function ssoToken(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}

/** True when the permit bridge should run: a dashboard SSO token exists AND the
 *  configured permit API is reachable from this page (not localhost-in-prod). */
export function permitBridgeAvailable(): boolean {
  return permitReachable() && ssoToken() !== "";
}

/** Raw card as served by GET /api/xdiv/board-steps (snake_case, mirrors the Go
 *  BoardStepCard). */
interface RawPermitStep {
  step_id: number;
  project_id: number;
  project_name: string;
  code: string;
  category: string;
  name: string;
  board_status: string; // "todo" | "progress" | "done"
  raw_status: string; // "pending" | "in_progress" | "done"
  due_date: string | null;
  confidential: boolean;
  notify_departments: boolean;
}

/** One Legal Permit step, normalized for the drill-down list. */
export interface PermitStep {
  stepId: number;
  code: string; // "A1"
  category: string; // "A"
  name: string;
  boardStatus: BoardTaskStatus; // permit has no "review" → todo|progress|done
  rawStatus: string; // pending | in_progress | done
  due: string; // RFC3339, "" = unset
  overdue: boolean;
  confidential: boolean;
  notify: boolean;
}

/** A step plus the lahan it belongs to (internal — used only for grouping). */
interface PermitStepWithLahan extends PermitStep {
  projectId: number;
  projectName: string;
}

/** Aggregate of every step for one lahan → a single board summary card. */
export interface PermitLahanSummary {
  projectId: number;
  projectName: string;
  total: number;
  done: number;
  progress: number; // in_progress count
  todo: number; // pending count
  overdue: number;
  column: BoardTaskStatus; // which board column the summary card sits in
  steps: PermitStep[]; // ordered A1..I5 for the drill-down
}

function boardStatusOf(raw: string): BoardTaskStatus {
  return raw === "progress" ? "progress" : raw === "done" ? "done" : "todo";
}

/** Fetch every permit step across every lahan. Never rejects: any failure
 *  (offline, 401, permit backend down, no token) resolves to []. */
async function fetchPermitSteps(): Promise<PermitStepWithLahan[]> {
  if (!permitReachable()) return []; // localhost-in-prod → skip (no CORS noise)
  const token = ssoToken();
  if (!token) return [];
  try {
    const res = await fetch(`${LP_BASE}/xdiv/board-steps`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { steps?: RawPermitStep[] };
    const now = Date.now();
    return (body.steps ?? []).map((s) => {
      const due = s.due_date ?? "";
      const overdue = s.raw_status !== "done" && !!due && new Date(due).getTime() < now;
      return {
        stepId: s.step_id,
        code: s.code,
        category: s.category,
        name: s.name,
        boardStatus: boardStatusOf(s.board_status),
        rawStatus: s.raw_status,
        due,
        overdue,
        confidential: s.confidential,
        notify: s.notify_departments,
        projectId: s.project_id,
        projectName: s.project_name,
      };
    });
  } catch {
    return [];
  }
}

/** Fold flat steps into one summary per lahan. A lahan's summary column is
 *  derived from aggregate progress: fully done → done; anything started (some
 *  in_progress OR some done) → progress; nothing started → todo. */
function summarize(steps: PermitStepWithLahan[]): PermitLahanSummary[] {
  const byId = new Map<number, PermitLahanSummary>();
  for (const s of steps) {
    let sum = byId.get(s.projectId);
    if (!sum) {
      sum = {
        projectId: s.projectId,
        projectName: s.projectName || `Lahan #${s.projectId}`,
        total: 0,
        done: 0,
        progress: 0,
        todo: 0,
        overdue: 0,
        column: "todo",
        steps: [],
      };
      byId.set(s.projectId, sum);
    }
    sum.total += 1;
    if (s.rawStatus === "done") sum.done += 1;
    else if (s.rawStatus === "in_progress") sum.progress += 1;
    else sum.todo += 1;
    if (s.overdue) sum.overdue += 1;
    // Strip the lahan fields from the per-step payload kept for the drill-down.
    const { projectId: _p, projectName: _n, ...step } = s;
    void _p;
    void _n;
    sum.steps.push(step);
  }
  const out = Array.from(byId.values());
  for (const sum of out) {
    sum.column =
      sum.total > 0 && sum.done === sum.total
        ? "done"
        : sum.done + sum.progress > 0
          ? "progress"
          : "todo";
  }
  // Stable, human order: most-active (overdue, then in-progress) first.
  out.sort(
    (a, b) => b.overdue - a.overdue || b.progress - a.progress || a.projectName.localeCompare(b.projectName),
  );
  return out;
}

/** Single entry point for BoardView: load + aggregate in one call. Resolves to
 *  [] on any failure so the board is never blocked by the permit backend. */
export async function loadPermitSummaries(): Promise<PermitLahanSummary[]> {
  return summarize(await fetchPermitSteps());
}

/** Deep link into the Legal Permit module for a lahan (opened from the modal). */
export function permitLahanHref(projectId: number): string {
  return `/permit/projects/${projectId}`;
}
