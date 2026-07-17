import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import type { POItem, POStatus, POTier, Produk, PurchaseOrder, PurchaseRequest } from "../types";
import type { Tone } from "../types";
import { api } from "../api/client";
import { Panel, Pill } from "../components/ui";
import { withAuth, errMsg, type LoadState } from "./data";
import { computePoTotals, dateLabel, rpFull, terbilang, tierLabel, todayISO } from "./format";
import { printPO } from "./print";

const STATUS_TONE: Record<POStatus, Tone> = {
  draft: "neutral",
  pending: "yellow",
  approved: "green",
  rejected: "red",
  received: "navy",
  completed: "green",
};
const STATUS_LABEL: Record<POStatus, string> = {
  draft: "Draft",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  received: "Diterima",
  completed: "Selesai",
};

export function PoStatusPill({ status }: { status: POStatus }) {
  return <Pill tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Pill>;
}

const TIER_TONE: Record<POTier, Tone> = { none: "neutral", kadep: "orange", dirops: "crisis" };
export function TierBadge({ tier }: { tier: POTier }) {
  const label = tier === "none" ? "Tanpa PO" : tier === "kadep" ? "Kadep" : "Dirops";
  return <Pill tone={TIER_TONE[tier] ?? "neutral"} dot={false}>{label}</Pill>;
}

/** "Purchaser tunggu Approve oleh Kepala divisi atau dirops untuk melakukan PR,
 *  Setelah disetujui pengajuan PR maka, pengajuan akan dibuatkan PO oleh divisi
 *  Purchasing" — creating a PO is a Purchasing-division action. Kadep / Dirops /
 *  CEO still see the PO list/detail (read) and approve per tier (ApprovalView's
 *  canApprovePO), they just don't get the "Buat PO" button/form. Mirrors the
 *  role-list style of canApprovePR / canApprovePO in ApprovalView.tsx.       */
function canCreatePO(role: string): boolean {
  return ["purchasing", "admin", "super"].includes(role);
}

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "received", label: "Diterima" },
  { key: "rejected", label: "Ditolak" },
];

