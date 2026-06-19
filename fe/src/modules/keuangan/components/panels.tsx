import type {
  AIInsight,
  Alert,
  BankFin,
  Decision,
  FunnelStage,
  MonthPoint,
  PayMethod,
  PipelineRow,
  ProjectFin,
  SalesRank,
  Summary,
} from "../types";
import { rp, toneClass } from "../lib/status";
import { Bar, Kpi, Panel, Pill, Stat, StatusPill } from "./ui";
import { MonthlyChart } from "./CashflowChart";

const num = (n: number) => n.toLocaleString("id-ID");

/** Compact empty placeholder for a panel with no data yet. */
function Empty({ label }: { label: string }) {
  return <div className="empty-mini">{label}</div>;
}

/* ---- Top scorecard ---------------------------------------------------- */
export function KpiRow({ s }: { s: Summary }) {
  const cancelTone = s.cancelRate > 20 ? "bad" : s.cancelRate > 10 ? "warn" : "ok";
  const achTone = s.achievement >= 95 ? "ok" : s.achievement >= 80 ? "warn" : "bad";
  return (
    <div className="kpi-row">
      <Kpi label="Nilai Akad (Plafon)" value={rp(s.nilaiAkad)} tone="ok" />
      <Kpi label="Cash-in DP" value={rp(s.cashIn)} />
      <Kpi label="Akad" value={num(s.akadCount)} unit={s.targetAkad ? `/ ${num(s.targetAkad)}` : ""} tone={achTone} delta={s.targetAkad ? `${s.achievement}%` : undefined} />
      <Kpi label="Booking Aktif" value={num(s.bookingCount)} unit={`≈ ${rp(s.pipelineValue)}`} tone="warn" />
      <Kpi label="Rasio Batal" value={`${s.cancelRate}%`} tone={cancelTone} />
      <Kpi label="KPR Share" value={`${s.kprShare}%`} unit={`${s.bankCount} bank`} />
    </div>
  );
}

