// Self-contained fetch client for the Perencanaan cross-division (xdiv) API.
//
// Perencanaan is a SEPARATE backend (:8082). Its xdiv/board routes accept the
// unified dashboard SSO token from ANY division, so this client reads the
// DASHBOARD token (localStorage key `gp_dashboard_token`) — NOT the permit
// token (`legalpermit_token`), which the perencanaan backend rejects.
//
// Kept deliberately free of the permit axios instance so it can talk to the
// other backend with its own auth. When the dashboard token is missing (a
// standalone permit login), calls throw NoSsoTokenError and the UI degrades to
// a hint instead of crashing.

/** Backend base URL (incl. /api) — override with VITE_PERENCANAAN_API. */
const PERENCANAAN_BASE = (import.meta.env.VITE_PERENCANAAN_API ?? "http://localhost:8082") + "/api";

const DASHBOARD_TOKEN_KEY = "gp_dashboard_token";

/** Read fresh on every call so cross-module navigation / re-login is picked up
 *  immediately. */
function ssoToken(): string {
  return localStorage.getItem(DASHBOARD_TOKEN_KEY) || "";
}

/** Minimal perencanaan project entry for the linker dropdown. */
export interface XdivProject {
  id: string;
  gp: string;
  name: string;
}

/** One deliverable routed to Legal Permit (Output=legalpermit) for a project. */
export interface XdivDeliverable {
  projectId: string;
  projectName: string;
  gp: string;
  taskId: string;
  category: string;
  group: string;
  deliverable: string;
  pic: string;
  output: string;
  status: "todo" | "progress" | "review" | "done" | string;
  hasDoc: boolean;
  approvedBy: string;
  updatedAt: string;
}

/** Thrown when the dashboard SSO token is absent (standalone permit login). */
export class NoSsoTokenError extends Error {
  constructor() {
    super("Masuk lewat dashboard untuk menautkan & menarik data Perencanaan.");
    this.name = "NoSsoTokenError";
  }
}

async function xget<T>(path: string): Promise<T> {
  const token = ssoToken();
  if (!token) throw new NoSsoTokenError();
  const res = await fetch(PERENCANAAN_BASE + path, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* no JSON body */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const perencanaanService = {
  /** Whether the dashboard SSO token is present (else the UI shows a hint). */
  hasSsoToken: (): boolean => !!ssoToken(),

  /** List of perencanaan projects for the linker dropdown. */
  async projects(): Promise<XdivProject[]> {
    const data = await xget<{ items: XdivProject[] }>("/xdiv/projects");
    return data.items ?? [];
  },

  /** Deliverables routed to Legal Permit for a linked perencanaan project. */
  async deliverables(projectId: string): Promise<XdivDeliverable[]> {
    const data = await xget<{ items: XdivDeliverable[] }>(
      `/xdiv/deliverables?division=legalpermit&projectId=${encodeURIComponent(projectId)}`,
    );
    return data.items ?? [];
  },

  /** EVERY perencanaan deliverable routed to Legal Permit (all projects) — feeds
   *  the "Output Divisi" page (what Perencanaan's Papan Tugas sends to Permit). */
  async allDeliverables(): Promise<XdivDeliverable[]> {
    const data = await xget<{ items: XdivDeliverable[] }>("/xdiv/deliverables?division=legalpermit");
    return data.items ?? [];
  },

  /** Inline-PDF URL for a deliverable's document (reuses the board task-doc
   *  endpoint; token in the query string so it works in a new tab / iframe). */
  docUrl: (projectId: string, taskId: string): string =>
    `${PERENCANAAN_BASE}/board/task/${projectId}/${taskId}/doc?token=${encodeURIComponent(
      ssoToken(),
    )}`,
};
