import { useMemo } from "react";
import type { WorkItem, Warning } from "./models";
import { alurShort } from "./lib/alurCatalog";
import { StatCard, AreaSpark } from "@/components/wms/widgets";

/** Map a warning severity to a WMS notification tone. */
const SEV_TONE: Record<string, "green" | "warn" | "danger"> = {
  critical: "danger",
  warning: "warn",
  info: "green",
};

const STAGE_LABEL: Record<string, string> = {
  brief: "Brief",
  produksi: "Produksi",
  review: "Review",
  approval: "Approval",
  distribusi: "Distribusi",
  done: "Selesai",
};
const STAGE_ORDER = ["brief", "produksi", "review", "approval", "distribusi", "done"];

/**
 * WMS-style Marketing overview (non-all-access staff view). 100% real data,
 * fed from the shell's live work-items + early-warning feed (same endpoints the
 * old Ringkasan used). Laid out in the shared Ops-Console cards.
 */
export function MarketingOverviewWms({
  items,
  warnings,
  loading = false,
  inactive = false,
  onOpenWorkflow,
}: {
  items: WorkItem[];
  warnings: Warning[];
  loading?: boolean;
  inactive?: boolean;
  onOpenWorkflow?: () => void;
}) {
  const stats = useMemo(() => {
    const paid = items.filter((i) => i.alur === "A" || i.alur === "B").length;
    const organic = items.filter((i) => i.alur === "C" || i.alur === "D").length;
    const done = items.filter((i) => i.stage === "done").length;
    const byAlur = (["A", "B", "C", "D"] as const).map((a) => ({
      alur: a as string,
      count: items.filter((i) => i.alur === a).length,
    }));
    const byStage = STAGE_ORDER.map((s) => ({ stage: s, count: items.filter((i) => i.stage === s).length }));
    return { paid, organic, done, byAlur, byStage };
  }, [items]);

  const total = items.length;
  const donePct = total ? Math.round((stats.done / total) * 100) : 0;
  const alurSeries = stats.byAlur.map((b) => b.count);
  const stageSeries = stats.byStage.map((b) => b.count);

  const sortedWarn = useMemo(() => {
    const o = { critical: 0, warning: 1, info: 2 } as const;
    return [...warnings].sort((a, b) => o[a.severity] - o[b.severity]);
  }, [warnings]);

  return (
    <div className="wms-grid">
      {/* Left: Early Warning notification feed */}
      <div className="wms-card wms-col-5" style={{ display: "flex", flexDirection: "column" }}>
        <div className="wms-noti-h">
          <h2>{warnings.length} Sinyal</h2>
        </div>
        <div className="wms-noti-list">
          {loading ? (
            <div className="wms-empty">Memuat…</div>
          ) : inactive ? (
            <div className="wms-empty">Modul Alur Kerja belum aktif di server.</div>
          ) : sortedWarn.length === 0 ? (
            <div className="wms-empty">Semua langkah on-track.</div>
          ) : (
            sortedWarn.map((w, i) => {
              const tone = SEV_TONE[w.severity] ?? "green";
              return (
                <div key={i} className={`wms-noti ${tone === "green" ? "" : tone}`}>
                  <div className="wms-noti-body">
                    <div className="wms-noti-top">
                      <span className="wms-noti-type">
                        {w.step_code} · {w.work_item_title}
                      </span>
                      <span className="wms-noti-time">{w.owner || "—"}</span>
                    </div>
                    <div className="wms-noti-msg">{w.message}</div>
                  </div>
                  <button className="wms-noti-go" onClick={onOpenWorkflow} type="button" aria-label="Buka">
                    →
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: KPI cards */}
      <StatCard title="Total Konten" value={total} data={alurSeries} delta="Aktif" subtitle="Campaign & konten aktif" className="wms-col-4" />
      <StatCard title="Iklan Berbayar" value={stats.paid} data={alurSeries} delta="Alur A & B" subtitle="Materi iklan berbayar" className="wms-col-3" />

      {/* Distribution table by alur */}
      <div className="wms-card wms-col-7">
        <div className="wms-card-h">
          <h3>Distribusi per Alur</h3>
        </div>
        <table className="wms-table">
          <thead>
            <tr>
              <th>Alur</th>
              <th>Jumlah</th>
              <th>Porsi</th>
            </tr>
          </thead>
          <tbody>
            {stats.byAlur.map((b) => (
              <tr key={b.alur}>
                <td>{alurShort[b.alur] ?? b.alur}</td>
                <td>{b.count}</td>
                <td>{total ? Math.round((b.count / total) * 100) : 0}%</td>
              </tr>
            ))}
            {total === 0 && (
              <tr>
                <td className="wms-empty" colSpan={3}>
                  Belum ada konten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Selesai / stage progress card */}
      <div className="wms-card wms-col-5">
        <div className="wms-card-h">
          <h3>Selesai</h3>
        </div>
        <AreaSpark data={stageSeries} labels={stats.byStage.map((b) => STAGE_LABEL[b.stage] ?? b.stage)} />
        <div className="wms-stat-val">
          {stats.done}
          <span className="wms-delta up">▲ {donePct}%</span>
        </div>
        <div className="wms-card-sub">
          Konten tuntas dari {total} total · {stats.organic} organik
        </div>
      </div>
    </div>
  );
}
