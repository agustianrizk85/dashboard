import { useEffect, useState } from "react";

/* AI › Model — read-only katalog model AI (nama · kepintaran · kegunaan · score).
 * Dikelola terpusat di Panel Admin (superadmin); di sini hanya ditampilkan agar
 * tim Perencanaan tahu model apa saja yang tersedia & untuk apa. Data diambil
 * langsung dari auth (GET /ai/model-catalog) dengan token dashboard SSO. */

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");

function ssoToken(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}

interface AIModel {
  name: string;
  intelligence: string;
  useCase: string;
  score: number;
}

function scoreColor(s: number): string {
  return s >= 80 ? "#15803d" : s >= 50 ? "#b45309" : "#64748b";
}

export function ModelView() {
  const [rows, setRows] = useState<AIModel[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = ssoToken();
    if (!t) {
      setErr("Masuk lewat dashboard untuk melihat katalog model.");
      setRows([]);
      return;
    }
    let alive = true;
    fetch(`${AUTH}/ai/model-catalog`, { headers: { Authorization: "Bearer " + t } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as AIModel[];
      })
      .then((j) => alive && setRows(Array.isArray(j) ? j : []))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="pr-panel">
      <div className="pr-panel-head">
        <h2>🧠 Model AI — Katalog</h2>
        <p className="muted">
          Model AI yang tersedia beserta kepintaran, kegunaan &amp; score. Read-only — dikelola di{" "}
          <b>Panel Admin › Model AI</b> (superadmin).
        </p>
      </div>

      {err && <div className="empty-note error">{err}</div>}

      {rows === null ? (
        <div className="empty-note">
          <div className="spinner" /> Memuat…
        </div>
      ) : rows.length === 0 && !err ? (
        <div className="empty-note">Belum ada model. Tambahkan di Panel Admin › Model AI.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="pr-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Kepintaran</th>
                <th>Kegunaan</th>
                <th style={{ textAlign: "right" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.name}>
                  <td>
                    <b>{m.name}</b>
                  </td>
                  <td>{m.intelligence || "—"}</td>
                  <td>{m.useCase || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <span
                      className="badge"
                      style={{ background: scoreColor(m.score) + "22", color: scoreColor(m.score), fontWeight: 700 }}
                    >
                      {m.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
