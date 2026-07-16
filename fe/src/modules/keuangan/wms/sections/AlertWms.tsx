import type { AIInsight, Alert, Decision } from "../../types";

/** WMS-native "Alarm Keuangan" card. Combines AlertPanel + AiDecisionPanel. */
export function AlertWms({ alerts, ai, decisions }: { alerts: Alert[]; ai: AIInsight[]; decisions: Decision[] }) {
  const alertClass = (t: string) =>
    t === "green" ? "ok" : t === "yellow" || t === "orange" ? "warn" : t === "crisis" ? "crisis" : t === "red" ? "bad" : "";
  const badgeTone = (t: string) => (t === "green" ? "" : t === "yellow" || t === "orange" ? "warn" : "danger");
  return (
    <div className="wms-card wms-col-3">
      <div className="wms-card-h">
        <h3>Alarm Keuangan</h3>
        <span className="kwms-cap">{`${alerts.length}`}</span>
      </div>
      <div className="kwms-alerts">
        {alerts.map((a, i) => (
          <div className={"kwms-alert " + alertClass(a.tone)} key={i}>
            <span className={"wms-badge " + badgeTone(a.tone)}>{a.title}</span>
            <div className="a-detail">{a.detail}</div>
            <div className="a-action">→ {a.action}</div>
          </div>
        ))}
        {alerts.length === 0 && <div className="wms-empty">Tidak ada alarm.</div>}
      </div>
      {ai.length > 0 && (
        <>
          <div className="wms-note small" style={{ marginTop: 14, fontWeight: 700 }}>AI Insight</div>
          {ai.slice(0, 3).map((x, i) => (
            <div className={"kwms-alert " + alertClass(x.tone)} key={i} style={{ marginTop: 8 }}>
              <span className={"wms-badge " + badgeTone(x.tone)}>{x.type}</span>
              <div className="a-detail">{x.text}</div>
            </div>
          ))}
        </>
      )}
      {decisions.length > 0 && (
        <div className="kwms-list" style={{ marginTop: 8 }}>
          {decisions.slice(0, 2).map((d, i) => (
            <div className="kwms-li" key={i}>
              <div className="kwms-li-main">
                <span className="kwms-li-name">{d.role}</span>
                <span className="kwms-li-sub">{d.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
