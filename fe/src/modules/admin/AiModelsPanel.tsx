import { useCallback, useEffect, useState } from "react";
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
        <div className="wms-card-h">
          <h3>Katalog Model AI ({rows.length})</h3>
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
              ) : (
                rows.map((m) => (
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
      </div>
    </div>
  );
}