export function POView() {
  const { user } = useAuth();
  const canCreate = canCreatePO(user?.role ?? "viewer");
  const [state, setState] = useState<LoadState<PurchaseOrder[]>>({ status: "loading", data: null, error: "" });
  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [openPrId, setOpenPrId] = useState<string | undefined>(undefined);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);

  // "PR Masuk" inbox — PR sudah disetujui kadep/dirops tapi BELUM punya PO.
  // Purchasing sebelumnya harus menemukan PR ini terkubur di dropdown form
  // "Buat PO"; sekarang tampil sebagai antrean di atas daftar PO.
  const [inbox, setInbox] = useState<PurchaseRequest[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const [prs, pos] = await withAuth(() => Promise.all([api.prList("approved"), api.poList()]));
      const used = new Set((Array.isArray(pos) ? pos : []).filter((po) => po.status !== "rejected").map((po) => po.prId));
      setInbox((Array.isArray(prs) ? prs : []).filter((pr) => !used.has(pr.id)));
    } catch {
      setInbox([]);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    try {
      const rows = await withAuth(() => api.poList(filter || undefined));
      setState({ status: "ready", data: Array.isArray(rows) ? rows : [], error: "" });
    } catch (e) {
      setState({ status: "error", data: null, error: errMsg(e) });
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadInbox(); }, [loadInbox]);

  const openForPr = (prId: string) => {
    setOpenPrId(prId);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setOpenPrId(undefined);
  };
  const savedForm = () => {
    closeForm();
    void load();
    void loadInbox();
  };

  if (state.status === "loading") {
    return <div className="splash"><div className="spinner" />Memuat Purchase Order…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="splash error">
        <div className="splash-title">Gagal memuat PO</div>
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
            <button key={f.key} className={`pur-chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {canCreate && <button className="adm-btn primary" onClick={() => openForPr("")}>＋ Buat PO</button>}
      </div>

      <Panel tag="INBOX" title="PR Masuk — Menunggu PO" sub={`${inbox.length} PR`}>
        {inboxLoading ? (
          <div className="empty-mini" style={{ padding: 24 }}>Memuat…</div>
        ) : inbox.length === 0 ? (
          <div className="empty-mini" style={{ padding: 24 }}>Tidak ada PR menunggu diproses. ✓</div>
        ) : (
          <div className="pur-cards">
            {inbox.map((pr) => (
              <div className="pur-card" key={pr.id}>
                <div className="pur-card-h"><b>{pr.nomor || pr.id}</b></div>
                <div className="pur-card-l">{pr.requestBy || "—"} · {pr.proyek || "—"}</div>
                <div className="pur-card-l">{dateLabel(pr.requestDate)} · {(pr.items ?? []).length} item</div>
                <div className="pur-card-actions">
                  {canCreate ? (
                    <button className="md-btn primary" onClick={() => openForPr(pr.id)}>Buat PO →</button>
                  ) : (
                    <span className="pur-review-only">Menunggu diproses Purchasing</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel tag="PURCHASE ORDER" title="Daftar Pesanan Pembelian" sub={`${rows.length} PO`}>
        {rows.length === 0 ? (
          <div className="empty-mini" style={{ padding: 40 }}>
            {canCreate
              ? <>Belum ada Purchase Order. Pilih PR yang sudah disetujui lalu klik <b>Buat PO</b>.</>
              : "Belum ada Purchase Order."}
          </div>
        ) : (
          <div className="ar-tablewrap">
            <table className="ar-table">
              <thead>
                <tr><th>Nomor</th><th>Ref PR</th><th>Tanggal</th><th>Supplier</th><th className="r">Total</th><th>Tier</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((po) => (
                  <tr key={po.id} className="pur-row" onClick={() => setDetail(po)}>
                    <td><b>{po.nomor || "(draft)"}</b></td>
                    <td>{po.prNomor || "—"}</td>
                    <td>{dateLabel(po.tanggal)}</td>
                    <td>{po.supplier || "—"}</td>
                    <td className="r">{rpFull(po.total)}</td>
                    <td><TierBadge tier={po.tier} /></td>
                    <td><PoStatusPill status={po.status} /></td>
                    <td className="r"><span className="pur-link">Detail →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {formOpen && canCreate && <POForm initialPrId={openPrId} onClose={closeForm} onSaved={savedForm} />}
      {detail && <PODetail po={detail} onClose={() => setDetail(null)} onChanged={(u) => { setDetail(u); void load(); }} onDeleted={() => { setDetail(null); void load(); }} />}
    </div>
  );
}

/* ── Create form ──────────────────────────────────────────────────────────── */

/** PO line row plus a client-only `produkId` link to the Produk master.
 *  The extra field is harmless on the wire (backend ignores unknown JSON). */
type PORow = POItem & { produkId?: string };

function POForm({ initialPrId, onClose, onSaved }: { initialPrId?: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [prs, setPrs] = useState<PurchaseRequest[]>([]);
  const [prId, setPrId] = useState("");
  const [items, setItems] = useState<PORow[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  // PR ids that already have a PO on them (any status but rejected — a rejected
  // PO leaves its PR free to be re-quoted). Prevents accidentally creating a
  // second PO off the same PR.
  const [usedPrIds, setUsedPrIds] = useState<Set<string>>(new Set());
  const [h, setH] = useState({
    supplier: "", alamatPengiriman: "", pic: "", proyek: "", prNomor: "",
    tanggal: todayISO(), tanggalPengiriman: "", syaratPembayaran: "Tempo", purchaser: user?.name ?? "",
    catatan: "", disiapkanOleh: user?.name ?? "", diketahuiOleh: "", disetujuiOleh: "",
  });
  const [potongan, setPotongan] = useState(0);
  const [biayaPengiriman, setBiaya] = useState(0);
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [error, setError] = useState("");

  useEffect(() => {
    withAuth(() => api.prList("approved")).then((d) => setPrs(Array.isArray(d) ? d : [])).catch(() => setPrs([]));
  }, []);

  // Opened from the "PR Masuk" inbox with a specific PR already chosen — once
  // the approved-PR list has loaded, pre-select it (only once).
  useEffect(() => {
    if (initialPrId && prs.length > 0) pickPR(initialPrId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrId, prs]);

  useEffect(() => {
    withAuth(() => api.poList())
      .then((d) => setUsedPrIds(new Set((Array.isArray(d) ? d : []).filter((po) => po.status !== "rejected").map((po) => po.prId))))
      .catch(() => setUsedPrIds(new Set()));
  }, []);

  useEffect(() => {
    withAuth(() => api.produk()).then((d) => setProdukList(Array.isArray(d) ? d : [])).catch(() => setProdukList([]));
  }, []);

  const pickPR = (id: string) => {
    setPrId(id);
    const pr = prs.find((p) => p.id === id);
    if (!pr) { setItems([]); return; }
    setItems((pr.items ?? []).map((it, k) => ({ no: k + 1, nama: it.nama, satuan: it.satuan, qty: it.qty, hargaSatuan: 0, jumlah: 0 })));
    setH((s) => ({ ...s, supplier: pr.supplier || s.supplier, alamatPengiriman: pr.alamatPengiriman || s.alamatPengiriman, pic: pr.pic || s.pic, proyek: pr.proyek || s.proyek, prNomor: pr.nomor }));
  };

  const setField = (k: keyof typeof h, v: string) => setH((s) => ({ ...s, [k]: v }));
  const setItem = (i: number, k: keyof POItem, v: string) =>
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: k === "qty" || k === "hargaSatuan" ? Number(v) : v } : r)));

  // Pick a product from the master for a row: auto-fill nama / satuan / harga
  // and remember the produkId so we can honour its negotiable lock. Empty value
  // just clears the link (row keeps its current free-text name / editable price).
  const selectProduk = (i: number, produkId: string) => {
    const p = produkList.find((x) => x.id === produkId);
    setItems((rows) =>
      rows.map((r, j) => {
        if (j !== i) return r;
        if (!p) return { ...r, produkId: "" };
        return { ...r, produkId: p.id, nama: p.nama, satuan: p.satuan, hargaSatuan: p.harga };
      }),
    );
  };

  const preview = useMemo(() => computePoTotals(items, potongan, biayaPengiriman), [items, potongan, biayaPengiriman]);

  const save = async (submit: boolean) => {
    if (!prId) { setError("Pilih PR yang sudah disetujui dulu."); return; }
    if (items.length === 0) { setError("PR tidak memiliki item."); return; }
    setBusy(submit ? "submit" : "draft");
    setError("");
    try {
      await withAuth(() =>
        api.poCreate({
          prId,
          prNomor: h.prNomor,
          supplier: h.supplier,
          alamatPengiriman: h.alamatPengiriman,
          pic: h.pic,
          proyek: h.proyek,
          tanggal: h.tanggal,
          tanggalPengiriman: h.tanggalPengiriman,
          syaratPembayaran: h.syaratPembayaran,
          caraBayar: h.syaratPembayaran,
          purchaser: h.purchaser,
          items: preview.rows,
          potongan,
          biayaPengiriman,
          catatan: h.catatan,
          disiapkanOleh: h.disiapkanOleh || h.purchaser,
          diketahuiOleh: h.diketahuiOleh,
          disetujuiOleh: h.disetujuiOleh,
          submit,
        }),
      );
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
          <h3>Buat Purchase Order</h3>
          <button type="button" className="mdf-close" onClick={onClose}>×</button>
        </header>
        <div className="mdf-body">
          <label className="mdf-field wide">
            <span className="mdf-label">Purchase Request (disetujui) *</span>
            <select value={prId} onChange={(e) => pickPR(e.target.value)}>
              <option value="">— pilih PR disetujui —</option>
              {prs.filter((p) => !usedPrIds.has(p.id) || p.id === prId).map((p) => (
                <option key={p.id} value={p.id}>{p.nomor || p.id} · {p.requestBy} · {p.proyek}</option>
              ))}
            </select>
            {prs.some((p) => usedPrIds.has(p.id)) && (
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>PR yang sudah punya PO disembunyikan dari daftar.</span>
            )}
          </label>

          <F label="Supplier"><input value={h.supplier} onChange={(e) => setField("supplier", e.target.value)} /></F>
          <F label="Purchaser"><input value={h.purchaser} onChange={(e) => setField("purchaser", e.target.value)} /></F>
          <F label="Tanggal"><input type="date" value={h.tanggal} onChange={(e) => setField("tanggal", e.target.value)} /></F>
          <F label="Tanggal Pengiriman"><input type="date" value={h.tanggalPengiriman} onChange={(e) => setField("tanggalPengiriman", e.target.value)} /></F>
          <F label="Syarat Pembayaran">
            <select value={h.syaratPembayaran} onChange={(e) => setField("syaratPembayaran", e.target.value)}>
              <option value="Tempo">Tempo</option>
              <option value="Cash">Cash</option>
            </select>
          </F>
          <F label="PIC"><input value={h.pic} onChange={(e) => setField("pic", e.target.value)} /></F>
          <F label="Disiapkan oleh (Staff Purchasing)"><input value={h.disiapkanOleh} onChange={(e) => setField("disiapkanOleh", e.target.value)} /></F>
          <F label="Diketahui oleh (KADEP)"><input value={h.diketahuiOleh} onChange={(e) => setField("diketahuiOleh", e.target.value)} /></F>
          <F label="Disetujui oleh (Dirops/CEO)"><input value={h.disetujuiOleh} onChange={(e) => setField("disetujuiOleh", e.target.value)} /></F>
          <F label="Alamat Pengiriman" wide><textarea rows={2} value={h.alamatPengiriman} onChange={(e) => setField("alamatPengiriman", e.target.value)} /></F>

          <div className="mdf-field wide">
            <span className="mdf-label">Item & Harga</span>
            {items.length === 0 ? (
              <div className="empty-mini">Pilih PR untuk memuat item.</div>
            ) : (
              <div className="pur-items po">
                <div className="pur-items-h po">
                  <span className="c">No</span><span>Produk / Nama</span><span>Satuan</span><span className="q">Qty</span><span className="q">Harga Satuan</span><span className="q">Jumlah</span>
                </div>
                {items.map((it, i) => {
                  const prod = it.produkId ? produkList.find((p) => p.id === it.produkId) : undefined;
                  const locked = prod ? !prod.negotiable : false;
                  const jumlah = Math.round((Number(it.qty) || 0) * (Number(it.hargaSatuan) || 0));
                  return (
                    <div className="pur-items-r po" key={i}>
                      <span className="c">{i + 1}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <select value={it.produkId ?? ""} onChange={(e) => selectProduk(i, e.target.value)}>
                          <option value="">— pilih produk —</option>
                          {produkList.map((p) => (
                            <option key={p.id} value={p.id}>{p.nama}{p.vendorNama ? ` · ${p.vendorNama}` : ""}</option>
                          ))}
                        </select>
                        <input value={it.nama} placeholder="Nama barang" onChange={(e) => setItem(i, "nama", e.target.value)} />
                      </div>
                      <input value={it.satuan} onChange={(e) => setItem(i, "satuan", e.target.value)} />
                      <input className="q" type="number" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                      <input
                        className="q"
                        type="number"
                        value={it.hargaSatuan}
                        disabled={locked}
                        title={locked ? "Harga terkunci — produk tidak dapat dinego" : undefined}
                        onChange={(e) => setItem(i, "hargaSatuan", e.target.value)}
                      />
                      <span className="q jml">{rpFull(jumlah)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <F label="Potongan (Rp)"><input type="number" value={potongan} onChange={(e) => setPotongan(Number(e.target.value))} /></F>
          <F label="Biaya Pengiriman (Rp)"><input type="number" value={biayaPengiriman} onChange={(e) => setBiaya(Number(e.target.value))} /></F>
          <F label="Catatan" wide><textarea rows={2} value={h.catatan} onChange={(e) => setField("catatan", e.target.value)} /></F>

          <div className="mdf-field wide">
            <div className="pur-preview">
              <div className="pur-preview-r"><span>Sub Total</span><b>{rpFull(preview.subTotal)}</b></div>
              <div className="pur-preview-r"><span>Potongan</span><b>− {rpFull(potongan)}</b></div>
              <div className="pur-preview-r"><span>Biaya Pengiriman</span><b>+ {rpFull(biayaPengiriman)}</b></div>
              <div className="pur-preview-r grand"><span>Total</span><b>{rpFull(preview.total)}</b></div>
              <div className="pur-preview-r"><span>Terbilang</span><i>{terbilang(preview.total)}</i></div>
              <div className="pur-preview-r"><span>Klasifikasi</span><TierBadge tier={preview.tier} /> <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{tierLabel(preview.tier)}</span></div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>* Total & tier dihitung ulang oleh server saat disimpan (server yang otoritatif).</div>
          </div>
        </div>
        {error && <div className="mdf-error">{error}</div>}
        <footer className="mdf-foot">
          <button type="button" className="md-btn" onClick={onClose}>Batal</button>
          <button type="button" className="md-btn" disabled={busy !== ""} onClick={() => void save(false)}>{busy === "draft" ? "Menyimpan…" : "Simpan Draft"}</button>
          <button type="button" className="md-btn primary" disabled={busy !== ""} onClick={() => void save(true)}>{busy === "submit" ? "Mengajukan…" : "Simpan & Ajukan"}</button>
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

function PODetail({ po, onClose, onChanged, onDeleted }: { po: PurchaseOrder; onClose: () => void; onChanged: (p: PurchaseOrder) => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recvOpen, setRecvOpen] = useState(false);
  const [recv, setRecv] = useState({ tanggalDiterima: todayISO(), bastSigned: true, keterangan: "" });

  const act = async (fn: () => Promise<PurchaseOrder>) => {
    setBusy(true);
    setError("");
    try {
      onChanged(await fn());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!window.confirm("Hapus PO ini?")) return;
    setBusy(true);
    setError("");
    try {
      await withAuth(() => api.poDelete(po.id));
      onDeleted();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };
  const doReceive = () =>
    act(() => withAuth(() => api.poReceive(po.id, recv))).then(() => setRecvOpen(false));

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <div className="mdf-card wide-card" onClick={(e) => e.stopPropagation()}>
        <header className="mdf-head">
          <h3>PO {po.nomor || "(draft)"} · <PoStatusPill status={po.status} /> <TierBadge tier={po.tier} /></h3>
          <button type="button" className="mdf-close" onClick={onClose}>×</button>
        </header>
        <div className="mdf-body" style={{ display: "block" }}>
          <div className="pur-meta">
            <MetaRow label="Ref PR" value={po.prNomor} />
            <MetaRow label="Tanggal" value={dateLabel(po.tanggal)} />
            <MetaRow label="Tanggal Pengiriman" value={dateLabel(po.tanggalPengiriman)} />
            <MetaRow label="Syarat Pembayaran" value={po.syaratPembayaran || po.caraBayar} />
            <MetaRow label="Supplier" value={po.supplier} />
            <MetaRow label="Purchaser" value={po.purchaser} />
            <MetaRow label="PIC" value={po.pic} />
            <MetaRow label="Alamat" value={po.alamatPengiriman} />
          </div>
          <div className="ar-tablewrap" style={{ marginTop: 10 }}>
            <table className="ar-table">
              <thead><tr><th>No</th><th>Nama</th><th>Satuan</th><th className="r">Qty</th><th className="r">Harga Satuan</th><th className="r">Jumlah</th></tr></thead>
              <tbody>
                {(po.items ?? []).map((it, i) => (
                  <tr key={i}><td>{it.no || i + 1}</td><td>{it.nama}</td><td>{it.satuan}</td><td className="r">{it.qty}</td><td className="r">{rpFull(it.hargaSatuan)}</td><td className="r">{rpFull(it.jumlah)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pur-preview" style={{ marginTop: 10, marginLeft: "auto", maxWidth: 320 }}>
            <div className="pur-preview-r"><span>Sub Total</span><b>{rpFull(po.subTotal)}</b></div>
            <div className="pur-preview-r"><span>Potongan</span><b>− {rpFull(po.potongan)}</b></div>
            <div className="pur-preview-r"><span>Biaya Pengiriman</span><b>+ {rpFull(po.biayaPengiriman)}</b></div>
            <div className="pur-preview-r grand"><span>Total</span><b>{rpFull(po.total)}</b></div>
            <div className="pur-preview-r"><span>Terbilang</span><i>{po.terbilang || terbilang(po.total)}</i></div>
          </div>

          {po.status === "approved" && po.approval?.approvedBy && (
            <div className="adm-ok" style={{ marginTop: 12 }}>Disetujui oleh {po.approval.approvedBy} ({po.approval.approvedByRole}) · {dateLabel(po.approval.approvedAt)}{po.approval.note ? ` — ${po.approval.note}` : ""}</div>
          )}
          {po.status === "rejected" && po.approval?.rejectedBy && (
            <div className="adm-error" style={{ marginTop: 12 }}>Ditolak oleh {po.approval.rejectedBy} ({po.approval.rejectedByRole}){po.approval.rejectNote ? ` — ${po.approval.rejectNote}` : ""}</div>
          )}
          {po.receiving?.received && (
            <div className="adm-ok" style={{ marginTop: 12 }}>
              Barang diterima {dateLabel(po.receiving.tanggalDiterima)} · BAST {po.receiving.bastSigned ? "✓ ditandatangani" : "belum"} · {po.receiving.keterangan || "—"} ({po.receiving.slaHari} hari)
            </div>
          )}

          {recvOpen && (
            <div className="pur-recv">
              <div className="pur-recv-h">Penerimaan Barang / BAST</div>
              <div className="pur-recv-grid">
                <label className="mdf-field"><span className="mdf-label">Tanggal Diterima</span>
                  <input type="date" value={recv.tanggalDiterima} onChange={(e) => setRecv((s) => ({ ...s, tanggalDiterima: e.target.value }))} /></label>
                <label className="mdf-field"><span className="mdf-label">Keterangan</span>
                  <select value={recv.keterangan} onChange={(e) => setRecv((s) => ({ ...s, keterangan: e.target.value }))}>
                    <option value="">Auto (dari tanggal pengiriman)</option>
                    <option value="Tepat Waktu">Tepat Waktu</option>
                    <option value="Terlambat">Terlambat</option>
                  </select></label>
                <label className="mdf-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={recv.bastSigned} onChange={(e) => setRecv((s) => ({ ...s, bastSigned: e.target.checked }))} />
                  <span className="mdf-label">BAST ditandatangani</span></label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="md-btn" onClick={() => setRecvOpen(false)} disabled={busy}>Batal</button>
                <button className="md-btn primary" onClick={() => void doReceive()} disabled={busy}>{busy ? "Menyimpan…" : "Simpan Penerimaan"}</button>
              </div>
            </div>
          )}

          {error && <div className="mdf-error" style={{ margin: "12px 0 0" }}>{error}</div>}
        </div>
        <footer className="mdf-foot">
          {po.status === "draft" && <button className="md-btn danger" onClick={() => void del()} disabled={busy}>Hapus</button>}
          <span style={{ flex: 1 }} />
          <button className="md-btn" onClick={() => printPO(po)}>🖨 Cetak</button>
          {po.status === "draft" && (
            <button className="md-btn primary" onClick={() => void act(() => withAuth(() => api.poSubmit(po.id)))} disabled={busy}>{busy ? "…" : "Ajukan Approval"}</button>
          )}
          {po.status === "approved" && !po.receiving?.received && !recvOpen && (
            <button className="md-btn primary" onClick={() => setRecvOpen(true)} disabled={busy}>Terima / BAST</button>
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
