import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Warning } from "@/modules/permit/models";
import { dashboardService } from "@/modules/permit/services/dashboard.service";

const sevMeta: Record<string, { label: string; cls: string }> = {
  critical: { label: "Kritis", cls: "sev-critical" },
  warning: { label: "Peringatan", cls: "sev-warning" },
  info: { label: "Info", cls: "sev-info" },
};

export function EarlyWarningPanel() {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService
      .warnings()
      .then((r) => setWarnings(r.warnings))
      .catch(() => setWarnings([]))
      .finally(() => setLoading(false));
  }, []);

  const order = { critical: 0, warning: 1, info: 2 } as const;
  const sorted = [...warnings].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <div className="card warning-panel">
      <div className="warning-head">
        <h2>⚠️ Early Warning System (AI)</h2>
        <span className="badge">{warnings.length} sinyal</span>
      </div>
      {loading ? (
        <div className="muted">Memuat…</div>
      ) : sorted.length === 0 ? (
        <div className="muted small">Tidak ada peringatan. Semua langkah on-track. ✅</div>
      ) : (
        <ul className="warning-list">
          {sorted.slice(0, 12).map((w, i) => {
            const m = sevMeta[w.severity];
            return (
              <li key={i} className={`warning-item ${m.cls}`}>
                <span className={`sev-dot ${m.cls}`} />
                <Link to={`/permit/projects/${w.project_id}`} className="warning-text">
                  <b>
                    {w.step_code} · {w.project_name}
                  </b>
                  <span className="muted"> — {w.message}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