/* ---- Funnel ----------------------------------------------------------- */
export function FunnelPanel({ funnel, onExpand }: { funnel: FunnelStage[]; onExpand?: () => void }) {
  const top = funnel[0]?.count || 1;
  return (
    <Panel tag="PIPELINE" title="Funnel Booking → Akad" sub="proses KPR" onExpand={onExpand}>
      {funnel.length === 0 ? (
        <Empty label="Belum ada data pipeline." />
      ) : (
        <div className="funnel">
          {funnel.map((st, i) => {
            const prev = i > 0 ? funnel[i - 1].count : st.count;
            const conv = prev > 0 ? Math.round((st.count / prev) * 100) : 100;
            return (
              <div className="fn-row" key={st.key}>
                <span className="fn-label">{st.label}</span>
                <Bar value={st.count} max={top} tone={st.key === "akad" ? "green" : "yellow"} />
                <span className="fn-val">{num(st.count)}</span>
                {i > 0 && <span className="fn-conv">{conv}%</span>}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ---- Monthly akad trend ---------------------------------------------- */
export function MonthlyPanel({ monthly, onExpand }: { monthly: MonthPoint[]; onExpand?: () => void }) {
  return (
    <Panel tag="TREN" title="Akad per Bulan" sub="nilai (—) vs DP (- -), Rp miliar" onExpand={onExpand}>
      <MonthlyChart monthly={monthly} />
    </Panel>
  );
}

/* ---- Projects --------------------------------------------------------- */
export function ProjectPanel({
  projects,
  onExpand,
  onRow,
}: {
  projects: ProjectFin[];
  onExpand?: () => void;
  onRow?: (p: ProjectFin) => void;
}) {
  return (
    <Panel tag="PROYEK" title="Akad per Proyek" sub={`${projects.length} proyek`} onExpand={onExpand}>
      {projects.length === 0 ? (
        <Empty label="Belum ada data proyek." />
      ) : (
        <div className="rows">
          {projects.slice(0, 7).map((p) => (
            <button className="row click" key={p.code} onClick={() => onRow?.(p)}>
              <StatusPill status={p.status} />
              <span className="row-name">{p.name}</span>
              <span className="row-sub">{p.akad} akad · {p.kprPct}% KPR</span>
              <span className="row-val">{rp(p.nilai)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Banks (Pendanaan) ------------------------------------------------ */
export function BankPanel({ banks, onExpand }: { banks: BankFin[]; onExpand?: () => void }) {
  const max = banks[0]?.plafon || 1;
  return (
    <Panel tag="PENDANAAN" title="Plafond KPR per Bank" sub={`${banks.length} bank`} onExpand={onExpand}>
      {banks.length === 0 ? (
        <Empty label="Belum ada akad KPR." />
      ) : (
        <div className="rows">
          {banks.slice(0, 6).map((b) => (
            <div className="row" key={b.name}>
              <span className="row-name">{b.name}</span>
              <Bar value={b.plafon} max={max} tone="green" />
              <span className="row-sub">{b.share}% · {b.akad} akad</span>
              <span className="row-val">{rp(b.plafon)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Sales ranking ---------------------------------------------------- */
export function SalesPanel({ sales, onExpand }: { sales: SalesRank[]; onExpand?: () => void }) {
  return (
    <Panel tag="SALES" title="Kontribusi Akad — Sales" sub={`${sales.length} kontributor`} onExpand={onExpand}>
      {sales.length === 0 ? (
        <Empty label="Belum ada data sales." />
      ) : (
        <div className="rows">
          {sales.slice(0, 7).map((s, i) => (
            <div className="row" key={s.name + i}>
              <span className="row-rank">{i + 1}</span>
              <span className="row-name">
                {s.name} {s.isAgent && <Pill tone="orange" dot={false}>Agent</Pill>}
              </span>
              <span className="row-sub">{s.akad} akad</span>
              <span className="row-val">{rp(s.nilai)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Payment mix ------------------------------------------------------ */
export function PayMixPanel({ payMix, onExpand }: { payMix: PayMethod[]; onExpand?: () => void }) {
  const total = payMix.reduce((a, p) => a + p.count, 0) || 1;
  const tone = (t: string) => (t === "KPR" ? "green" : t === "Cash Keras" ? "yellow" : "orange");
  return (
    <Panel tag="CARA BAYAR" title="Skema Pembayaran" sub={`${num(total)} akad`} onExpand={onExpand}>
      {payMix.length === 0 ? (
        <Empty label="Belum ada data." />
      ) : (
        <div className="rows">
          {payMix.map((p) => (
            <div className="row" key={p.type}>
              <Pill tone={tone(p.type)} dot>{p.type}</Pill>
              <Bar value={p.count} max={total} tone={p.type === "KPR" ? "green" : "yellow"} />
              <span className="row-sub">{Math.round((p.count / total) * 100)}%</span>
              <span className="row-val">{num(p.count)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Pipeline early-warning ------------------------------------------ */
const SLA_TONE = { overdue: "red", due: "yellow", ok: "green" } as const;

export function PipelinePanel({ pipeline, onExpand }: { pipeline: PipelineRow[]; onExpand?: () => void }) {
  pipeline = pipeline ?? [];
  const flagged = pipeline.filter((r) => r.kendala).length;
  return (
    <Panel tag="EARLY WARNING" title="Pipeline Tertahan" sub={`${flagged} berkendala`} accent="var(--bad)" onExpand={onExpand}>
      {pipeline.length === 0 ? (
        <Empty label="Tidak ada booking aktif tertahan." />
      ) : (
        <div className="rows">
          {pipeline.slice(0, 7).map((r, i) => (
            <div className="row" key={r.customer + i}>
              <Pill tone={SLA_TONE[r.sla]} dot>{r.stage}</Pill>
              <span className="row-name">{r.customer}</span>
              <span className="row-sub">{r.project} · {r.bank || r.caraBayar}</span>
              <span className="row-note">{r.kendala || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- AI + decisions --------------------------------------------------- */
export function AiDecisionPanel({
  insights,
  decisions,
  onExpand,
}: {
  insights: AIInsight[];
  decisions: Decision[];
  onExpand?: () => void;
}) {
  return (
    <Panel tag="AI" title="AI Insight & Keputusan" sub="war-room" onExpand={onExpand}>
      <div className="ai-list">
        {insights.slice(0, 4).map((a, i) => (
          <div className="ai-item" key={i}>
            <Pill tone={toneClass(a.tone)} dot>{a.type}</Pill>
            <span className="ai-text">{a.text}</span>
          </div>
        ))}
      </div>
      {decisions.length > 0 && (
        <div className="dec-list">
          {decisions.slice(0, 4).map((d, i) => (
            <div className="dec-item" key={i}>
              <span className="dec-role">{d.role}</span>
              <span className="dec-text">{d.text}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Alerts ----------------------------------------------------------- */
export function AlertPanel({ alerts, onExpand }: { alerts: Alert[]; onExpand?: () => void }) {
  return (
    <Panel tag="ALERT" title="Alarm Keuangan" sub={`${alerts.length}`} accent="var(--bad)" onExpand={onExpand}>
      <div className="alert-list">
        {alerts.map((a, i) => (
          <div className={`alert-item ${a.tone}`} key={i}>
            <div className="alert-h">
              <Pill tone={toneClass(a.tone)} dot>{a.title}</Pill>
            </div>
            <div className="alert-detail">{a.detail}</div>
            <div className="alert-action">→ {a.action}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* Re-export Stat for focus views. */
export { Stat };
