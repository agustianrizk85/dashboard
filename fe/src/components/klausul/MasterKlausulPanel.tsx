import { useCallback, useEffect, useMemo, useState } from "react";
import { listKlausul, saveKlausul, deleteKlausul, extractPlaceholders, type Klausul } from "./klausulApi";
import "./klausul.css";

/* Master Klausul — pustaka klausul milik satu divisi. Tiap klausul punya jenis
 * dokumen (mis. SPK), kode (A/B/…), judul, urutan, dan isi template yang boleh
 * mengandung {placeholder}. Dipakai ulang saat menyusun dokumen di DocBuilder. */

const blank = { id: "", docType: "SPK", code: "", title: "", body: "", order: 0 };

export function MasterKlausulPanel({ division }: { division: string }) {
  const [rows, setRows] = useState<Klausul[]>([]);
  const [f, setF] = useState<typeof blank>({ ...blank });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [docFilter, setDocFilter] = useState("");
  const [page, setPage] = useState(0);

  const reload = useCallback(async () => {
    setErr("");
    try {
      setRows(await listKlausul(division));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [division]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const set = (patch: Partial<typeof blank>) => setF((p) => ({ ...p, ...patch }));
  const resetForm = () => setF({ ...blank, docType: f.docType });

  const save = async () => {
    if (!f.title.trim() || !f.docType.trim()) {
      setErr("Jenis dokumen & judul wajib diisi.");
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await saveKlausul({
        id: f.id || undefined,
        division,
        docType: f.docType.trim(),
        code: f.code.trim(),
        title: f.title.trim(),
        body: f.body,
        order: Math.round(Number(f.order) || 0),
      });
      setMsg(f.id ? "✓ Klausul diperbarui" : "✓ Klausul ditambahkan");
      resetForm();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (k: Klausul) => {
    setF({ id: k.id, docType: k.docType, code: k.code, title: k.title, body: k.body, order: k.order });
    setMsg("");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (k: Klausul) => {
    if (!window.confirm(`Hapus klausul "${k.title}"?`)) return;
    setErr("");
    try {
      await deleteKlausul(k.id);
      if (f.id === k.id) resetForm();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // Distinct doc types (for the filter chips).
  const docTypes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.docType));
    return [...s].sort();
  }, [rows]);

  // Placeholders live-detected in the body being edited.
  const bodyPh = useMemo(() => extractPlaceholders([f.body]), [f.body]);

  // Filter (doc + search) + paginate.
  const PAGE = 8;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (docFilter && r.docType !== docFilter) return false;
      if (!n) return true;
      return `${r.docType} ${r.code} ${r.title} ${r.body}`.toLowerCase().includes(n);
    });
  }, [rows, q, docFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="klx">
      <div className="klx-head">
        <div>
          <h2>📚 Master Klausul</h2>
          <p className="klx-sub">
            Pustaka klausul divisi <b>{division}</b>. Susun dokumen (mis. SPK) dari klausul ini di menu{" "}
            <b>Buat Dokumen</b>. Gunakan <code>{"{PLACEHOLDER}"}</code> untuk bagian yang diisi saat pembuatan.
          </p>
        </div>
      </div>

      {err && <div className="klx-alert err">⚠ {err}</div>}

      <div className="klx-grid">
        {/* ---- Form (kiri) ---- */}
        <div className="klx-card klx-form">
          <div className="klx-card-h">
            <h3>{f.id ? "Ubah Klausul" : "Tambah Klausul"}</h3>
            {f.id && (
              <button className="klx-btn ghost sm" onClick={resetForm}>
                + Baru
              </button>
            )}
          </div>
          <div className="klx-row2">
            <label className="klx-field">
              <span>Jenis Dokumen</span>
              <input
                value={f.docType}
                onChange={(e) => set({ docType: e.target.value })}
                placeholder="SPK"
                list="klx-doctypes"
              />
              <datalist id="klx-doctypes">
                {docTypes.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </label>
            <label className="klx-field klx-w-code">
              <span>Kode</span>
              <input value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="A" />
            </label>
            <label className="klx-field klx-w-code">
              <span>Urutan</span>
              <input
                type="number"
                value={f.order}
                onChange={(e) => set({ order: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="klx-field">
            <span>Judul Klausul</span>
            <input
              value={f.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="mis. TATA CARA PEMBAYARAN"
            />
          </label>
          <label className="klx-field">
            <span>Isi Klausul (template)</span>
            <textarea
              value={f.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={10}
              placeholder={"Tulis isi klausul…\nContoh: Pekerjaan pembangunan rumah tipe {TIPE UNIT} blok {BLOK UNIT} proyek {NAMA PROYEK}."}
            />
          </label>
          {bodyPh.length > 0 && (
            <div className="klx-ph">
              <span className="klx-ph-label">Placeholder terdeteksi:</span>
              {bodyPh.map((p) => (
                <span key={p} className="klx-chip">
                  {p}
                </span>
              ))}
            </div>
          )}
          <div className="klx-form-actions">
            <button className="klx-btn" disabled={busy || !f.title.trim()} onClick={save}>
              {busy ? "Menyimpan…" : f.id ? "Simpan Perubahan" : "Tambah Klausul"}
            </button>
            {msg && <span className="klx-ok">{msg}</span>}
          </div>
        </div>

        {/* ---- Tabel (kanan) ---- */}
        <div className="klx-card">
          <div className="klx-card-h wrap">
            <h3>Daftar Klausul ({rows.length})</h3>
            <div className="klx-tools">
              <input
                className="klx-search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="🔎 Cari klausul…"
              />
            </div>
          </div>
          {docTypes.length > 0 && (
            <div className="klx-filters">
              <button
                className={`klx-fchip ${docFilter === "" ? "on" : ""}`}
                onClick={() => {
                  setDocFilter("");
                  setPage(0);
                }}
              >
                Semua
              </button>
              {docTypes.map((d) => (
                <button
                  key={d}
                  className={`klx-fchip ${docFilter === d ? "on" : ""}`}
                  onClick={() => {
                    setDocFilter(d);
                    setPage(0);
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <div className="klx-tablewrap">
            <table className="klx-table">
              <thead>
                <tr>
                  <th className="klx-c-dok">Dok</th>
                  <th className="klx-c-code">Kode</th>
                  <th>Judul</th>
                  <th className="klx-c-ord">Urut</th>
                  <th className="klx-c-act"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="klx-empty">
                      Belum ada klausul. Tambahkan lewat form di kiri.
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
                      <td>
                        <span className="klx-badge">{k.docType}</span>
                      </td>
                      <td className="klx-code">{k.code || "—"}</td>
                      <td className="klx-title">{k.title}</td>
                      <td className="klx-ord">{k.order}</td>
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
