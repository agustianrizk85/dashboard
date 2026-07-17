import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { purchasingApi } from "./client";
import type { PRItem, PRStatus, PurchaseRequest } from "./types";
import "./purchasing-widget.css";

/**
 * Cross-division Purchase Request widget. Fully self-contained (no required
 * props) — drop it into any division dashboard. Duplicated on purpose from
 * `src/modules/keuangan/purchasing/ApprovalView.tsx`'s tiny helper to keep
 * this module independent (do NOT import keuangan's internals).
 */
function canApprovePR(role: string): boolean {
  return ["kadep", "dirops", "ceo", "super"].includes(role);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const STATUS_LABEL: Record<PRStatus, string> = {
  draft: "Draft",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function StatusPill({ status }: { status: PRStatus }) {
  return <span className={`pw-pill pw-pill-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: PurchaseRequest[] };

export function PurchasingInbox() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    try {
      const rows = await purchasingApi.list();
      setState({ status: "ready", data: Array.isArray(rows) ? rows : [] });
    } catch (e) {
      setState({ status: "error", error: errMsg(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const division = user?.division ?? "";
  const role = user?.role ?? "";
  const canApprove = canApprovePR(role);

  if (state.status === "loading") {
    return (
      <div className="pw-scope">
        <div className="pw-loading">Memuat…</div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="pw-scope">
        <div className="pw-error-box">
          <div>{state.error}</div>
          <button className="pw-btn" onClick={() => void load()}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const all = state.data;
  const divisionPRs = all.filter((pr) => pr.dept === division).slice().reverse();
  let approvalPRs: PurchaseRequest[] = [];
  if (canApprove) {
    approvalPRs =
      role === "kadep"
        ? all.filter((pr) => pr.status === "pending" && pr.dept === division)
        : all.filter((pr) => pr.status === "pending");
  }

  return (
    <div className="pw-scope">
      <section className="pw-panel">
        <div className="pw-panel-head">
          <h3 className="pw-title">Pembelian Divisi Saya</h3>
          <button className="pw-btn pw-btn-primary" onClick={() => setFormOpen(true)}>
            + Ajukan PR
          </button>
        </div>
        {divisionPRs.length === 0 ? (
          <div className="pw-empty">Belum ada pengajuan pembelian dari divisi ini.</div>
        ) : (
          <div className="pw-tablewrap">
            <table className="pw-table">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Pemohon</th>
                  <th>Proyek</th>
                  <th>Tanggal</th>
                  <th>Item</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {divisionPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <b>{pr.nomor || "(draft)"}</b>
                    </td>
                    <td>{pr.requestBy || "—"}</td>
                    <td>{pr.proyek || "—"}</td>
                    <td>{pr.requestDate || "—"}</td>
                    <td>{(pr.items ?? []).length}</td>
                    <td>
                      <StatusPill status={pr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canApprove && (
        <section className="pw-panel">
          <div className="pw-panel-head">
            <h3 className="pw-title">Menunggu Approval Anda</h3>
          </div>
          {approvalPRs.length === 0 ? (
            <div className="pw-empty">Tidak ada PR menunggu approval Anda. ✓</div>
          ) : (
            <div className="pw-cards">
              {approvalPRs.map((pr) => (
                <ApprovalCard key={pr.id} pr={pr} onDone={() => void load()} />
              ))}
            </div>
          )}
        </section>
      )}

      {formOpen && (
        <CreatePRForm
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ApprovalCard({ pr, onDone }: { pr: PurchaseRequest; onDone: () => void }) {
  const { user } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) {
      setRejecting(true);
      return;
    }
    setBusy(true);
    setErr("");
    const body = {
      approver: { name: user?.name ?? "", role: user?.role ?? "", dept: user?.division ?? "" },
      note: note.trim(),
    };
    try {
      if (approve) await purchasingApi.approve(pr.id, body);
      else await purchasingApi.reject(pr.id, body);
      onDone();
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="pw-card">
      <div className="pw-card-head">
        <b>{pr.nomor || "(draft)"}</b>
      </div>
      <div className="pw-card-line">
        {pr.requestBy || "—"} · {pr.dept || "—"}
      </div>
      <div className="pw-card-line">
        {pr.proyek || "—"} · {(pr.items ?? []).length} item
      </div>
      {rejecting && (
        <textarea
          className="pw-textarea"
          rows={2}
          placeholder="Alasan penolakan (wajib)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      {err && <div className="pw-error-inline">{err}</div>}
      <div className="pw-card-actions">
        <button className="pw-btn pw-btn-danger" disabled={busy} onClick={() => void decide(false)}>
          Tolak
        </button>
        <button className="pw-btn pw-btn-primary" disabled={busy} onClick={() => void decide(true)}>
          {busy ? "…" : "Setujui"}
        </button>
      </div>
    </div>
  );
}

const emptyItem = (): PRItem => ({ no: 1, nama: "", satuan: "", qty: 1, tujuan: "" });

function CreatePRForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [requestBy, setRequestBy] = useState(user?.name ?? "");
  const [proyek, setProyek] = useState("");
  const [requestDate, setRequestDate] = useState(todayISO());
  const [dateRequired, setDateRequired] = useState("");
  const [items, setItems] = useState<PRItem[]>([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setItemField = (i: number, k: "nama" | "qty" | "tujuan", v: string) =>
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: k === "qty" ? Number(v) : v } : r)));
  const addItem = () => setItems((rows) => [...rows, emptyItem()]);
  const removeItem = (i: number) =>
    setItems((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : rows));

  const save = async () => {
    if (!requestBy.trim()) {
      setError("Nama pemohon wajib diisi.");
      return;
    }
    const cleanItems = items.filter((it) => it.nama.trim()).map((it, k) => ({ ...it, no: k + 1 }));
    if (cleanItems.length === 0) {
      setError("Tambahkan minimal satu item.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await purchasingApi.create({
        requestBy: requestBy.trim(),
        dept: user?.division ?? "",
        proyek,
        requestDate,
        dateRequired,
        diajukanOleh: user?.name ?? "",
        items: cleanItems,
        submit: true,
      });
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pw-overlay" onClick={onClose}>
      <div className="pw-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pw-modal-head">
          <h3>Ajukan Purchase Request</h3>
          <button type="button" className="pw-modal-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="pw-modal-body">
          <label className="pw-field">
            <span>Karyawan / Pemohon *</span>
            <input value={requestBy} onChange={(e) => setRequestBy(e.target.value)} />
          </label>
          <label className="pw-field">
            <span>Proyek</span>
            <input value={proyek} onChange={(e) => setProyek(e.target.value)} />
          </label>
          <label className="pw-field">
            <span>Tanggal Order</span>
            <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
          </label>
          <label className="pw-field">
            <span>Perkiraan Material Sampai</span>
            <input type="date" value={dateRequired} onChange={(e) => setDateRequired(e.target.value)} />
          </label>

          <div className="pw-field pw-field-wide">
            <span>Item Permintaan</span>
            <div className="pw-items">
              <div className="pw-items-head">
                <span className="pw-items-no">No</span>
                <span>Nama Barang</span>
                <span className="pw-items-qty">Qty</span>
                <span>Keperluan</span>
                <span className="pw-items-x" />
              </div>
              {items.map((it, i) => (
                <div className="pw-items-row" key={i}>
                  <span className="pw-items-no">{i + 1}</span>
                  <input
                    value={it.nama}
                    placeholder="Nama barang"
                    onChange={(e) => setItemField(i, "nama", e.target.value)}
                  />
                  <input
                    className="pw-items-qty"
                    type="number"
                    value={it.qty}
                    onChange={(e) => setItemField(i, "qty", e.target.value)}
                  />
                  <input
                    value={it.tujuan}
                    placeholder="Keperluan"
                    onChange={(e) => setItemField(i, "tujuan", e.target.value)}
                  />
                  <button
                    type="button"
                    className="pw-items-remove"
                    disabled={items.length <= 1}
                    onClick={() => removeItem(i)}
                    title="Hapus item"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="pw-btn pw-btn-ghost pw-items-add" onClick={addItem}>
                + Tambah Item
              </button>
            </div>
          </div>
        </div>
        {error && <div className="pw-error-inline pw-modal-error">{error}</div>}
        <footer className="pw-modal-foot">
          <button type="button" className="pw-btn" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="pw-btn pw-btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Mengajukan…" : "Ajukan"}
          </button>
        </footer>
      </div>
    </div>
  );
}
