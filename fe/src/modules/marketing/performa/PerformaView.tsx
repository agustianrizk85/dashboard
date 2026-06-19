import { useEffect, useMemo, useState } from "react";
import { fetchPerforma } from "./cloudApi";
import type {
  PerformaData,
  ChannelRow,
  ProjectDot,
  LeadQuality,
  HandoverItem,
  AssetRow,
  IgAccount,
} from "./cloudApi";
import type { WorkItem, Warning } from "../models";
import { alurShort } from "../lib/alurCatalog";
import "./performa.css";

/* ---------- formatters ---------- */
const nf = new Intl.NumberFormat("id-ID");
const num = (n: number) => nf.format(Math.round(n));
function rpShort(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toFixed(2).replace(".", ",") + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toFixed(0) + " jt";
  if (n >= 1e3) return "Rp " + (n / 1e3).toFixed(0) + " rb";
  return "Rp " + num(n);
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const chTone: Record<string, string> = { scale: "ok", optimize: "warn", pause: "bad", test: "neutral" };
const hoTone: Record<string, string> = { good: "ok", warn: "warn", bad: "bad" };
const lqColor: Record<string, string> = { hot: "var(--ok)", warm: "var(--green-500)", nurture: "var(--warn)", low: "var(--bad)" };
const healthVar = (h: number) => (h >= 70 ? "var(--ok)" : h >= 50 ? "var(--warn)" : "var(--bad)");

/**
 * Marketing "Performa Iklan" view — the Qualified Demand Control Tower panels
 * (Channel Performance, Demand & Readiness, MQL Scoring, MQL→SAL Handover,
 * Digital Asset Registry) plus the Alert System & Content/Winning Campaign,
 * all sourced live from the cloud Control Tower API (see cloudApi.ts).
 */
export function PerformaView({ items, warnings }: { items: WorkItem[]; warnings: Warning[] }) {
  const [data, setData] = useState<PerformaData | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setErr("");
    fetchPerforma()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = useMemo(() => {
    const paid = items.filter((i) => i.alur === "A" || i.alur === "B").length;
    const organic = items.filter((i) => i.alur === "C" || i.alur === "D").length;
    const done = items.filter((i) => i.stage === "done").length;
    const byAlur = (["A", "B", "C", "D"] as const).map((a) => ({ alur: a as string, count: items.filter((i) => i.alur === a).length }));
    return { paid, organic, done, byAlur, max: Math.max(1, ...byAlur.map((b) => b.count)) };
  }, [items]);

  return (
    <div className="mkperf-wrap">
      {/* ── Ringkasan operasional konten (data lokal Marketing) ── */}
      <div className="mkperf-sec-h"><span /> Ringkasan Operasional Konten</div>
      <div className="mkperf-kpis">
        <Kpi label="Total Konten" value={items.length} sub="campaign & konten aktif" />
        <Kpi label="Iklan Berbayar" value={stats.paid} sub="Alur A & B" />
        <Kpi label="Konten Organik" value={stats.organic} sub="Alur C & D" />
        <Kpi label="Selesai" value={stats.done} sub="seluruh langkah tuntas" tone={stats.done ? "ok" : ""} />
      </div>
      <div className="mkperf">
        <EarlyWarningPanel warnings={warnings} />
        <DistribusiPanel byAlur={stats.byAlur} max={stats.max} />
      </div>

      {/* ── Performa iklan (data live Control Tower) ── */}
      <div className="mkperf-sec-h"><span /> Performa Iklan</div>
      {loading && !data ? (
        <div className="mkperf-state">Memuat performa iklan…</div>
      ) : err && !data ? (
        <div className="mkperf-state error">
          {err}
          <button className="mkperf-retry" onClick={load}>Coba lagi</button>
        </div>
      ) : data ? (
        <>
          <div className="qd-grid">
            <ChannelMatrix channels={data.channels} />
            <DemandReadiness items={data.projects} />
            {data.leadQuality && <MqlScoring lq={data.leadQuality} totalLeads={data.summary?.totalLeads ?? 0} />}
            <SalHandover items={data.handover} />
            <AssetRegistry assets={data.assets} ig={data.igAccounts} />
          </div>
          <div className="mkperf">
            <AlertPanel alerts={data.alerts} />
            <ContentPanel content={data.content} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── Local operational summary panels (same card design as Performa) ── */
function Kpi({ label, value, sub, tone = "" }: { label: string; value: number; sub: string; tone?: string }) {
  return (
    <div className={`mkperf-kpi ${tone}`}>
      <div className="mkperf-kpi-lbl">{label}</div>
      <div className="mkperf-kpi-val">{value}</div>
      <div className="mkperf-kpi-sub">{sub}</div>
    </div>
  );
}

const SEV_TONE: Record<string, string> = { critical: "red", warning: "orange", info: "yellow" };
function EarlyWarningPanel({ warnings }: { warnings: Warning[] }) {
  const sorted = [...warnings].sort((a, b) => {
    const o = { critical: 0, warning: 1, info: 2 } as const;
    return o[a.severity] - o[b.severity];
  });
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar amber" /> Early Warning System</h2>
        <span className="mkperf-pill">{warnings.length} sinyal</span>
      </header>
      <div className="mkperf-body">
        {sorted.length === 0 ? (
          <div className="muted">Semua langkah on-track. ✅</div>
        ) : (
          <div className="mkperf-warn">
            {sorted.slice(0, 12).map((w, i) => (
              <div key={i} className={`mkperf-warn-row ${SEV_TONE[w.severity] ?? "yellow"}`}>
                <span className="mkperf-warn-dot" />
                <div className="mkperf-warn-tx">
                  <div className="mkperf-warn-ty">{w.step_code} · {w.work_item_title} · {w.owner}</div>
                  <div className="mkperf-warn-ms">{w.message}</div>
                </div>
              </div>
            ))}
            {sorted.length > 12 && <div className="muted mkperf-warn-more">+{sorted.length - 12} sinyal lainnya</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function DistribusiPanel({ byAlur, max }: { byAlur: { alur: string; count: number }[]; max: number }) {
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar green" /> Distribusi per Alur</h2>
        <span className="mkperf-pill">A · B · C · D</span>
      </header>
      <div className="mkperf-body">
        <div className="mkperf-dist">
          {byAlur.map((b) => (
            <div className="mkperf-dist-row" key={b.alur}>
              <span className="mkperf-dist-lbl">{alurShort[b.alur]}</span>
              <span className="mkperf-dist-trk"><i style={{ width: `${(b.count / max) * 100}%` }} /></span>
              <span className="mkperf-dist-val">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===================== Channel Performance Matrix ===================== */
function ChannelMatrix({ channels }: { channels: ChannelRow[] }) {
  const maxLeads = Math.max(1, ...channels.map((c) => c.leads));
  return (
    <section className="qd-card qd-channels">
      <Head title="Channel Performance Matrix" tag="Scale · Optimize · Pause" />
      <div className="qd-ch-head">
        <span>CHANNEL</span><span className="r">SPEND</span><span>LEADS</span>
        <span className="r">MQL</span><span className="r">CPL</span><span className="r">ROI</span><span>STATUS</span>
      </div>
      <div className="qd-ch-body">
        {channels.map((c) => (
          <div className="qd-ch-row" key={c.name}>
            <div className="qd-ch-name"><b>{c.name}</b><span>{c.group.toUpperCase()}</span></div>
            <div className="r mono">{rpShort(c.spend)}</div>
            <div className="qd-ch-leads">
              <i style={{ width: (c.leads / maxLeads) * 100 + "%", background: `var(--${chTone[c.status] === "ok" ? "ok" : chTone[c.status] === "bad" ? "bad" : "warn"})` }} />
              <em>{num(c.leads)}</em>
            </div>
            <div className="r mono">{num(c.mql)}</div>
            <div className="r mono">{rpShort(c.cpl)}</div>
            <div className="r mono">{c.roi ?? "—"}</div>
            <div><span className={"qd-pill " + (chTone[c.status] ?? "neutral")}>{cap(c.status)}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== Project Demand & Readiness ===================== */
function DemandReadiness({ items }: { items: ProjectDot[] }) {
  const maxBk = Math.max(1, ...items.map((i) => i.booking));
  const color = (p: ProjectDot) => {
    const hiD = p.demand >= 50, hiR = p.readiness >= 50;
    if (hiD && hiR) return "var(--ok)";
    if (!hiD && !hiR) return "var(--bad)";
    return "var(--warn)";
  };
  return (
    <section className="qd-card qd-scatter">
      <Head title="Project Demand & Readiness" tag="Demand × Readiness" />
      <div className="qd-plot">
        <span className="qd-q tl">FIX READINESS</span>
        <span className="qd-q tr">SCALE</span>
        <span className="qd-q bl">HOLD</span>
        <span className="qd-q br">IMPROVE MESSAGE</span>
        <span className="qd-axis-y">Demand →</span>
        <span className="qd-axis-x">Readiness →</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="qd-grid-lines">
          <line x1="50" y1="0" x2="50" y2="100" />
          <line x1="0" y1="50" x2="100" y2="50" />
        </svg>
        {items.map((p) => {
          const r = 8 + (p.booking / maxBk) * 16;
          return (
            <div
              key={p.name}
              className="qd-bubble"
              title={`${p.name} · demand ${p.demand} · readiness ${p.readiness} · ${p.booking} booking`}
              style={{ left: p.readiness + "%", bottom: p.demand + "%", width: r, height: r, background: color(p) }}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ===================== Lead Quality & MQL Scoring ===================== */
function MqlScoring({ lq, totalLeads }: { lq: LeadQuality; totalLeads: number }) {
  const total = Math.max(1, lq.breakdown.reduce((s, b) => s + b.value, 0));
  const statTone = ["ok", "warn", "neutral"];
  return (
    <section className="qd-card">
      <Head title="Lead Quality & MQL Scoring" tag={`${num(totalLeads || total)} leads`} />
      <div className="qd-segbar">
        {lq.breakdown.map((b) => (
          <span key={b.label} style={{ width: (b.value / total) * 100 + "%", background: lqColor[b.color] ?? "var(--ink-3)" }} />
        ))}
      </div>
      <div className="qd-buckets">
        {lq.breakdown.map((b) => (
          <div className="qd-bk" key={b.label}>
            <i style={{ background: lqColor[b.color] ?? "var(--ink-3)" }} />
            <span>{b.label}</span><b>{num(b.value)}</b>
          </div>
        ))}
      </div>
      <div className="qd-stat3">
        {lq.stats.slice(0, 3).map((s, i) => (
          <div className="qd-stat" key={s.label}>
            <b className={"t-" + (statTone[i] ?? "ink")}>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="qd-tb">
        <div><span className="up">▲ Top</span> {lq.topSource}</div>
        <div><span className="down">▼ Bottom</span> {lq.bottomSource}</div>
      </div>
    </section>
  );
}

/* ===================== MQL → SAL Handover ===================== */
function SalHandover({ items }: { items: HandoverItem[] }) {
  return (
    <section className="qd-card">
      <Head title="MQL → SAL Handover" tag="Akuntabilitas" />
      <div className="qd-tiles">
        {items.map((h) => (
          <div className="qd-tile" key={h.label}>
            <b className={"t-" + (hoTone[h.status] ?? "ink")}>{h.value}</b>
            <span>{h.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== Digital Asset Registry ===================== */
function AssetRegistry({ assets, ig }: { assets: AssetRow[]; ig: IgAccount[] }) {
  return (
    <section className="qd-card">
      <Head title="Digital Asset Registry" tag="Web · IG · TikTok · YT · GBP" />
      <div className="qd-assets">
        {assets.map((a) => (
          <div className="qd-asset" key={a.type} title={a.note}>
            <b>{a.type}</b>
            <span className="qd-handle">{a.handle}</span>
            <div className="qd-hbar"><i style={{ width: a.health + "%", background: healthVar(a.health) }} /></div>
            <em>{a.health}</em>
          </div>
        ))}
      </div>
      <div className="qd-ig">
        <div className="qd-ig-cap"><b>{ig.length} IG Project</b> · kotak = akun, warna = health, ✕ = tidak aktif</div>
        <div className="qd-ig-boxes">
          {ig.map((g) => (
            <span
              key={g.handle}
              className={"qd-ig-box" + (g.active ? "" : " off")}
              title={`${g.handle} · health ${g.health}${g.active ? "" : " · tidak aktif"}`}
              style={{ background: g.active ? healthVar(g.health) : undefined }}
            >
              {g.active ? "" : "✕"}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- shared ---------- */
function Head({ title, tag }: { title: string; tag: string }) {
  return (
    <div className="qd-head">
      <h3>{title}</h3>
      <span className="qd-tag">{tag}</span>
    </div>
  );
}

/* ===================== Alert System (existing) ===================== */
function AlertPanel({ alerts }: { alerts: PerformaData["alerts"] }) {
  const groups = [
    { key: "red", title: "Red Alert", cls: "red", items: alerts.red },
    { key: "yellow", title: "Yellow", cls: "yellow", items: alerts.yellow },
    { key: "green", title: "Green Signal", cls: "green", items: alerts.green },
  ] as const;

  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar" /> Alert System</h2>
        <span className="mkperf-pill">Red · Yellow · Green</span>
      </header>
      <div className="mkperf-body">
        {groups.map((g) => (
          <div key={g.key} className="mkperf-alert-group">
            <div className={`mkperf-alert-title ${g.cls}`}>
              <span className="mkperf-dot" /> {g.title}
              <span className="mkperf-count">{g.items.length}</span>
            </div>
            <ul className={`mkperf-alert-list ${g.cls}`}>
              {g.items.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
              {g.items.length === 0 && <li className="muted">—</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== Content & Winning Campaign (existing) ===================== */
function ContentPanel({ content }: { content: PerformaData["content"] }) {
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar" /> Content &amp; Winning Campaign</h2>
        <span className="mkperf-pill">Evidence-based</span>
      </header>
      <div className="mkperf-body">
        <div className="mkperf-subhead">
          Winning Campaign <span className="muted">· lolos ≥5 dari 8 syarat</span>
        </div>

        <div className="mkperf-winlist">
          {content.winning.map((w, i) => (
            <div key={i} className="mkperf-win">
              <div className="mkperf-win-id">
                <div className="mkperf-win-name">{w.name}</div>
                <div className="mkperf-win-sub">{w.project} · {w.channel}</div>
              </div>
              <div className="mkperf-win-metrics">
                <span className="m">{w.criteria}/8</span>
                <span className="m">{w.cpl}</span>
                <span className="m">MQL {w.mql}</span>
                <span className="mkperf-book">{w.booking} book</span>
              </div>
            </div>
          ))}
          {content.winning.length === 0 && <div className="muted">Belum ada kandidat winning campaign.</div>}
        </div>

        <div className="mkperf-bw">
          <div className="mkperf-bw-col best">
            <div className="mkperf-bw-label">▲ Best</div>
            <div className="mkperf-bw-name">{content.best.name}</div>
            <div className="mkperf-bw-sub">{content.best.account} · {content.best.metric}</div>
          </div>
          <div className="mkperf-bw-col worst">
            <div className="mkperf-bw-label">▼ Worst</div>
            <div className="mkperf-bw-name">{content.worst.name}</div>
            <div className="mkperf-bw-sub">{content.worst.account} · {content.worst.metric}</div>
          </div>
        </div>

        <div className="mkperf-foot">
          <span className="mkperf-foot-chip rework">{content.rework} konten perlu rework</span>
          <span className="mkperf-foot-chip pause">{content.pause} kandidat pause</span>
        </div>
      </div>
    </section>
  );
}
