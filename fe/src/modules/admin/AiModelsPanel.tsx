import { useCallback, useEffect, useMemo, useState } from "react";
import { getModels, saveModel, deleteModel, type AIModel } from "./masterApi";

/** Panel Admin → Model AI. Katalog model AI yang dikelola admin: nama model,
 *  kepintarannya, kegunaannya (lebih untuk apa), dan score. Jadi acuan pilihan
 *  model di fitur-fitur AI. */
export function AiModelsPanel() {
  const [rows, setRows] = useState<AIModel[]>([]);
  const [name, setName] = useState("");
  const [intelligence, setIntelligence] = useState("");
  const [useCase, setUseCase] = useState("");
  const [score, setScore] = useState(80);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const reload = useCallback(async () => {
    setErr("");
    try {
      setRows(await getModels());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const list = await saveModel({
        name: name.trim(),
        intelligence: intelligence.trim(),
        useCase: useCase.trim(),
        score: Math.max(0, Math.min(100, Math.round(score) || 0)),
      });
      setRows(list);
      setMsg("✓ Tersimpan: " + name.trim());
      setName("");
      setIntelligence("");
      setUseCase("");
      setScore(80);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (m: AIModel) => {
    if (!window.confirm(`Hapus model "${m.name}"?`)) return;
    setMsg("");
    setErr("");
    try {
      await deleteModel(m.name);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // wms-badge tones: base (green) / warn (amber) / grey.
  const scoreTone = (s: number) => (s >= 80 ? "" : s >= 50 ? "warn" : "grey");

  // Filter (search) + paginasi tabel katalog.
  const PAGE = 8;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((m) => `${m.name} ${m.intelligence} ${m.useCase}`.toLowerCase().includes(n));
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="wms-grid">
      <div className="wms-card wms-col-4">
        <div className="wms-card-h">
          <h3>Tambah / Ubah Model AI</h3>
        </div>
        <p className="wms-note">
          Katalog model AI. Nama sama = menimpa (edit). Nanti dipakai sebagai pilihan model di fitur AI.
        </p>
        <label className="wms-field">
          <span>Nama Model</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. qwen3.5:397b" />
        </label>
        <label className="wms-field">
          <span>Kepintaran</span>
          <input
            value={intelligence}
            onChange={(e) => setIntelligence(e.target.value)}
            placeholder="mis. Reasoning kuat, multimodal"
          />
        </label>
        <label className="wms-field">
          <span>Kegunaan (lebih untuk apa)</span>
          <input
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            placeholder="mis. Vision / baca gambar kerja"
          />
        </label>
        <label className="wms-field">
          <span>Score ({score})</span>
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
          />
        </label>
        <button className="wms-btn" disabled={busy || !name.trim()} onClick={add}>
          {busy ? "Menyimpan…" : "Simpan Model"}
        </button>
        {msg && <div className="wms-ok" style={{ marginTop: 8 }}>{msg}</div>}
        {err && <div className="wms-err" style={{ marginTop: 8 }}>⚠ {err}</div>}
      </div>

      <div className="wms-card wms-col-8">
        <div className="wms-card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3>Katalog Model AI ({rows.length})</h3>
          <input
            className="wms-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="🔎 Cari model / kegunaan…"
            style={{ minWidth: 220, padding: "0.4rem 0.7rem", border: "1px solid #d5dbd5", borderRadius: 8 }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="wms-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Kepintaran</th>
                <th>Kegunaan</th>
                <th style={{ textAlign: "right" }}>Score</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wms-empty">Belum ada model.</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wms-empty">Tidak ada yang cocok.</td>
                </tr>
              ) : (
                slice.map((m) => (
                  <tr key={m.name}>
                    <td><span className="wms-badge grey">{m.name}</span></td>
                    <td>{m.intelligence || "—"}</td>
                    <td>{m.useCase || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`wms-badge ${scoreTone(m.score)}`}>{m.score}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="wms-del" onClick={() => del(m)} title="Hapus">✕</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 12 }}>
            <button className="wms-btn ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
              ‹ Sebelumnya
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>
              Hal {cur + 1} / {pages}
            </span>
            <button className="wms-btn ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
              Berikutnya ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
