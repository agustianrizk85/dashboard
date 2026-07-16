import type { ProjectFin } from "../../types";
import { rp } from "../../lib/status";

/** WMS-native "Akad per Proyek" card. Mirrors ProjectPanel. */
export function ProjectWms({ projects }: { projects: ProjectFin[] }) {
  return (
    <div className="wms-card wms-col-3">
      <div className="wms-card-h">
        <h3>Akad per Proyek</h3>
        <span className="kwms-cap">{projects.length} proyek</span>
      </div>
      {projects.length === 0 ? (
        <div className="wms-empty">Belum ada data proyek.</div>
      ) : (
        <div className="kwms-list">
          {projects.slice(0, 7).map((p) => (
            <div className="kwms-li" key={p.code}>
              <div className="kwms-li-main">
                <span className="kwms-li-name">{p.name}</span>
                <span className="kwms-li-sub">{p.akad} akad · {p.kprPct}% KPR</span>
              </div>
              <span className="kwms-li-val">{rp(p.nilai)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
