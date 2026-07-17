import { useCallback, useEffect, useState } from "react";
import type { PurchaseOrder, PurchaseRequest } from "../types";
import { useAuth } from "@/auth/AuthContext";
import { api } from "../api/client";
import { Panel } from "../components/ui";
import { withAuth, errMsg, type LoadState } from "./data";
import { dateLabel, rpFull, tierLabel } from "./format";
import { TierBadge } from "./POView";

/** Mirror the backend tier-vs-role rule so buttons only enable when allowed. */
function canApprovePR(role: string): boolean {
  return ["kadep", "dirops", "ceo", "super"].includes(role);
}
function canApprovePO(tier: string, role: string): boolean {
  if (tier === "kadep") return ["kadep", "dirops", "ceo", "super"].includes(role);
  if (tier === "dirops") return ["dirops", "ceo", "super"].includes(role);
  return false; // tanpaPo — auto-approved, no manual approval
}

interface Both {
  prs: PurchaseRequest[];
  pos: PurchaseOrder[];
}

export function ApprovalView() {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const approverName = user?.name ?? "—";
  const [state, setState] = useState<LoadState<Both>>({ status: "loading", data: null, error: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    try {
      const [prs, pos] = await withAuth(() => Promise.all([api.prList("pending"), api.poList("pending")]));
      setState({ status: "ready", data: { prs: prs ?? [], pos: pos ?? [] }, error: "" });
    } catch (e) {
      setState({ status: "error", data: null, error: errMsg(e) });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (state.status === "loading") {
    return <div className="splash"><div className="spinner" />Memuat antrean approval…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="splash error">
        <div className="splash-title">Gagal memuat approval</div>
        <div className="splash-msg">{state.error}</div>
        <button className="splash-btn" onClick={() => void load()}>Coba lagi</button>
      </div>
    );
  }

  const { prs, pos } = state.data;

  const decidePR = async (pr: PurchaseRequest, approve: boolean, note: string) => {
    const body = { approver: { name: approverName, role }, note };
    await withAuth(() => (approve ? api.prApprove(pr.id, body) : api.prReject(pr.id, body)));
    setMsg(`PR ${pr.nomor || pr.id} ${approve ? "disetujui" : "ditolak"}.`);
    void load();
  };
  const decidePO = async (po: PurchaseOrder, approve: boolean, note: string) => {
    const body = { approver: { name: approverName, role }, note };
    await withAuth(() => (approve ? api.poApprove(po.id, body) : api.poReject(po.id, body)));
    setMsg(`PO ${po.nomor || po.id} ${approve ? "disetujui" : "ditolak"}.`);
    void load();
  };

  return (
    <div className="body">
      {msg && <div className="adm-ok" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="pur-approve-grid">
        <Panel tag="PR" title="PR Menunggu Approval" sub={`${prs.length} PR`}>
          {prs.length === 0 ? (
            <div className="empty-mini" style={{ padding: 30 }}>Tidak ada PR menunggu. ✓</div>
          ) : (
            <div className="pur-cards">
              {prs.map((pr) => (
                <ApprovalCard
                  key={pr.id}
                  title={pr.nomor || "(draft)"}
                  lines={[
                    `${pr.requestBy || "—"} · ${pr.dept || "—"}`,
                    `${pr.proyek || "—"} · ${dateLabel(pr.requestDate)}`,
                    `${(pr.items ?? []).length} item`,
                  ]}
                  allowed={canApprovePR(role)}
                  onDecide={(ok, note) => decidePR(pr, ok, note)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel tag="PO" title="PO Menunggu Approval" sub={`${pos.length} PO`}>
          {pos.length === 0 ? (
            <div className="empty-mini" style={{ padding: 30 }}>Tidak ada PO menunggu. ✓</div>
          ) : (
            <div className="pur-cards">
              {pos.map((po) => (
                <ApprovalCard
                  key={po.id}
                  title={po.nomor || "(draft)"}
                  badge={<TierBadge tier={po.tier} />}
                  lines={[
                    `${po.supplier || "—"} · ${po.prNomor || "—"}`,
                    `Total ${rpFull(po.total)}`,
                    tierLabel(po.tier),
                  ]}
                  allowed={canApprovePO(po.tier, role)}
                  onDecide={(ok, note) => decidePO(po, ok, note)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ApprovalCard({
  title,
  badge,
  lines,
  allowed,
  onDecide,
}: {
  title: string;
  badge?: React.ReactNode;
  lines: string[];
  allowed: boolean;
  onDecide: (approve: boolean, note: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async (approve: boolean) => {
    if (!approve && !note.trim()) { setRejecting(true); return; }
    setBusy(true);
    setErr("");
    try {
      await onDecide(approve, note.trim());
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="pur-card">
      <div className="pur-card-h">
        <b>{title}</b>
        {badge}
      </div>
      {lines.map((l, i) => (
        <div key={i} className="pur-card-l">{l}</div>
      ))}
      {rejecting && (
        <textarea className="pur-card-note" rows={2} placeholder="Alasan penolakan (wajib)…" value={note} onChange={(e) => setNote(e.target.value)} />
      )}
      {err && <div className="mdf-error" style={{ margin: "6px 0 0" }}>{err}</div>}
      <div className="pur-card-actions">
        {allowed ? (
          <>
            <button className="md-btn danger" disabled={busy} onClick={() => void run(false)}>Tolak</button>
            <button className="md-btn primary" disabled={busy} onClick={() => void run(true)}>{busy ? "…" : "Setujui"}</button>
          </>
        ) : (
          <span className="pur-review-only">Tinjau saja (bukan approver tier ini)</span>
        )}
      </div>
    </div>
  );
}
