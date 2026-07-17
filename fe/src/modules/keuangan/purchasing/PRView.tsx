import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import type { PRItem, PRStatus, PurchaseRequest } from "../types";
import type { Tone } from "../types";
import { api } from "../api/client";
import { Panel, Pill } from "../components/ui";
import { withAuth, errMsg, type LoadState } from "./data";
import { dateLabel, todayISO } from "./format";
import { printPR } from "./print";

const STATUS_TONE: Record<PRStatus, Tone> = {
  draft: "neutral",
  pending: "yellow",
  approved: "green",
  rejected: "red",
};
const STATUS_LABEL: Record<PRStatus, string> = {
  draft: "Draft",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export function PrStatusPill({ status }: { status: PRStatus }) {
  return <Pill tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Pill>;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

export function PRView() {
  const [state, setState] = useState<LoadState<PurchaseRequest[]>>({ status: "loading", data: null, error: "" });
  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseRequest | null>(null);

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    try {
      const rows = await withAuth(() => api.prList(filter || undefined));
      setState({ status: "ready", data: Array.isArray(rows) ? rows : [], error: "" });
    } catch (e) {
      setState({ status: "error", data: null, error: errMsg(e) });
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  if (state.status === "loading") {
    return <div className="splash"><div className="spinner" />Memuat Purchase Request…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="splash error">
        <div className="splash-title">Gagal memuat PR</div>
        <div className="splash-msg">{state.error}</div>
        <button className="splash-btn" onClick={() => void load()}>Coba lagi</button>
      </div>
    );
  }

  const rows = state.data;

  return (
    <div className="body">
      <div className="pur-bar">
        <div className="pur-filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={`pur-chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button className="adm-btn primary" onClick={() => setFormOpen(true)}>＋ Buat PR</button>
      </div>

      <Panel tag="PURCHASE REQUEST" title="Daftar Permintaan Pembelian" sub={`${rows.length} PR`}>
        {rows.length === 0 ? (
          <div className="empty-mini" style={{ padding: 40 }}>Belum ada Purchase Request. Klik <b>Buat PR</b>.</div>
        ) : (
          <div className="ar-tablewrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Nomor</th><th>Tanggal Order</th><th>Pemohon</th><th>Proyek</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pr) => (
                  <tr key={pr.id} className="pur-row" onClick={() => setDetail(pr)}>
                    <td><b>{pr.nomor || "(draft)"}</b></td>
                    <td>{dateLabel(pr.requestDate)}</td>
                    <td>{pr.requestBy || "—"}</td>
                    <td>{pr.proyek || "—"}</td>
                    <td><PrStatusPill status={pr.status} /></td>
                    <td className="r"><span className="pur-link">Detail →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {formOpen && <PRForm onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); void load(); }} />}
      {detail && (
        <PRDetail
          pr={detail}
          onClose={() => setDetail(null)}
          onChanged={(updated) => { setDetail(updated); void load(); }}
        />
      )}
    </div>
  );
}

/* ── Create form ──────────────────────────────────────────────────────────── */

const emptyItem = (no: number): PRItem => ({ no, nama: "", satuan: "", qty: 1, tujuan: "" });

function PRForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [h, setH] = useState({
    requestBy: user?.name ?? "", dept: user?.division ?? "", proyek: "", requestDate: todayISO(), dateRequired: "",
    supplier: "", alamatPengiriman: "", pic: "", catatan: "", diajukanOleh: user?.name ?? "", diketahuiOleh: "",
  });
  const [items, setItems] = useState<PRItem[]>([emptyItem(1)]);
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [error, setError] = useState("");

  const setField = (k: keyof typeof h, v: string) => setH((s) => ({ ...s, [k]: v }));
  const setItem = (i: number, k: keyof PRItem, v: string) =>
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: k === "qty" ? Number(v) : v } : r)));
  const addItem = () => setItems((rows) => [...rows, emptyItem(rows.length + 1)]);
  const removeItem = (i: number) =>
    setItems((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i).map((r, k) => ({ ...r, no: k + 1 })) : rows));

  const save = async (submit: boolean) => {
    if (!h.requestBy.trim()) { setError("Nama pemohon (Request By) wajib diisi."); return; }
    const cleanItems = items.filter((it) => it.nama.trim()).map((it, k) => ({ ...it, no: k + 1 }));
    if (cleanItems.length === 0) { setError("Tambahkan minimal satu item."); return; }
    setBusy(submit ? "submit" : "draft");
    setError("");
    try {
      await withAuth(() => api.prCreate({ ...h, items: cleanItems, submit }));
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <form className="mdf-card wide-card" onClick={(e) => e.stopPropagation()} onSubmit={(e) => e.preventDefault()}>
        <header className="mdf-head">
          <h3>Buat Purchase Request</h3>
          <button type="button" className="mdf-close" onClick={onClose}>×</button>
        </header>
        <div className="mdf-body">
          <F label="Karyawan / Pemohon *"><input value={h.requestBy} onChange={(e) => setField("requestBy", e.target.value)} /></F>
          <F label="Proyek"><input value={h.proyek} onChange={(e) => setField("proyek", e.target.value)} /></F>
          <F label="Tanggal Order"><input type="date" value={h.requestDate} onChange={(e) => setField("requestDate", e.target.value)} /></F>
          <F label="Perkiraan Material Sampai"><input type="date" value={h.dateRequired} onChange={(e) => setField("dateRequired", e.target.value)} /></F>

          <div className="mdf-field wide">
            <span className="mdf-label">Item Permintaan</span>
            <div className="pur-items">
              <div className="pur-items-h">
                <span className="c">No</span><span>Nama Barang</span><span>Satuan</span><span className="q">Qty</span><span>Tujuan</span><span className="x" />
              </div>
              {items.map((it, i) => (
                <div className="pur-items-r" key={i}>
                  <span className="c">{i + 1}</span>
                  <input value={it.nama} placeholder="Nama barang" onChange={(e) => setItem(i, "nama", e.target.value)} />
                  <input value={it.satuan} placeholder="sak/pcs" onChange={(e) => setItem(i, "satuan", e.target.value)} />
                  <input className="q" type="number" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                  <input value={it.tujuan} placeholder="Keperluan" onChange={(e) => setItem(i, "tujuan", e.target.value)} />
                  <button type="button" className="pur-itemx" onClick={() => removeItem(i)} disabled={items.length <= 1} title="Hapus item">✕</button>
                </div>
              ))}
              <button type="button" className="adm-btn ghost" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={addItem}>＋ Tambah Item</button>
            </div>
          </div>
        </div>
        {error && <div className="mdf-error">{error}</div>}
        <footer className="mdf-foot">
          <button type="button" className="md-btn" onClick={onClose}>Batal</button>
          <button type="button" className="md-btn" disabled={busy !== ""} onClick={() => void save(false)}>
            {busy === "draft" ? "Menyimpan…" : "Simpan Draft"}
          </button>
          <button type="button" className="md-btn primary" disabled={busy !== ""} onClick={() => void save(true)}>
            {busy === "submit" ? "Mengajukan…" : "Simpan & Ajukan"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function F({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`mdf-field ${wide ? "wide" : ""}`}>
      <span className="mdf-label">{label}</span>
      {children}
    </label>
  );
}

/* ── Detail modal ─────────────────────────────────────────────────────────── */

function PRDetail({ pr, onClose, onChanged }: { pr: PurchaseRequest; onClose: () => void; onChanged: (p: PurchaseRequest) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      onChanged(await withAuth(() => api.prSubmit(pr.id)));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!window.confirm("Hapus PR ini?")) return;
    setBusy(true);
    setError("");
    try {
      await withAuth(() => api.prDelete(pr.id));
      onClose();
      onChanged(pr); // triggers reload; detail closed
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <div className="mdf-card wide-card" onClick={(e) => e.stopPropagation()}>
        <header className="mdf-head">
          <h3>PR {pr.nomor || "(draft)"} · <PrStatusPill status={pr.status} /></h3>
          <button type="button" className="mdf-close" onClick={onClose}>×</button>
        </header>
        <div className="mdf-body" style={{ display: "block" }}>
          <div className="pur-meta">
            <MetaRow label="Tanggal Order" value={dateLabel(pr.requestDate)} />
            <MetaRow label="Perkiraan Material Sampai" value={dateLabel(pr.dateRequired)} />
            <MetaRow label="Karyawan / Pemohon" value={pr.requestBy} />
            <MetaRow label="Proyek" value={pr.proyek} />
          </div>
          <div className="ar-tablewrap" style={{ marginTop: 10 }}>
            <table className="ar-table">
              <thead><tr><th>No</th><th>Nama</th><th>Satuan</th><th className="r">Qty</th><th>Tujuan</th></tr></thead>
              <tbody>
                {(pr.items ?? []).map((it, i) => (
                  <tr key={i}><td>{it.no || i + 1}</td><td>{it.nama}</td><td>{it.satuan}</td><td className="r">{it.qty}</td><td>{it.tujuan}</td></tr>
                ))}
                {(pr.items ?? []).length === 0 && <tr><td colSpan={5} className="empty-mini">Tidak ada item.</td></tr>}
              </tbody>
            </table>
          </div>
          {pr.catatan && <div style={{ marginTop: 10, fontSize: 12.5 }}><b>Catatan:</b> {pr.catatan}</div>}
          {pr.status === "approved" && pr.approval?.approvedBy && (
            <div className="adm-ok" style={{ marginTop: 12 }}>Disetujui oleh {pr.approval.approvedBy} ({pr.approval.approvedByRole}) · {dateLabel(pr.approval.approvedAt)}{pr.approval.note ? ` — ${pr.approval.note}` : ""}</div>
          )}
          {pr.status === "rejected" && pr.approval?.rejectedBy && (
            <div className="adm-error" style={{ marginTop: 12 }}>Ditolak oleh {pr.approval.rejectedBy} ({pr.approval.rejectedByRole}){pr.approval.rejectNote ? ` — ${pr.approval.rejectNote}` : ""}</div>
          )}
          {error && <div className="mdf-error" style={{ margin: "12px 0 0" }}>{error}</div>}
        </div>
        <footer className="mdf-foot">
          {pr.status === "draft" && (
            <button className="md-btn danger" onClick={() => void del()} disabled={busy}>Hapus</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="md-btn" onClick={() => printPR(pr)}>🖨 Cetak</button>
          {pr.status === "draft" && (
            <button className="md-btn primary" onClick={() => void submit()} disabled={busy}>{busy ? "Mengajukan…" : "Ajukan Approval"}</button>
          )}
        </footer>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="pur-meta-r">
      <span className="pur-meta-l">{label}</span>
      <span className="pur-meta-v">{value || "—"}</span>
    </div>
  );
}
