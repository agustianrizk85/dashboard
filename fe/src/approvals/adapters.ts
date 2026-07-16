/* ════════════════════════════════════════════════════════════════════════
 * Cross-division approval inbox — data layer.
 *
 * The unified dashboard's three divisions each run a SEPARATE Go backend with
 * its own approval flow and its own bearer token (stashed at login by the
 * AuthContext "token bridge"). This module reads each division's pending
 * approvals, normalises them into a single `ApprovalItem` shape, and exposes
 * approve / reject actions bound to the right backend.
 *
 * Per-division config below MUST stay in sync with each module's API client:
 *   perencanaan → modules/perencanaan/api/client.ts   (token gp_perencanaan_token)
 *   permit      → modules/permit/services/api.ts       (token legalpermit_token)
 *   marketing   → modules/marketing/services/api.ts    (token marketingflow_token)
 * ════════════════════════════════════════════════════════════════════════ */
import type { Division } from "@/auth/AuthContext";

/** The divisions that have an approval flow today. (Sales has none yet.) */
type ApprovalDivision = "perencanaan" | "permit" | "marketing";

const ENV = import.meta.env;

interface DivCfg {
  /** Base URL including `/api`. */
  base: string;
  /** localStorage key the division's own API client reads its token from. */
  tokenKey: string;
}

