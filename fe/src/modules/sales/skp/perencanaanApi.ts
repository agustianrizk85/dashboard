// Read-only cross-division access to Perencanaan's master data (projects +
// kavling/unit inventory) — used to prefill SKP / Master Booking so nothing
// has to be retyped and everything matches the real kavling master. Uses the
// any-division xdiv endpoints (a Sales-only account has no access to
// Perencanaan's own /api/projects or /api/units). Dev falls back to :8082
// (no proxy); prod uses /be/perencanaan.

const PERENCANAAN = ((import.meta.env.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082").replace(/\/$/, "") + "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("gp_dashboard_token") ?? "";
  return token ? { Authorization: "Bearer " + token } : {};
}

async function getItems<T>(path: string): Promise<T[]> {
  const r = await fetch(`${PERENCANAAN}${path}`, { headers: authHeaders() });
  if (!r.ok) return [];
  const j = (await r.json().catch(() => null)) as { items?: unknown[] } | null;
  return (j?.items ?? []) as T[];
}

export interface MasterProj {
  id: string;
  gp: string;
  name: string;
  lokasi: string;
}

export async function fetchMasterProjects(): Promise<MasterProj[]> {
  const arr = await getItems<{ id?: string; gp?: string; name?: string; lokasi?: string }>("/xdiv/projects");
  return arr
    .filter((p) => p.name)
    .map((p) => ({ id: String(p.id ?? p.name), gp: String(p.gp ?? ""), name: String(p.name), lokasi: String(p.lokasi ?? "") }));
}

export interface MasterUnit {
  id: string;
  projectName: string;
  blok: string;
  noKav: string;
  type: string;
  luasBangunan: number;
  /** Plot size (Perencanaan's "Lebar" field — it absorbed the old separate
   *  "Luas Kavling" number, so this can be a plain number ("49") or a legacy
   *  width code ("L4") for kavling imported before that merge). */
  lebar: string;
}

export async function fetchMasterUnits(): Promise<MasterUnit[]> {
  const arr = await getItems<{
    id?: string;
    projectName?: string;
    blok?: string;
    noKav?: string;
    type?: string;
    luasBangunan?: number;
    lebar?: string;
  }>("/xdiv/units");
  return arr
    .filter((u) => u.noKav)
    .map((u) => ({
      id: String(u.id ?? u.noKav),
      projectName: String(u.projectName ?? ""),
      blok: String(u.blok ?? ""),
      noKav: String(u.noKav),
      type: String(u.type ?? ""),
      luasBangunan: Number(u.luasBangunan ?? 0),
      lebar: String(u.lebar ?? ""),
    }));
}

/** One file attached to the "Siteplan marketing" deliverable in Perencanaan. */
export interface SiteplanFile {
  id: string;
  taskId: string;
  projectId: string;
  name: string;
  size: number;
  mime: string;
  /** Direct streamable URL (self-validated ?token=), same pattern as the
   *  Perencanaan board task-attachment viewer — works for <img>/<a> directly. */
  url: string;
}

/** Fetch the "Siteplan marketing" reference image(s) for one project, matched
 *  BY NAME (Sales has no other link to Perencanaan's project). Reads the
 *  cross-division deliverables routed to Marketing under the "Site Plan"
 *  category/group, then flattens their attachments. */
export async function fetchSiteplanMarketing(projectName: string): Promise<SiteplanFile[]> {
  const name = projectName.trim().toLowerCase();
  if (!name) return [];
  const items = await getItems<{
    projectId?: string;
    projectName?: string;
    taskId?: string;
    category?: string;
    group?: string;
    deliverable?: string;
    attachments?: { id?: string; name?: string; size?: number; mime?: string }[];
  }>("/xdiv/deliverables?division=marketing");

  const token = localStorage.getItem("gp_dashboard_token") ?? "";
  const out: SiteplanFile[] = [];
  for (const it of items) {
    if (String(it.projectName ?? "").trim().toLowerCase() !== name) continue;
    const tag = `${it.category ?? ""} ${it.group ?? ""} ${it.deliverable ?? ""}`.toLowerCase();
    if (!tag.includes("site plan") && !tag.includes("siteplan")) continue;
    for (const a of it.attachments ?? []) {
      if (!a.id) continue;
      out.push({
        id: a.id,
        taskId: String(it.taskId ?? ""),
        projectId: String(it.projectId ?? ""),
        name: String(a.name ?? "lampiran"),
        size: Number(a.size ?? 0),
        mime: String(a.mime ?? ""),
        url: `${PERENCANAAN}/board/task/${it.projectId}/${it.taskId}/attachments/${a.id}?token=${encodeURIComponent(token)}`,
      });
    }
  }
  return out;
}
