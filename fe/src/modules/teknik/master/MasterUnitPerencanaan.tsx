import { useCallback, useEffect, useMemo, useState } from "react";
import "@/components/klausul/klausul.css";

/* Master Unit (relasi dari Perencanaan) — READ-ONLY. Unit/kavling dimiliki &
 * dikelola di modul Perencanaan; Teknik hanya membacanya lewat endpoint lintas-
 * divisi perencanaan-be GET /api/xdiv/units (SSO token). Sumber tunggal = Perencanaan. */

const PBASE = ((import.meta.env.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082") + "/api";
function token(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}

interface XUnit {
  id: string;
  projectId: string;
  projectName: string;
  gp: string;
  blok: string;
  noKav: string;
  type: string;
  luasBangunan: number;
  luasKavling: number;
  lebar: string;
}

export function MasterUnitPerencanaan() {
  const [rows, setRows] = useState<XUnit[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [proyekFilter, setProyekFilter] = useState("");
  const [page, setPage] = useState(0);

  const reload = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`${PBASE}/xdiv/units`, { headers: { Authorization: "Bearer " + token() } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const projects = useMemo(() => {
    const s = new Set<string>();
    (rows ?? []).forEach((u) => u.projectName && s.add(u.projectName));
    return [...s].sort();
  }, [rows]);

  const PAGE = 14;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (rows ?? []).filter((u) => {
      if (proyekFilter && u.projectName !== proyekFilter) return false;
      if (!n) return true;
      return `${u.projectName} ${u.gp} ${u.blok} ${u.noKav} ${u.type} ${u.lebar}`.toLowerCase().includes(n);
    });
  }, [rows, q, proyekFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="klx">
      <div className="klx-head">
        <div>
          <h2>🏠 Master Unit</h2>
          <p className="klx-sub">
            Daftar unit/kavling — <b>bersumber dari Perencanaan</b> (read-only). Perencanaan pemilik &amp;
            pengelola master ini; Teknik membacanya lintas-divisi. Untuk ubah data, lakukan di modul
            Perencanaan.
          </p>
        </div>
      </div>

      {err && <div className="klx-alert err">⚠ {err} — pastikan backend Perencanaan aktif.</div>}

      <div className="klx-card">
        <div className="klx-card-h wrap">
          <h3>
            Unit ({rows?.length ?? 0}){" "}
            <span className="klx-badge" style={{ background: "#eef2ff", color: "#3730a3" }}>sumber: Perencanaan</span>
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="klx-btn ghost sm" onClick={() => void reload()} disabled={busy}>
              {busy ? "Memuat…" : "↻ Muat ulang"}
            </button>
            <select
              className="klx-search"
              value={proyekFilter}
              onChange={(e) => {
                setProyekFilter(e.target.value);
                setPage(0);
              }}
              style={{ maxWidth: 220 }}
            >
              <option value="">Semua proyek</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              className="klx-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="🔎 Cari blok / tipe / kavling…"
            />
          </div>
        </div>

        <div className="klx-tablewrap">
          <table className="klx-table">
            <thead>
              <tr>
                <th>Proyek</th>
                <th className="klx-c-code">GP</th>
                <th className="klx-c-code">Blok</th>
                <th className="klx-c-code">No. Kav</th>
                <th>Tipe</th>
                <th className="klx-c-ord" style={{ textAlign: "right" }}>LB</th>
                <th className="klx-c-ord" style={{ textAlign: "right" }}>LK</th>
                <th className="klx-c-code">Lebar</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td colSpan={8} className="klx-empty">Memuat dari Perencanaan…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="klx-empty">Belum ada unit di Perencanaan (atau backend belum aktif).</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="klx-empty">Tidak ada yang cocok.</td>
                </tr>
              ) : (
                slice.map((u) => (
                  <tr key={u.id}>
                    <td className="klx-title">{u.projectName || "—"}</td>
                    <td className="klx-code">{u.gp || "—"}</td>
                    <td className="klx-code">{u.blok || "—"}</td>
                    <td className="klx-code">{u.noKav || "—"}</td>
                    <td>{u.type || "—"}</td>
                    <td className="klx-ord" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{u.luasBangunan || "—"}</td>
                    <td className="klx-ord" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{u.luasKavling || "—"}</td>
                    <td className="klx-code">{u.lebar || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="klx-pager">
            <button disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹ Sebelumnya</button>
            <span>Hal {cur + 1} / {pages}</span>
            <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Berikutnya ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