const CFG: Record<ApprovalDivision, DivCfg> = {
  perencanaan: {
    base: ((ENV.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082") + "/api",
    tokenKey: "gp_perencanaan_token",
  },
  permit: {
    base: ((ENV.VITE_API_BASE_URL as string) ?? "/api").replace(/\/$/, ""),
    tokenKey: "legalpermit_token",
  },
  marketing: {
    base: ((ENV.VITE_MARKETING_API as string) ?? "http://localhost:8086") + "/api",
    tokenKey: "marketingflow_token",
  },
};

/** Realtime WebSocket URLs per division (null when that division's token is
 *  absent). The approval inbox opens one socket per division and refreshes the
 *  whole inbox on any push, so a director's queue stays live across backends. */
export function realtimeURLs(): Record<ApprovalDivision, string | null> {
  const urlFor = (div: ApprovalDivision): string | null => {
    const { base, tokenKey } = CFG[div];
    const token = localStorage.getItem(tokenKey) ?? "";
    if (!token) return null;
    const httpBase = base.startsWith("http") ? base : window.location.origin + base;
    return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
  };
  return { perencanaan: urlFor("perencanaan"), permit: urlFor("permit"), marketing: urlFor("marketing") };
}

type Method = "GET" | "POST" | "PUT" | "PATCH";

/** Authenticated fetch against a given division's backend. Throws on non-2xx. */
async function req<T>(div: ApprovalDivision, method: Method, path: string, body?: unknown): Promise<T> {
  const { base, tokenKey } = CFG[div];
  const token = localStorage.getItem(tokenKey) ?? "";
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetch a binary document from a division backend (with auth) and return an
 *  object URL for inline preview. The caller revokes it when done. */
async function reqBlob(div: ApprovalDivision, path: string): Promise<string> {
  const { base, tokenKey } = CFG[div];
  const token = localStorage.getItem(tokenKey) ?? "";
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(base + path, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

/* ── Normalised shape every division maps onto ─────────────────────────── */

export interface ApprovalItem {
  /** Unique across all divisions. */
  uid: string;
  division: Division;
  /** Short kind label, e.g. "SPK" / "Gambar Kerja" / "Konten". */
  badge: string;
  title: string;
  subtitle: string;
  /** Right-aligned highlight (amount, code, PIC…). */
  meta?: string;
  /** Extra key/value rows shown when the card is expanded. */
  detail: { label: string; value: string }[];
  /** Whether this division's approve/reject takes an optional note. */
  acceptsNote: boolean;
  approve: (note: string) => Promise<void>;
  reject: (note: string) => Promise<void>;
  /** Optional third decision: send the item back to the submitter for revision
   *  WITH a required instruction note (distinct from a plain reject). Only set
   *  for divisions whose flow supports it (perencanaan gambar kerja today). */
  revise?: (instruction: string) => Promise<void>;
  /** Optional attached document (e.g. perencanaan "gambar kerja"). `open()`
   *  fetches it WITH auth and returns an object URL for inline preview (the
   *  caller revokes it). `ext` is the lowercased file extension (pdf / dwg / …)
   *  used to decide whether the browser can render it inline. */
  doc?: { name: string; ext: string; open: () => Promise<string> };
}

export interface DivisionLoad {
  division: Division;
  label: string;
  items: ApprovalItem[];
  /** Set when this division's backend could not be reached / errored. */
  error?: string;
  /** True when the failure means the module simply isn't deployed yet (404 /
   *  backend down), so the UI shows a calm "belum aktif" note instead of a red
   *  error. Real errors (401/403/500) keep `inactive` false. */
  inactive?: boolean;
}

/* ── Division adapters ─────────────────────────────────────────────────── */

const DIV_LABEL: Record<ApprovalDivision, string> = {
  perencanaan: "Perencanaan",
  permit: "Legal & Perizinan",
  marketing: "Marketing",
};

// --- Legal & Perizinan: SPK awaiting approval (status "draft") -----------
interface SPK {
  id: number;
  number: string;
  type_name: string;
  total: number;
  scope_note: string;
  completion_time: string;
  payment_terms: string;
  vendor?: { name?: string } | null;
  project?: { name?: string } | null;
}

async function loadPermit(): Promise<ApprovalItem[]> {
  const { items } = await req<{ items: SPK[] }>("permit", "GET", "/spk?status=draft");
  return (items ?? []).map((s) => ({
    uid: `permit:${s.id}`,
    division: "permit" as Division,
    badge: "SPK",
    title: `${s.number} · ${s.type_name}`,
    subtitle: s.vendor?.name ? `Vendor: ${s.vendor.name}` : s.project?.name ?? "—",
    meta: rupiah(s.total),
    detail: [
      { label: "Proyek", value: s.project?.name ?? "—" },
      { label: "Vendor", value: s.vendor?.name ?? "—" },
      { label: "Nilai", value: rupiah(s.total) },
      { label: "Waktu penyelesaian", value: s.completion_time || "—" },
      { label: "Termin", value: s.payment_terms || "—" },
      { label: "Lingkup", value: s.scope_note || "—" },
    ],
    acceptsNote: true,
    approve: (note: string) => req("permit", "POST", `/spk/${s.id}/approve`, { note }),
    reject: (note: string) => req("permit", "POST", `/spk/${s.id}/reject`, { note }),
  }));
}

// --- Marketing: work-item steps flagged is_approval, not yet done --------
interface WorkItemLite {
  id: number;
  title: string;
  alur: string;
  project: string;
  stage: string;
  steps?: WorkStepLite[];
}
interface WorkStepLite {
  id: number;
  code: string;
  name: string;
  phase: string;
  owner: string;
  status: string;
  is_approval: boolean;
  due_date: string | null;
  notes: string;
}

async function loadMarketing(): Promise<ApprovalItem[]> {
  const all = await req<WorkItemLite[]>("marketing", "GET", "/work-items");
  // Only items parked at the approval stage can hold a pending approval step,
  // so we fetch full steps for just those (avoids an N+1 over every item).
  const pendingItems = (all ?? []).filter((w) => w.stage === "approval");
  const details = await Promise.all(pendingItems.map((w) => req<WorkItemLite>("marketing", "GET", `/work-items/${w.id}`)));
  const out: ApprovalItem[] = [];
  for (const w of details) {
    for (const s of w.steps ?? []) {
      if (!s.is_approval || s.status === "done") continue;
      out.push({
        uid: `marketing:${s.id}`,
        division: "marketing" as Division,
        badge: `Konten ${w.alur}`,
        title: w.title,
        subtitle: s.name,
        meta: s.code,
        detail: [
          { label: "Proyek", value: w.project || "—" },
          { label: "Alur", value: w.alur },
          { label: "Step", value: `${s.code} · ${s.phase}` },
          { label: "Diajukan oleh", value: s.owner || "—" },
          { label: "Jatuh tempo", value: s.due_date ?? "—" },
          ...(s.notes ? [{ label: "Catatan", value: s.notes }] : []),
        ],
        acceptsNote: false,
        approve: () => req("marketing", "PUT", `/steps/${s.id}`, { status: "done" }),
        reject: () => req("marketing", "PUT", `/steps/${s.id}`, { status: "in_progress" }),
      });
    }
  }
  return out;
}

// --- Perencanaan: task documents in "review" awaiting head approval ------
interface PTaskDoc { name: string; uploadedBy: string }
interface PTask { id: string; name: string; pic: string; status: string; group: string; category: string; doc?: PTaskDoc }
interface PProjectRollup { id: string; name: string; gp: string }
interface PProjectDetail extends PProjectRollup { tasks: PTask[] }

async function loadPerencanaan(): Promise<ApprovalItem[]> {
  const projects = await req<PProjectRollup[]>("perencanaan", "GET", "/projects");
  const details = await Promise.all(
    (projects ?? []).map((p) => req<PProjectDetail>("perencanaan", "GET", `/projects/${p.id}`)),
  );
  const out: ApprovalItem[] = [];
  for (const d of details) {
    for (const t of d.tasks ?? []) {
      if (t.status !== "review") continue;
      const ext = (t.doc?.name.split(".").pop() ?? "").toLowerCase();
      out.push({
        uid: `perencanaan:${d.id}:${t.id}`,
        division: "perencanaan" as Division,
        badge: "Gambar Kerja",
        title: t.name,
        subtitle: `${d.gp} · ${d.name}`,
        meta: t.doc?.name ?? "tanpa dokumen",
        detail: [
          { label: "Proyek", value: `${d.gp} — ${d.name}` },
          { label: "Kategori", value: `${t.category} / ${t.group}` },
          { label: "PIC", value: t.pic || "—" },
          { label: "Dokumen", value: t.doc?.name ?? "—" },
        ],
        acceptsNote: false,
        approve: () => req("perencanaan", "POST", `/projects/${d.id}/tasks/${t.id}/approve`),
        reject: () => req("perencanaan", "POST", `/projects/${d.id}/tasks/${t.id}/reject`, { instruction: "" }),
        revise: (instruction: string) =>
          req("perencanaan", "POST", `/projects/${d.id}/tasks/${t.id}/reject`, { instruction }),
        doc: t.doc
          ? { name: t.doc.name, ext, open: () => reqBlob("perencanaan", `/projects/${d.id}/tasks/${t.id}/doc`) }
          : undefined,
      });
    }
  }
  return out;
}

const LOADERS: Record<ApprovalDivision, () => Promise<ApprovalItem[]>> = {
  perencanaan: loadPerencanaan,
  permit: loadPermit,
  marketing: loadMarketing,
};

/** Load every division's pending approvals. One division failing (e.g. its
 *  backend is down) never blocks the others — each gets its own error slot. */
export async function loadAllApprovals(): Promise<DivisionLoad[]> {
  const divs = Object.keys(LOADERS) as ApprovalDivision[];
  const settled = await Promise.allSettled(divs.map((d) => LOADERS[d]()));
  return divs.map((division, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") return { division, label: DIV_LABEL[division], items: r.value };
    const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
    // A 404 (endpoint not on the live backend) or a network failure means the
    // module just isn't deployed yet — surface it calmly, not as a red error.
    const inactive = /HTTP 404/.test(msg) || /failed to fetch/i.test(msg) || /networkerror/i.test(msg) || /load failed/i.test(msg);
    return { division, label: DIV_LABEL[division], items: [], error: msg, inactive };
  });
}
