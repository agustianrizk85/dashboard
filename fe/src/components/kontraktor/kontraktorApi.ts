/* Master Kontraktor — client for the central contractor list served by auth
 * (/api/kontraktor). Shared across divisions. Same auth base + SSO token
 * convention as Master Klausul (VITE_AUTH_API, gp_dashboard_token). */

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");

function token(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}

export interface Kontraktor {
  id: string;
  nama: string;
  jabatan: string;
  alamat: string;
  telp: string;
  email: string;
  npwp: string;
  bank: string;
  noRek: string;
  atasNama: string;
  catatan: string;
  aktif: boolean;
}

export async function listKontraktor(q?: string): Promise<Kontraktor[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const r = await fetch(`${AUTH}/kontraktor${qs}`, {
    headers: { Authorization: "Bearer " + token() },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Kontraktor[];
}

export async function saveKontraktor(k: Partial<Kontraktor>): Promise<Kontraktor> {
  const r = await fetch(`${AUTH}/kontraktor`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    body: JSON.stringify(k),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j as Kontraktor;
}

export async function deleteKontraktor(id: string): Promise<void> {
  const r = await fetch(`${AUTH}/kontraktor/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token() },
  });
  if (!r.ok && r.status !== 204) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${r.status}`);
  }
}
