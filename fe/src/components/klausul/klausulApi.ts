/* Master Klausul — client for the central clause library served by auth
 * (/api/klausul). Shared by every division module. Same auth base + SSO token
 * convention as the AI model picker (VITE_AUTH_API, gp_dashboard_token). */

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");

function token(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}

export interface Klausul {
  id: string;
  division: string;
  docType: string;
  code: string;
  title: string;
  body: string;
  order: number;
}

export async function listKlausul(division: string, docType?: string): Promise<Klausul[]> {
  const qs = new URLSearchParams({ division });
  if (docType) qs.set("docType", docType);
  const r = await fetch(`${AUTH}/klausul?${qs.toString()}`, {
    headers: { Authorization: "Bearer " + token() },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Klausul[];
}

export async function saveKlausul(k: Partial<Klausul>): Promise<Klausul> {
  const r = await fetch(`${AUTH}/klausul`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    body: JSON.stringify(k),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j as Klausul;
}

export async function deleteKlausul(id: string): Promise<void> {
  const r = await fetch(`${AUTH}/klausul/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token() },
  });
  if (!r.ok && r.status !== 204) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${r.status}`);
  }
}

/** Unique {placeholder} tokens across the given clause bodies, first-seen order. */
export function extractPlaceholders(bodies: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{([^{}]+)\}/g;
  for (const b of bodies) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(b)) !== null) {
      const key = m[1].trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

/** Replace {placeholder} with a value; unfilled tokens stay verbatim as {key}. */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{([^{}]+)\}/g, (whole, key: string) => {
    const v = values[key.trim()];
    return v != null && v !== "" ? v : whole;
  });
}
