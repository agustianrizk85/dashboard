import { useMemo } from "react";
import type { DashboardData, ProyekMetric } from "./types";
import { StatCard, AreaSpark } from "@/components/wms/widgets";

const pct = (v: number) => `${v.toFixed(1)}%`;
const dev = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

/** Status → WMS badge tone (green default · warn · danger). */
function badgeClass(status: string): string {
  if (status === "Critical Delay") return "wms-badge danger";
  if (status === "Warning") return "wms-badge warn";
  return "wms-badge";
}

/**
 * WMS-style Teknik overview (staff / kadep view). Real data from the derived
 * dashboard payload (GET /api/dashboard) laid out in the shared Ops-Console
 * cards: an attention list, KPI stat cards with area sparklines, a progress
 * table and the Kurva S baseline. Clicking a proyek opens the existing detail
 * modal (via `onProject`); the header links jump to the matching section.
 */
export function TeknikOverviewWms({
  D,
  onProject,
  setTab,
}: {
  D: DashboardData;
  onProject: (p: ProyekMetric) => void;
  setTab: (t: string) => void;
}) {
  const s = D.summary;

  // Risky proyek first; if all healthy, fall back to worst-deviation so the
  // notification card is never empty.
  const attention = useMemo(
    () =>
      [...D.proyek]
        .filter((p) => p.status === "Critical Delay" || p.status === "Warning")
        .sort((a, b) => a.deviasi - b.deviasi),
    [D.proyek],
  );
  const list = attention.length ? attention : [...D.proyek].sort((a, b) => a.deviasi - b.deviasi).slice(0, 8);

  // Progress per proyek — worst deviation first.
  const rows = useMemo(() => [...D.proyek].sort((a, b) => a.deviasi - b.deviasi), [D.proyek]);

  // Real trends from the payload (no fabricated time data): the Kurva S baseline
  // cumulative curve, and the per-cluster proyek distribution.
  const kurva = D.kurvaBaseline.map((w) => w.cumulative);
  const clusterSeries = D.clusterMetrics.length ? D.clusterMetrics.map((c) => c.proyek) : D.proyek.map((p) => p.units);

  return (
    <div className="wms-grid">
      {/* Left: attention / notification list */}
      <div className="wms-card wms-col-5" style={{ display: "flex", flexDirection: "column" }}>
        <div className="wms-noti-h">
          <h2>{attention.length} Butuh Perhatian</h2>
        </div>
        <div className="wms-noti-list">
          {list.length === 0 ? (
            <div className="wms-empty">Belum ada proyek.</div>
          ) : (
            list.map((p) => {
              const tone = p.status === "Critical Delay" ? "danger" : p.status === "Warning" ? "warn" : "";
              return (
                <div key={p.id} className={`wms-noti ${tone}`}>
                  <div className="wms-noti-body">
                    <div className="wms-noti-top">
                      <span className="wms-noti-type">{p.nama}</span>
                      <span className="wms-noti-time">{p.status}</span>
                    </div>
                    <div className="wms-noti-msg">
                      Aktual {pct(p.aktual)} / target {pct(p.target)} · dev {dev(p.deviasi)}% · {p.kontraktor || "kontraktor —"}
                    </div>
                  </div>
                  <button className="wms-noti-go" onClick={() => onProject(p)} type="button" aria-label="Buka detail">
                    →
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: KPI stat cards */}
      <StatCard
        title="Total Proyek"
        value={s.totalProyek}
        data={clusterSeries}
        delta={`${s.totalUnits} unit`}
        subtitle={`${s.totalSpk} SPK · ${D.clusterMetrics.length} cluster`}
        className="wms-col-4"
      />
      <StatCard
        title="Overall Progress"
        value={pct(s.overall)}
        data={kurva}
        deltaUp={s.avgSpi >= 1}
        delta={`SPI ${s.avgSpi.toFixed(2)}`}
        subtitle={`Rata-rata deviasi ${dev(s.avgDeviasi)}%`}
        className="wms-col-3"
      />

      {/* Progress per proyek table */}
      <div className="wms-card wms-col-7">
        <div className="wms-card-h">
          <h3>Progress per Proyek</h3>
          <button className="wms-btn ghost" type="button" onClick={() => setTab("deviasi")}>
            Deviasi &amp; SPI →
          </button>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <table className="wms-table">
            <thead>
              <tr>
                <th>Proyek</th>
                <th>Cluster</th>
                <th>Aktual</th>
                <th>Target</th>
                <th>Deviasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => onProject(p)}>
                  <td>
                    <b>{p.nama}</b>
                  </td>
                  <td>{p.clusterKode}</td>
                  <td>{pct(p.aktual)}</td>
                  <td>{pct(p.target)}</td>
                  <td>{dev(p.deviasi)}</td>
                  <td>
                    <span className={badgeClass(p.status)}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="wms-empty" colSpan={6}>
                    Belum ada proyek.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kurva S baseline + status split */}
      <div className="wms-card wms-col-5">
        <div className="wms-card-h">
          <h3>Kurva S — Rencana Kumulatif</h3>
          <button className="wms-btn ghost" type="button" onClick={() => setTab("kpi")}>
            KPI Direksi →
          </button>
        </div>
        <AreaSpark data={kurva.length ? kurva : [0, 0]} />
        <div className="wms-stat-val">
          {pct(D.overallActual)}
          <span className={`wms-delta ${s.avgDeviasi >= 0 ? "up" : "down"}`}>
            {s.avgDeviasi >= 0 ? "▲" : "▼"} {dev(s.avgDeviasi)}%
          </span>
        </div>
        <div className="wms-card-sub">
          Aktual keseluruhan minggu ~{D.overallWeek} · {s.onSchedule} on schedule · {s.warning} warning · {s.critical} kritis
        </div>
      </div>
    </div>
  );
}
