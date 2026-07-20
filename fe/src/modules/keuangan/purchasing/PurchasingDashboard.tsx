import { useCallback, useEffect, useState } from "react";
import { useRealtimeSocket } from "@/lib/realtime";
import { api } from "../api/client";
import { withAuth, errMsg } from "./data";
import type { LoadState } from "./data";
import { rpFull } from "./format";
import type { PurchaseRequest, PurchaseOrder } from "../types";

interface PurData {
  prs: PurchaseRequest[];
  pos: PurchaseOrder[];
}

/**
 * Landing dashboard for the dedicated Purchasing account. Pure transactional
 * (PR/PO) KPIs — no akad/AR finance data. Uses the shared WMS card classes so it
 * sits inside the Ops-Console shell. Money is FULL Rupiah (rpFull).
 */
export function PurchasingDashboard({ onGoto }: { onGoto?: (tab: string) => void }) {
  const [state, setState] = useState<LoadState<PurData>>({ status: "loading", data: null, error: "" });

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    try {
      const data = await withAuth(async () => {
        const [prs, pos] = await Promise.all([api.prList(), api.poList()]);
        return { prs: prs ?? [], pos: pos ?? [] };
      });
      setState({ status: "ready", data, error: "" });
    } catch (e) {
      setState({ status: "error", data: null, error: errMsg(e) });
    }
  }, []);

  useEffect(() => void load(), [load]);
  useRealtimeSocket(api.realtimeURL(), () => void load());

  if (state.status === "loading") return <div className="kwms wms-empty">Memuat data purchasing…</div>;
  if (state.status === "error") {
    return (
      <div className="kwms">
        <div className="wms-card wms-col-12">
          <div className="wms-card-h"><h3>Gagal memuat data purchasing</h3></div>
          <div className="wms-note">{state.error}</div>
          <div className="wms-note small">API: {api.base}</div>
          <button className="wms-btn" style={{ marginTop: 10 }} onClick={() => void load()}>Coba lagi</button>
        </div>
      </div>
    );
  }

  const { prs, pos } = state.data;
  const prPending = prs.filter((p) => p.status === "pending");
  const poPending = pos.filter((p) => p.status === "pending");
  const activePo = pos.filter((p) => p.status !== "rejected");
  const nilaiPo = activePo.reduce((a, p) => a + (Number(p.total) || 0), 0);
  const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
  const nilaiBulanIni = activePo.filter((p) => (p.tanggal || "").slice(0, 7) === ym).reduce((a, p) => a + (Number(p.total) || 0), 0);
  const received = pos.filter((p) => p.receiving?.received);
  const tepat = received.filter((p) => p.receiving?.keterangan === "Tepat Waktu").length;
  const slaPct = received.length ? Math.round((tepat / received.length) * 100) : 0;

  const recentPo = [...pos].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6);

  return (
    <div className="kwms">
      <div style={{ fontSize: 12, color: "var(--wms-muted)", margin: "0 0 12px" }}>
        Purchasing · {prs.length} PR · {pos.length} PO
      </div>

      <div className="wms-grid">
        <div className="wms-card wms-col-12">
          <div className="wms-card-h"><h3>Ringkasan Purchasing</h3></div>
          <div className="kwms-tiles">
            <div className={"kwms-tile" + (prPending.length ? " warn" : "")}>
              <div className="t-label">PR Menunggu</div>
              <div className="t-val">{prPending.length}</div>
            </div>
            <div className={"kwms-tile" + (poPending.length ? " warn" : "")}>
              <div className="t-label">PO Menunggu</div>
              <div className="t-val">{poPending.length}</div>
            </div>
            <div className="kwms-tile">
              <div className="t-label">Nilai PO (total)</div>
              <div className="t-val">{rpFull(nilaiPo)}</div>
            </div>
            <div className="kwms-tile">
              <div className="t-label">Nilai PO bulan ini</div>
              <div className="t-val">{rpFull(nilaiBulanIni)}</div>
            </div>
            <div className={"kwms-tile " + (slaPct >= 80 ? "ok" : "bad")}>
              <div className="t-label">SLA Tepat Waktu</div>
              <div className="t-val">{received.length ? slaPct + "%" : "—"}</div>
            </div>
          </div>
        </div>

        <div className="wms-card wms-col-6">
          <div className="wms-card-h">
            <h3>PR Menunggu Approval</h3>
            <button className="kwms-cap" style={{ cursor: "pointer", background: "none", border: 0 }} onClick={() => onGoto?.("approval")}>
              lihat semua →
            </button>
          </div>
          {prPending.length === 0 ? (
            <div className="wms-empty">Tidak ada PR menunggu.</div>
          ) : (
            <div className="kwms-list">
              {prPending.slice(0, 6).map((p, i) => (
                <button className="kwms-li" key={p.id} onClick={() => onGoto?.("approval")} type="button" style={{ cursor: "pointer", textAlign: "left", background: "none", border: 0, width: "100%" }}>
                  <span className="kwms-li-rank">{i + 1}</span>
                  <div className="kwms-li-main">
                    <span className="kwms-li-name">{p.nomor || p.id}</span>
                    <span className="kwms-li-sub">{p.requestBy || "—"} · {p.proyek || "—"}</span>
                  </div>
                  <span className="wms-badge warn">pending</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="wms-card wms-col-6">
          <div className="wms-card-h">
            <h3>PO Terbaru</h3>
            <button className="kwms-cap" style={{ cursor: "pointer", background: "none", border: 0 }} onClick={() => onGoto?.("po")}>
              lihat semua →
            </button>
          </div>
          {recentPo.length === 0 ? (
            <div className="wms-empty">Belum ada PO.</div>
          ) : (
            <div className="kwms-list">
              {recentPo.map((p) => (
                <button className="kwms-li" key={p.id} onClick={() => onGoto?.("po")} type="button" style={{ cursor: "pointer", textAlign: "left", background: "none", border: 0, width: "100%" }}>
                  <div className="kwms-li-main">
                    <span className="kwms-li-name">{p.nomor || "(draft)"}</span>
                    <span className="kwms-li-sub">{p.supplier || "—"} · {poStatusLabel(p.status)}</span>
                  </div>
                  <span className="kwms-li-val">{rpFull(p.total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function poStatusLabel(s: string): string {
  const m: Record<string, string> = {
    draft: "Draft",
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
    received: "Diterima",
    completed: "Selesai",
  };
  return m[s] ?? s;
}
