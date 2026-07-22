import { useCallback, useEffect, useMemo, useState } from "react";
import { listKontraktor, saveKontraktor, deleteKontraktor, type Kontraktor } from "./kontraktorApi";
import "../klausul/klausul.css";

/* Master Kontraktor — daftar vendor/kontraktor terpusat (lintas divisi). Data
 * lengkap (alamat, bank, rekening) supaya bisa auto-isi dokumen SPK nanti. */

const blank = {
  id: "",
  nama: "",
  jabatan: "Pemborong",
  alamat: "",
  telp: "",
  email: "",
  npwp: "",
  bank: "",
  noRek: "",
  atasNama: "",
  catatan: "",
  aktif: true,
};

export function MasterKontraktorPanel() {
  const [rows, setRows] = useState<Kontraktor[]>([]);
  const [f, setF] = useState<typeof blank>({ ...blank });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const reload = useCallback(async () => {
    setErr("");
    try {
      setRows(await listKontraktor());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const set = (patch: Partial<typeof blank>) => setF((p) => ({ ...p, ...patch }));
  const resetForm = () => setF({ ...blank });

  const save = async () => {
    if (!f.nama.trim()) {
      setErr("Nama kontraktor wajib diisi.");
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await saveKontraktor({ ...f, id: f.id || undefined, nama: f.nama.trim() });
      setMsg(f.id ? "✓ Kontraktor diperbarui" : "✓ Kontraktor ditambahkan");
      resetForm();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (k: Kontraktor) => {
    setF({ ...blank, ...k });
    setMsg("");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (k: Kontraktor) => {
    if (!window.confirm(`Hapus kontraktor "${k.nama}"?`)) return;
    setErr("");
    try {
      await deleteKontraktor(k.id);
      if (f.id === k.id) resetForm();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const PAGE = 8;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((k) =>
      `${k.nama} ${k.alamat} ${k.bank} ${k.noRek} ${k.telp}`.toLowerCase().includes(n),
    );
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="klx">
      <div className="klx-head">
        <div>
          <h2>👷 Master Kontraktor</h2>
          <p className="klx-sub">
            Daftar kontraktor/vendor terpusat (dipakai lintas divisi). Data lengkap di sini akan bisa
            <b> auto-isi</b> dokumen SPK (nama, alamat, bank, rekening).
          </p>
        </div>
      </div>

      {err && <div className="klx-alert err">⚠ {err}</div>}

      <div className="klx-grid">
        {/* ---- Form (kiri) ---- */}
        <div className="klx-card klx-form">
          <div className="klx-card-h">
            <h3>{f.id ? "Ubah Kontraktor" : "Tambah Kontraktor"}</h3>
            {f.id && (
              <button className="klx-btn ghost sm" onClick={resetForm}>
                + Baru
              </button>
            )}
          </div>
          <div className="klx-row2">
            <label className="klx-field">
              <span>Nama Kontraktor *</span>
              <input value={f.nama} onChange={(e) => set({ nama: e.target.value })} placeholder="mis. Yunan Bahro" />
            </label>
            <label className="klx-field" style={{ maxWidth: 150 }}>
              <span>Jabatan</span>
              <input value={f.jabatan} onChange={(e) => set({ jabatan: e.target.value })} placeholder="Pemborong" />
            </label>
          </div>
          <label className="klx-field">
            <span>Alamat</span>
            <textarea value={f.alamat} onChange={(e) => set({ alamat: e.target.value })} rows={2} placeholder="Alamat lengkap" />
          </label>
          <div className="klx-row2">
            <label className="klx-field">
              <span>Telepon</span>
              <input value={f.telp} onChange={(e) => set({ telp: e.target.value })} placeholder="08xx" />
            </label>
            <label className="klx-field">
              <span>Email</span>
              <input value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@…" />
            </label>
          </div>
          <label className="klx-field">
            <span>NPWP</span>
            <input value={f.npwp} onChange={(e) => set({ npwp: e.target.value })} placeholder="NPWP (opsional)" />
          </label>
          <div className="klx-row2">
            <label className="klx-field" style={{ maxWidth: 130 }}>
              <span>Bank</span>
              <input value={f.bank} onChange={(e) => set({ bank: e.target.value })} placeholder="BCA" />
            </label>
            <label className="klx-field">
              <span>No. Rekening</span>
              <input value={f.noRek} onChange={(e) => set({ noRek: e.target.value })} placeholder="1234567890" />
            </label>
          </div>
          <label className="klx-field">
            <span>Atas Nama Rekening</span>
            <input value={f.atasNama} onChange={(e) => set({ atasNama: e.target.value })} placeholder="Nama pemegang rekening" />
          </label>
          <label className="klx-field">
            <span>Catatan</span>
            <textarea value={f.catatan} onChange={(e) => set({ catatan: e.target.value })} rows={2} placeholder="Catatan (opsional)" />
          </label>
          <label className="klx-check">
            <input type="checkbox" checked={f.aktif} onChange={(e) => set({ aktif: e.target.checked })} />
            <span>Aktif</span>
          </label>
          <div className="klx-form-actions">
            <button className="klx-btn" disabled={busy || !f.nama.trim()} onClick={save}>
              {busy ? "Menyimpan…" : f.id ? "Simpan Perubahan" : "Tambah Kontraktor"}
            </button>
            {msg && <span className="klx-ok">{msg}</span>}
          </div>
        </div>

        {/* ---- Tabel (kanan) ---- */}
        <div className="klx-card">
          <div className="klx-card-h wrap">
            <h3>Daftar Kontraktor ({rows.length})</h3>
            <input
              className="klx-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="🔎 Cari nama / bank…"
            />
          </div>
          <div className="klx-tablewrap">
            <table className="klx-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th className="klx-c-code">Jabatan</th>
                  <th>Telp</th>
                  <th>Bank · No. Rek</th>
                  <th className="klx-c-act"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="klx-empty">
                      Belum ada kontraktor. Tambahkan lewat form di kiri.
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="klx-empty">
                      Tidak ada yang cocok.
                    </td>
                  </tr>
                ) : (
                  slice.map((k) => (
                    <tr key={k.id} className={f.id === k.id ? "sel" : ""} onClick={() => edit(k)}>
                      <td className="klx-title">
                        {k.nama} {!k.aktif && <span className="klx-badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>nonaktif</span>}
                      </td>
                      <td className="klx-code">{k.jabatan || "—"}</td>
                      <td>{k.telp || "—"}</td>
                      <td>{k.bank || k.noRek ? `${k.bank} ${k.noRek}`.trim() : "—"}</td>
                      <td className="klx-act" onClick={(e) => e.stopPropagation()}>
                        <button className="klx-icon" title="Ubah" onClick={() => edit(k)}>
                          ✎
                        </button>
                        <button className="klx-icon del" title="Hapus" onClick={() => del(k)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="klx-pager">
              <button disabled={cur === 0} onClick={() => setPage(cur - 1)}>
                ‹ Sebelumnya
              </button>
              <span>
                Hal {cur + 1} / {pages}
              </span>
              <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                Berikutnya ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
