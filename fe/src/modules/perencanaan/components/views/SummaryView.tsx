import type { Summary } from "../../types";
import { picName } from "../../lib/format";
import { Metric, ProgressBar } from "../ui";

/** Portfolio overview: headline metrics, author workload, division readiness. */
export function SummaryView({ summary }: { summary: Summary }) {
  const { alerts } = summary;
  return (
    <div className="view view-summary">
      <div className="metric-row">
        <Metric label="Proyek" value={summary.projects} sub="total portofolio" />
        <Metric label="Progress rata-rata" value={`${summary.avgProgress}%`} sub="seluruh proyek" />
        <Metric
          label="Deliverable selesai"
          value={`${summary.tasksDone}/${summary.tasks}`}
          sub="task done / total"
        />
        <Metric
          label="Alert SLA"
          value={alerts.red + alerts.amber}
          sub={`${alerts.red} telat · ${alerts.amber} mendekati`}
          tone={alerts.red > 0 ? "bad" : alerts.amber > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="panel-grid">
        <section className="panel">
          <h2 className="panel-title">Beban Author (PIC)</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Author</th>
                <th className="num">Task</th>
                <th className="num">Selesai</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {summary.pics.map((p) => (
                <tr key={p.pic}>
                  <td>
                    <span className={`avatar pic-${p.pic}`}>{picName(p.pic).slice(0, 1)}</span>
                    {picName(p.pic)}
                  </td>
                  <td className="num">{p.total}</td>
                  <td className="num">{p.done}</td>
                  <td>
                    <div className="cell-progress">
                      <ProgressBar value={p.progress} />
                      <span className="cell-progress-num">{p.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2 className="panel-title">Kesiapan Output per Divisi</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Divisi</th>
                <th className="num">Siap</th>
                <th className="num">Total</th>
                <th>Kesiapan</th>
              </tr>
            </thead>
            <tbody>
              {summary.divisions.map((d) => {
                const pct = d.total > 0 ? Math.round((d.ready / d.total) * 100) : 0;
                return (
                  <tr key={d.division || d.label}>
                    <td>{d.label}</td>
                    <td className="num">{d.ready}</td>
                    <td className="num">{d.total}</td>
                    <td>
                      <div className="cell-progress">
                        <ProgressBar value={pct} />
                        <span className="cell-progress-num">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
