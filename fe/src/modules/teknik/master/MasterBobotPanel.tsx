import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ConstructionStage, Seksi } from "../types";
import "@/components/klausul/klausul.css";

/* Master Item Bobot — kelola daftar item pekerjaan (ConstructionStage) yang
 * jadi dasar bobot & kurva-S: nama, bobot %, seksi, urutan. Dinamis: tambah/
 * ubah/hapus item → progres tiap unit tetap map item→selesai (tak ada kolom).
 * Tiap item BERELASI ke Master Seksi lewat kode seksi. (Termin = urusan terpisah,
 * tidak dikelola di sini; nilai termin item tetap dipertahankan apa adanya.) */

const blank = { id: "", no: 0, name: "", weight: 0, termin: "", seksi: "" };

export function MasterBobotPanel() {
  const [rows, setRows] = useState<ConstructionStage[]>([]);
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [f, setF] = useState<typeof blank>({ ...blank });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [seksiFilter, setSeksiFilter] = useState("");
  const [page, setPage] = useState(0);

  const reload = useCallback(async () => {
    setErr("");
    try {
      const [list, sk] = await Promise.all([
        api.list<ConstructionStage>("construction-stages"),
        api.list<Seksi>("seksi"),
      ]);
      setRows([...list].sort((a, b) => a.no - b.no));
      setSeksiList([...sk].sort((a, b) => a.no - b.no));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const seksiNama = (kode: string) => seksiList.find((s) => s.kode === kode)?.nama ?? "";

  const set = (patch: Partial<typeof blank>) => setF((p) => ({ ...p, ...patch }));
  const resetForm = () => setF({ ...blank, no: rows.length ? Math.max(...rows.map((r) => r.no)) + 1 : 1 });

  const save = async () => {
    if (!f.name.trim()) {
      setErr("Nama pekerjaan wajib diisi.");
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    const body = {
      no: Math.round(Number(f.no) || 0),
      name: f.name.trim(),
      weight: Number(f.weight) || 0,
      termin: f.termin, // dipertahankan apa adanya (tak dikelola di panel ini)
      seksi: f.seksi,
    };
    try {
      if (f.id) await api.update("construction-stages", f.id, body);
      else await api.create("construction-stages", body);
      setMsg(f.id ? "✓ Item diperbarui" : "✓ Item ditambahkan");
      await reload();
      resetForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (s: ConstructionStage) => {
    setF({ id: s.id, no: s.no, name: s.name, weight: s.weight, termin: s.termin || "T1", seksi: s.seksi || "" });
    setMsg("");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (s: ConstructionStage) => {
    if (!window.confirm(`Hapus item "${s.name}"?`)) return;
    setErr("");
    try {
      await api.remove("construction-stages", s.id);
      if (f.id === s.id) resetForm();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const total = useMemo(() => rows.reduce((a, r) => a + (r.weight || 0), 0), [rows]);
  const totalTone = Math.abs(total - 100) < 0.5 ? "ok" : "warn";

  const PAGE = 12;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (seksiFilter === "__none") {
        if (r.seksi) return false;
      } else if (seksiFilter && (r.seksi || "") !== seksiFilter) return false;
      if (!n) return true;
      return r.name.toLowerCase().includes(n);
    });
  }, [rows, q, seksiFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="klx">
      <div className="klx-head">
        <div>
          <h2>🧱 Master Item Bobot</h2>
          <p className="klx-sub">
            Daftar item pekerjaan dasar bobot & kurva-S. <b>Dinamis</b>: tambah/ubah/hapus item di
            sini — progres tiap unit otomatis ikut (tak ada kolom yang perlu diubah).
          </p>
        </div>
      </div>

      {err && <div className="klx-alert err">⚠ {err}</div>}

      <div className="klx-grid">
        {/* ---- Form (kiri) ---- */}
        <div className="klx-card klx-form">
          <div className="klx-card-h">
            <h3>{f.id ? "Ubah Item" : "Tambah Item"}</h3>
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
              <span>Bobot (%)</span>
              <input
                type="number"
                step="0.001"
                value={f.weight}
                onChange={(e) => set({ weight: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="klx-field">
            <span>Nama Pekerjaan</span>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="mis. Pondasi Batu Belah" />
          </label>
          <label className="klx-field">
            <span>Seksi (bagian pekerjaan)</span>
            <select value={f.seksi} onChange={(e) => set({ seksi: e.target.value })}>
              <option value="">— belum berseksi —</option>
              {seksiList.map((s) => (
                <option key={s.id} value={s.kode}>
                  {s.kode}. {s.nama}
                </option>
              ))}
            </select>
          </label>
          <div className="klx-form-actions">
            <button className="klx-btn" disabled={busy || !f.name.trim()} onClick={save}>
              {busy ? "Menyimpan…" : f.id ? "Simpan Perubahan" : "Tambah Item"}
            </button>
            {msg && <span className="klx-ok">{msg}</span>}
          </div>
        </div>

        {/* ---- Tabel (kanan) ---- */}
        <div className="klx-card">
          <div className="klx-card-h wrap">
            <h3>
              Item Pekerjaan ({rows.length}) · Total bobot{" "}
              <span className="klx-badge" style={totalTone === "ok" ? {} : { background: "#fef3c7", color: "#92400e" }}>
                {total.toFixed(2)}%
              </span>
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                className="klx-search"
                value={seksiFilter}
                onChange={(e) => {
                  setSeksiFilter(e.target.value);
                  setPage(0);
                }}
                style={{ maxWidth: 200 }}
              >
                <option value="">Semua seksi</option>
                {seksiList.map((s) => (
                  <option key={s.id} value={s.kode}>
                    {s.kode}. {s.nama}
                  </option>
                ))}
                <option value="__none">(belum berseksi)</option>
              </select>
              <input
                className="klx-search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="🔎 Cari pekerjaan…"
              />
            </div>
          </div>
          <div className="klx-tablewrap">
            <table className="klx-table">
              <thead>
                <tr>
                  <th className="klx-c-ord">No</th>
                  <th>Nama Pekerjaan</th>
                  <th>Seksi</th>
                  <th className="klx-c-ord" style={{ textAlign: "right" }}>Bobot %</th>
                  <th className="klx-c-act"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="klx-empty">Belum ada item. Tambahkan lewat form di kiri.</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="klx-empty">Tidak ada yang cocok.</td>
                  </tr>
                ) : (
                  slice.map((s) => (
                    <tr key={s.id} className={f.id === s.id ? "sel" : ""} onClick={() => edit(s)}>
                      <td className="klx-ord">{s.no}</td>
                      <td className="klx-title">{s.name}</td>
                      <td>
                        {s.seksi ? (
                          <span className="klx-badge" title={seksiNama(s.seksi)}>{s.seksi}</span>
                        ) : (
                          <span className="klx-badge" style={{ background: "#fef3c7", color: "#92400e" }}>—</span>
                        )}
                      </td>
                      <td className="klx-ord" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {(s.weight ?? 0).toFixed(3)}
                      </td>
                      <td className="klx-act" onClick={(e) => e.stopPropagation()}>
                        <button className="klx-icon" title="Ubah" onClick={() => edit(s)}>✎</button>
                        <button className="klx-icon del" title="Hapus" onClick={() => del(s)}>✕</button>
                      </td>
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
    </div>
  );
}
