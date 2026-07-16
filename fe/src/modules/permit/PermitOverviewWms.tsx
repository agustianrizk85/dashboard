import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "@/modules/permit/models";
import { projectService } from "@/modules/permit/services/project.service";
import { StatCard, AreaSpark } from "@/components/wms/widgets";

/** WMS-style Permit overview (staff/kadep view). Real data from projectService,
 *  laid out in the shared Ops-Console cards. */
export function PermitOverviewWms() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectService
      .list()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stages = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) m.set(p.stage || "—", (m.get(p.stage || "—") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const total = projects.length;
  const done = projects.filter((p) => (p.stage || "").toLowerCase().includes("done") || (p.stage || "").toLowerCase().includes("selesai")).length;
  const permitStage = projects.filter((p) => (p.stage || "").toLowerCase().includes("permit")).length;
  // small illustrative trend from the stage distribution (not fabricated time data)
  const series = stages.length ? stages.map(([, n]) => n) : [0, 0];

  return (
    <div className="wms-grid">
      {/* Left: project list / notifications */}
      <div className="wms-card wms-col-5" style={{ display: "flex", flexDirection: "column" }}>
        <div className="wms-noti-h">
          <h2>{total} Lahan</h2>
        </div>
        <div className="wms-noti-list">
          {loading ? (
            <div className="wms-empty">Memuat…</div>
          ) : projects.length === 0 ? (
            <div className="wms-empty">Belum ada lahan.</div>
          ) : (
            projects.map((p) => {
              const st = (p.stage || "").toLowerCase();
              const tone = st.includes("done") || st.includes("selesai") ? "green" : st.includes("permit") ? "warn" : "green";
              return (
                <div key={p.id} className={`wms-noti ${tone === "warn" ? "warn" : ""}`}>
                  <div className="wms-noti-body">
                    <div className="wms-noti-top">
                      <span className="wms-noti-type">{p.name}</span>
                      <span className="wms-noti-time">{p.stage || "—"}</span>
                    </div>
                    <div className="wms-noti-msg">
                      {p.location || "Lokasi belum diisi"} · PT: {p.pt_name || "—"}
                    </div>
                  </div>
                  <button className="wms-noti-go" onClick={() => nav(`/permit/projects/${p.id}`)} type="button" aria-label="Buka">
                    →
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: KPI cards */}
      <StatCard title="Total Lahan" value={total} data={series} delta="Aktif" subtitle="Seluruh proyek lahan" className="wms-col-4" />
      <StatCard title="Proses Perizinan" value={permitStage} data={series} delta="Berjalan" subtitle="Lahan di tahap Permit" className="wms-col-3" />

      <div className="wms-card wms-col-7">
        <div className="wms-card-h">
          <h3>Distribusi Tahap</h3>
        </div>
        <table className="wms-table">
          <thead>
            <tr>
              <th>Tahap</th>
              <th>Jumlah</th>
              <th>Porsi</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(([s, n]) => (
              <tr key={s}>
                <td>{s}</td>
                <td>{n}</td>
                <td>{total ? Math.round((n / total) * 100) : 0}%</td>
              </tr>
            ))}
            {stages.length === 0 && (
              <tr>
                <td className="wms-empty" colSpan={3}>
                  Belum ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="wms-card wms-col-5">
        <div className="wms-card-h">
          <h3>Selesai</h3>
        </div>
        <AreaSpark data={series} />
        <div className="wms-stat-val">
          {done}
          <span className="wms-delta up">▲ {total ? Math.round((done / total) * 100) : 0}%</span>
        </div>
        <div className="wms-card-sub">Lahan selesai dari {total} total</div>
      </div>
    </div>
  );
}
