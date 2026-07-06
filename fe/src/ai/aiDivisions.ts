/**
 * Per-division data sources for the "✨ Generate AI" analysis button.
 *
 * Each division exposes a compact JSON snapshot of its dashboard, fetched with
 * the division's own bearer token (the same one the dashboard bridges per
 * logged-in person). Heavy row-level arrays are stripped so the snapshot stays
 * small enough to ground the AI. Mirrors the Orchestrator's fetchDivision, but
 * shared and extended to Teknik + Permit.
 */

export type DivKey = "sales" | "keuangan" | "perencanaan" | "teknik" | "marketing" | "permit";

export type AiDivision = {
  key: DivKey;
  label: string;
  token: string;
  fetchSnapshot: () => Promise<string | null>;
};

const env = import.meta.env;

// Row-level / high-cardinality arrays we never send to the model (kept the
// aggregates around them). Union of the heavy keys across all divisions.
const HEAVY = [
  "saleRows", "byProject", "akads", "leads", "rows", "monev",
  "constructionStages", "kurvaBaseline", "progressUnits", "units",
  "documents", "processSteps", "items",
];

function authHeaders(tokenKey: string): HeadersInit {
  const t = localStorage.getItem(tokenKey);
  return t ? { Authorization: "Bearer " + t } : {};
}

async function getJson(url: string, tokenKey: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: authHeaders(tokenKey) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Strip heavy arrays and cap the serialized snapshot length. */
function compact(obj: unknown, cap = 4000): string {
  if (obj && typeof obj === "object") HEAVY.forEach((k) => delete (obj as Record<string, unknown>)[k]);
  let s = JSON.stringify(obj);
  if (s.length > cap) s = s.slice(0, cap) + "…";
  return s;
}

/** Standard division: a single GET {base}/api/dashboard aggregate. */
function dashDiv(key: DivKey, label: string, base: string, token: string): AiDivision {
  return {
    key,
    label,
    token,
    fetchSnapshot: async () => {
      const j = await getJson(base.replace(/\/$/, "") + "/api/dashboard", token);
      return j ? compact(j) : null;
    },
  };
}

export const AI_DIVS: Record<DivKey, AiDivision> = {
  sales: dashDiv("sales", "Sales", (env.VITE_SALES_API as string) ?? "http://localhost:8085", "gp_sales_token"),
  keuangan: dashDiv("keuangan", "Keuangan", (env.VITE_KEUANGAN_API as string) ?? "http://localhost:8084", "gp_keuangan_token"),
  perencanaan: dashDiv("perencanaan", "Perencanaan", (env.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082", "gp_perencanaan_token"),
  teknik: dashDiv("teknik", "Teknik", (env.VITE_TEKNIK_API as string) ?? "http://localhost:8083", "gp_teknik_token"),
  marketing: dashDiv("marketing", "Marketing", (env.VITE_MARKETING_API as string) ?? "http://localhost:8086", "marketingflow_token"),
  // Permit has no single /api/dashboard aggregate — build the snapshot from its
  // projects list + early-warning summary (base already includes /api).
  permit: {
    key: "permit",
    label: "Permit / Legal",
    token: "legalpermit_token",
    fetchSnapshot: async () => {
      const base = ((env.VITE_API_BASE_URL as string) ?? "/api").replace(/\/$/, "");
      const [projects, warnings] = await Promise.all([
        getJson(base + "/projects", "legalpermit_token"),
        getJson(base + "/dashboard/warnings", "legalpermit_token"),
      ]);
      if (!projects && !warnings) return null;
      return compact({ projects, warnings });
    },
  },
};
