import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Seksi, ConstructionStage } from "../types";
import "@/components/klausul/klausul.css";

/* Master Seksi — bagian pekerjaan (I. Persiapan, II. Pondasi & Beton, …). Master
 * "gambar kiri" yang BERELASI ke item pekerjaan (ConstructionStage.seksi = kode).
 * Bobot & jumlah item tiap seksi dihitung dari item yang menunjuk ke seksi ini. */

const blank = { id: "", no: 0, kode: "", nama: "" };

export function MasterSeksiPanel() {
  const [rows, setRows] = useState<Seksi[]>([]);
  const [stages, setStages] = useState<ConstructionStage[]>([]);
  const [f, setF] = useState<typeof blank>({ ...blank });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    setErr("");
    try {
      const [s, st] = await Promise.all([
        api.list<Seksi>("seksi"),
        api.list<ConstructionStage>("construction-stages"),
      ]);
      setRows([...s].sort((a, b) => a.no - b.no));
      setStages(st);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const set = (patch: Partial<typeof blank>) => setF((p) => ({ ...p, ...patch }));
  const resetForm = () => setF({ ...blank, no: rows.length ? Math.max(...rows.map((r) => r.no)) + 1 : 1 });

  // Agregat per seksi (relasi): jumlah item + Σ bobot item yang seksi == kode.
  const aggByKode = useMemo(() => {
    const m = new Map<string, { count: number; bobot: number }>();
    for (const st of stages) {
      const k = st.seksi || "";
      const a = m.get(k) ?? { count: 0, bobot: 0 };
      a.count += 1;
      a.bobot += st.weight || 0;
      m.set(k, a);
    }
    return m;
  }, [stages]);
  const unassigned = aggByKode.get("");

  const save = async () => {
    if (!f.nama.trim()) {
      setErr("Nama seksi wajib diisi.");
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    const body = { no: Math.round(Number(f.no) || 0), kode: f.kode.trim(), nama: f.nama.trim() };
    try {
      if (f.id) await api.update("seksi", f.id, body);
      else await api.create("seksi", body);
      setMsg(f.id ? "✓ Seksi diperbarui" : "✓ Seksi ditambahkan");
      await reload();
      resetForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (s: Seksi) => {
    setF({ id: s.id, no: s.no, kode: s.kode, nama: s.nama });
    setMsg("");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (s: Seksi) => {
    const n = aggByKode.get(s.kode)?.count ?? 0;
    if (!window.confirm(`Hapus seksi "${s.kode}. ${s.nama}"?${n ? `\n${n} item masih menunjuk ke seksi ini (jadi tak terkelompok).` : ""}`)) return;
    setErr("");
    try {
      await api.remove("seksi", s.id);
      if (f.id === s.id) resetForm();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const grandTotal = useMemo(() => stages.reduce((a, s) => a + (s.weight || 0), 0), [stages]);

  return (
    <div className="klx">
      <div className="klx-head">
        <div>
          <h2>🗂️ Master Seksi Pekerjaan</h2>
          <p className="klx-sub">
            Bagian pekerjaan (I, II, III, …). <b>Berelasi</b> ke item pekerjaan: bobot & jumlah item
            tiap seksi dihitung dari item yang menunjuk ke seksi ini. Kaitkan item di menu{" "}
            <b>Master Item Bobot</b>.
          </p>
        </div>
      </div>

      {err && <div className="klx-alert err">⚠ {err}</div>}

      <div className="klx-grid">
        {/* ---- Form (kiri) ---- */}
        <div className="klx-card klx-form">
          <div className="klx-card-h">
            <h3>{f.id ? "Ubah Seksi" : "Tambah Seksi"}</h3>
            {f.id && (
              <button className="klx-btn ghost sm" onClick={resetForm}>
                + Baru
              </button>
            )}
          </div>
          <div className="klx-row2">
            <label className="klx-field klx-w-code">
              <span>Urutan</span>
              <input type="number" value={f.no} onChange={(e) => set({ no: Number(e.target.value) })} />
            </label>
            <label className="klx-field klx-w-code">
              <span>Kode</span>
              <input value={f.kode} onChange={(e) => set({ kode: e.target.value })} placeholder="II" />
            </label>
            <label className="klx-field">
              <span>Nama Seksi</span>
              <input value={f.nama} onChange={(e) => set({ nama: e.target.value })} placeholder="mis. PONDASI & BETON" />
            </label>
          </div>
          <div className="klx-form-actions">
            <button className="klx-btn" disabled={busy || !f.nama.trim()} onClick={save}>
              {busy ? "Menyimpan…" : f.id ? "Simpan Perubahan" : "Tambah Seksi"}
            </button>
            {msg && <span className="klx-ok">{msg}</span>}
          </div>
          <p className="klx-sub" style={{ marginTop: 10, fontSize: 12 }}>
            💡 Kode dipakai sebagai relasi (item menunjuk kode ini). Total bobot semua item saat ini:{" "}
            <b>{grandTotal.toFixed(2)}%</b>.
          </p>
        </div>

        {/* ---- Tabel (kanan) ---- */}
        <div className="klx-card">
          <div className="klx-card-h wrap">
            <h3>Seksi ({rows.length})</h3>
          </div>
          <div className="klx-tablewrap">
            <table className="klx-table">
              <thead>
                <tr>
                  <th className="klx-c-ord">No</th>
                  <th className="klx-c-code">Kode</th>
                  <th>Nama Seksi</th>
                  <th className="klx-c-ord" style={{ textAlign: "right" }}>Item</th>
                  <th className="klx-c-ord" style={{ textAlign: "right" }}>Bobot %</th>
                  <th className="klx-c-act"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="klx-empty">Belum ada seksi. Tambahkan lewat form di kiri.</td>
                  </tr>
                ) : (
                  rows.map((s) => {
                    const a = aggByKode.get(s.kode);
                    return (
                      <tr key={s.id} className={f.id === s.id ? "sel" : ""} onClick={() => edit(s)}>
                        <td className="klx-ord">{s.no}</td>
                        <td className="klx-code"><span className="klx-badge">{s.kode || "—"}</span></td>
                        <td className="klx-title">{s.nama}</td>
                        <td className="klx-ord" style={{ textAlign: "right" }}>{a?.count ?? 0}</td>
                        <td className="klx-ord" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {(a?.bobot ?? 0).toFixed(3)}
                        </td>
                        <td className="klx-act" onClick={(e) => e.stopPropagation()}>
                          <button className="klx-icon" title="Ubah" onClick={() => edit(s)}>✎</button>
                          <button className="klx-icon del" title="Hapus" onClick={() => del(s)}>✕</button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {unassigned && unassigned.count > 0 && (
                  <tr>
                    <td className="klx-ord">—</td>
                    <td className="klx-code"><span className="klx-badge" style={{ background: "#fef3c7", color: "#92400e" }}>?</span></td>
                    <td className="klx-title" style={{ color: "var(--klx-ink-2)" }}>(belum berseksi)</td>
                    <td className="klx-ord" style={{ textAlign: "right" }}>{unassigned.count}</td>
                    <td className="klx-ord" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {unassigned.bobot.toFixed(3)}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
