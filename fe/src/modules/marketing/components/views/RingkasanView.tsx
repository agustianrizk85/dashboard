import { useMemo } from "react";
import type { WorkItem, Warning } from "../../models";
import { alurShort } from "../../lib/alurCatalog";

const sevTone: Record<string, string> = { critical: "red", warning: "orange", info: "yellow" };
const sevIcon: Record<string, string> = { critical: "!", warning: "▲", info: "i" };

export function RingkasanView({ items, warnings }: { items: WorkItem[]; warnings: Warning[] }) {
  const stats = useMemo(() => {
    const paid = items.filter((i) => i.alur === "A" || i.alur === "B").length;
    const organic = items.filter((i) => i.alur === "C" || i.alur === "D").length;
    const done = items.filter((i) => i.stage === "done").length;
    const byAlur = (["A", "B", "C", "D"] as const).map((a) => ({
      alur: a,
      count: items.filter((i) => i.alur === a).length,
    }));
    const maxAlur = Math.max(1, ...byAlur.map((b) => b.count));
    return { paid, organic, done, byAlur, maxAlur };
  }, [items]);

  const sorted = [...warnings].sort((a, b) => {
    const o = { critical: 0, warning: 1, info: 2 } as const;
    return o[a.severity] - o[b.severity];
  });

  return (
    <div className="view">
      <div className="metric-row">
        <div className="metric">
          <div className="metric-label">Total Konten</div>
          <div className="metric-value">{items.length}</div>
          <div className="metric-sub">campaign &amp; konten aktif</div>
        </div>
        <div className="metric">
          <div className="metric-label">Iklan Berbayar</div>
          <div className="metric-value">{stats.paid}</div>
          <div className="metric-sub">Alur A &amp; B</div>
        </div>
        <div className="metric">
          <div className="metric-label">Konten Organik</div>
          <div className="metric-value">{stats.organic}</div>
          <div className="metric-sub">Alur C &amp; D</div>
        </div>
        <div className={`metric ${stats.done ? "ok" : ""}`}>
          <div className="metric-label">Selesai</div>
          <div className="metric-value">{stats.done}</div>
          <div className="metric-sub">seluruh langkah tuntas</div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <div className="panel-hd">
            <span className="ptitle">Early Warning System</span>
            <span className="pspacer" />
            <span className={`ptag`}>{warnings.length} sinyal</span>
          </div>
          <div className="panel-bd scroll">
            {sorted.length === 0 ? (
              <div className="empty-note">Semua langkah on-track. ✅</div>
            ) : (
              <div className="ai-list">
                {sorted.slice(0, 14).map((w, i) => (
                  <div key={i} className={`ai-card ${sevTone[w.severity]}`}>
                    <div className="ai-ico">{sevIcon[w.severity]}</div>
                    <div className="ai-tx">
                      <div className="ai-ty">
                        {w.step_code} · {w.work_item_title} · {w.owner}
                      </div>
                      <div className="ai-ms">{w.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd">
            <span className="ptitle">Distribusi per Alur</span>
          </div>
          <div className="panel-bd scroll">
            {stats.byAlur.map((b) => (
              <div className="catbar" key={b.alur}>
                <div className="cn">{alurShort[b.alur]}</div>
                <div className="ctrk">
                  <i style={{ width: `${(b.count / stats.maxAlur) * 100}%` }} />
                </div>
                <div className="cv">{b.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
