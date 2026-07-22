import { useCallback, useEffect, useState } from "react";

/* AI › Model — pilih model AI yang dipakai DIVISI ini (teks + vision) dari
 * katalog pusat, lalu fitur AI divisi (Asisten, Deep Revisi gambar kerja) pakai
 * model itu. Katalog master dikelola superadmin di Panel Admin › Model AI; di
 * sini Kadep divisi memilih mana yang dipakai. Data via auth (SSO token). */

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");

function ssoToken(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}
async function authGet<T>(path: string): Promise<T> {
  const r = await fetch(`${AUTH}${path}`, { headers: { Authorization: "Bearer " + ssoToken() } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

interface AIModel {
  name: string;
  intelligence: string;
  useCase: string;
  score: number;
}
interface DivChoice {
  text: string;
  vision: string;
  effectiveText: string;
  effectiveVision: string;
}

function scoreColor(s: number): string {
  return s >= 80 ? "#15803d" : s >= 50 ? "#b45309" : "#64748b";
}

export function ModelView({ division = "perencanaan" }: { division?: string }) {
  const [catalog, setCatalog] = useState<AIModel[] | null>(null);
  const [choice, setChoice] = useState<DivChoice | null>(null);
  const [text, setText] = useState("");
  const [vision, setVision] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!ssoToken()) {
      setErr("Masuk lewat dashboard untuk mengatur model.");
      setCatalog([]);
      return;
    }
    try {
      const [cat, ch] = await Promise.all([
        authGet<AIModel[]>("/ai/model-catalog"),
        authGet<DivChoice>(`/ai/division-model?division=${encodeURIComponent(division)}`),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setChoice(ch);
      setText(ch.text ?? "");
      setVision(ch.vision ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [division]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const r = await fetch(`${AUTH}/ai/division-model`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + ssoToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ division, text, vision }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setChoice(j as DivChoice);
      setMsg("✓ Tersimpan — fitur AI divisi ini memakai model terpilih.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const opts = (catalog ?? []).map((m) => m.name);

  return (
    <div className="pr-panel">
      <div className="pr-panel-head">
        <h2>🧠 Model AI Divisi</h2>
        <p className="muted">
          Pilih model AI yang dipakai divisi ini. <b>Model Teks</b> untuk Asisten &amp; Generate AI;{" "}
          <b>Model Vision</b> untuk Deep Revisi gambar kerja. Katalog dikelola di{" "}
          <b>Panel Admin › Model AI</b>.
        </p>
      </div>

      {err && <div className="empty-note error">{err}</div>}

      {catalog === null ? (
        <div className="empty-note">
          <div className="spinner" /> Memuat…
        </div>
      ) : (
        <>
          <div className="pr-modelpick">
            <label className="field">
              <span>Model Teks (Asisten / Generate)</span>
              <select value={text} onChange={(e) => setText(e.target.value)}>
                <option value="">— Default global —</option>
                {opts.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <small className="muted">
                Aktif: <b>{choice?.effectiveText || "—"}</b>
              </small>
            </label>
            <label className="field">
              <span>Model Vision (Deep Revisi)</span>
              <select value={vision} onChange={(e) => setVision(e.target.value)}>
                <option value="">— Default global —</option>
                {opts.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <small className="muted">
                Aktif: <b>{choice?.effectiveVision || "—"}</b>
              </small>
            </label>
            <button className="btn-ai" disabled={busy} onClick={save}>
              {busy ? "Menyimpan…" : "Simpan pilihan"}
            </button>
            {msg && <div style={{ color: "#15803d", fontWeight: 600, alignSelf: "center" }}>{msg}</div>}
          </div>

          <h3 style={{ margin: "1.4rem 0 0.6rem", fontSize: "1rem", color: "#14361f" }}>
            Katalog Model AI ({(catalog ?? []).length})
          </h3>
          {catalog.length === 0 ? (
            <div className="empty-note">Belum ada model. Tambahkan di Panel Admin › Model AI.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="pr-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Kepintaran</th>
                    <th>Kegunaan</th>
                    <th style={{ textAlign: "right" }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((m) => (
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
        </>
      )}
    </div>
  );
}
