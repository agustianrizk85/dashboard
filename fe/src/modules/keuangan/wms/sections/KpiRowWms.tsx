/* WMS-native top scorecard — mirrors KpiRow from components/panels.tsx.
 * Six KPI tiles rendered as .kwms-kpi cells inside a .kwms-kpis grid. */
import type { Summary } from "../../types";
import { rp } from "../../lib/status";

const num = (n: number) => (Number(n) || 0).toLocaleString("id-ID");

function Tile({
  label,
  value,
  unit,
  tone,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "" | "ok" | "warn" | "bad";
  delta?: string;
}) {
  return (
    <div className={"kwms-kpi" + (tone ? " " + tone : "")}>
      <div className="k-label">{label}</div>
      <div className="k-val">
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </div>
      {delta ? <div className="k-delta">{delta}</div> : null}
    </div>
  );
}

export function KpiRowWms({ s }: { s: Summary }) {
  const cancelTone = s.cancelRate > 20 ? "bad" : s.cancelRate > 10 ? "warn" : "ok";
  const achTone = s.achievement >= 95 ? "ok" : s.achievement >= 80 ? "warn" : "bad";
  return (
    <div className="kwms-kpis">
      <Tile label="Nilai Akad (Plafon)" value={rp(s.nilaiAkad)} tone="ok" />
      <Tile label="Cash-in DP" value={rp(s.cashIn)} />
      <Tile
        label="Akad"
        value={num(s.akadCount)}
        unit={s.targetAkad ? `/ ${num(s.targetAkad)}` : ""}
        tone={achTone}
        delta={s.targetAkad ? `${s.achievement}%` : ""}
      />
      <Tile label="Booking Aktif" value={num(s.bookingCount)} unit={`≈ ${rp(s.pipelineValue)}`} tone="warn" />
      <Tile label="Rasio Batal" value={`${s.cancelRate}%`} tone={cancelTone} />
      <Tile label="KPR Share" value={`${s.kprShare}%`} unit={`${s.bankCount} bank`} />
    </div>
  );
}
