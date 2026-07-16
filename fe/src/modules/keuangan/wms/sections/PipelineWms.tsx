import type { PipelineRow } from "../../types";

const slaBadge = (sla: PipelineRow["sla"]) =>
  sla === "overdue" ? "danger" : sla === "due" ? "warn" : "grey";

/** WMS-native "Pipeline Tertahan" early-warning card. Mirrors PipelinePanel. */
export function PipelineWms({ pipeline }: { pipeline: PipelineRow[] }) {
  const flagged = pipeline.filter((r) => r.kendala).length;
  return (
    <div className="wms-card wms-col-5">
      <div className="wms-card-h">
        <h3>Pipeline Tertahan</h3>
        <span className="wms-badge danger">{flagged} berkendala</span>
      </div>
      {pipeline.length === 0 ? (
        <div className="wms-empty">Tidak ada booking aktif tertahan.</div>
      ) : (
        <div className="kwms-list">
          {pipeline.slice(0, 7).map((r, i) => (
            <div className="kwms-li" key={r.customer + i}>
              <div className="kwms-li-main">
                <span className="kwms-li-name">
                  <span className={"wms-badge " + slaBadge(r.sla)}>{r.stage}</span> {r.customer}
                </span>
                <span className="kwms-li-sub">{r.project} · {r.bank || r.caraBayar}</span>
                <span className="kwms-li-note">{r.kendala || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
