import { useCallback, useEffect, useState } from "react";

/** One master-data row, normalized to a key/value pair so this panel can serve
 *  both Master Divisi ({code,name}) and Master Role ({value,label}). */
export interface MasterRow {
  k: string;
  v: string;
}

/** Generic master-data manager: a small add-form (Kode/Value + Nama/Label) plus a
 *  wms-table of existing rows with a delete button. Reloads after add/delete.
 *  Used by AdminApp for the "Master Divisi" and "Master Role" tabs. */
export function MasterPanel({
  title,
  note,
  kHead,
  vHead,
  kPlaceholder,
  vPlaceholder,
  load,
  save,
  remove,
}: {
  title: string;
  note?: string;
  kHead: string;
  vHead: string;
  kPlaceholder?: string;
  vPlaceholder?: string;
  load: () => Promise<MasterRow[]>;
  save: (k: string, v: string) => Promise<void>;
  remove: (k: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    setErr("");
    try {
      setRows(await load());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async () => {
    if (!k.trim() || !v.trim()) return;
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await save(k.trim(), v.trim());
      setMsg("✓ Tersimpan: " + k.trim());
      setK("");
      setV("");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (row: MasterRow) => {
    if (!window.confirm(`Hapus "${row.v}" (${row.k})?`)) return;
    setMsg("");
    setErr("");
    try {
      await remove(row.k);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="wms-grid">
      <div className="wms-card wms-col-4">
        <div className="wms-card-h">
          <h3>Tambah {title}</h3>
        </div>
        {note && <p className="wms-note">{note}</p>}
        <label className="wms-field">
          <span>{kHead}</span>
          <input value={k} onChange={(e) => setK(e.target.value)} placeholder={kPlaceholder} />
        </label>
        <label className="wms-field">
          <span>{vHead}</span>
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder={vPlaceholder} />
        </label>
        <button className="wms-btn" disabled={busy || !k.trim() || !v.trim()} onClick={add}>
          {busy ? "Menyimpan…" : "Tambah"}
        </button>
        {msg && <div className="wms-ok" style={{ marginTop: 8 }}>{msg}</div>}
        {err && <div className="wms-err" style={{ marginTop: 8 }}>⚠ {err}</div>}
      </div>

      <div className="wms-card wms-col-8">
        <div className="wms-card-h">
          <h3>{title} ({rows.length})</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="wms-table">
            <thead>
              <tr>
                <th>{kHead}</th>
                <th>{vHead}</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="wms-empty">Belum ada data.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.k}>
                    <td><span className="wms-badge grey">{row.k}</span></td>
                    <td>{row.v}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="wms-del" onClick={() => del(row)} title="Hapus">✕</button>
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
