import type { Dashboard, Project } from "../types";
import { Card, Ring, Donut, MiniBars } from "./ui";
import { CAT, CH_C, LAYER_C, SEV, STATUS, convColor, num, pct, rankColor, rpShort, statusFor } from "../lib/format";
import { funnelConv } from "../lib/format";

type PanelProps = { d: Dashboard; onExpand: () => void };

/**
 * EmptyCard renders a panel shell with a "no data" hint, used when a panel's
 * underlying collection is empty (e.g. reasons/agents are not part of an Excel
 * upload, so they stay empty until entered manually).
 */
function EmptyCard({ title, tag }: { title: string; tag?: string; onExpand?: () => void }) {
  // Intentionally not expandable: there is nothing to drill into.
  return (
    <Card title={title} tag={tag} accent="#0E5C34">
      <div className="panel-empty">Belum ada data — isi lewat Upload Excel atau Master Data.</div>
    </Card>
  );
}

/* ===================== PANEL 1 — EXECUTIVE SNAPSHOT ===================== */
type ExecPick = (status: "akad" | "proses" | "batal" | null, bookingOnly?: boolean) => void;

export function ExecutivePanel({ d, onExpand, onPick }: PanelProps & { onPick?: ExecPick }) {
  const e = d.exec;
  // Panel 1 snapshot memakai formula "posisi target": booking 2026 di luar Batal.
  // Fallback ke (booking − batal) bila backend belum di-reingest dgn field baru.
  const bookingSnap = e.bookingNoBatal ?? Math.max(0, e.booking - e.batal);
  const ach = (bookingSnap / e.target2026) * 100;
  const prosesCash = e.prosesCash ?? 0;
  const prosesKpr = e.prosesKpr ?? 0;
  // Each KPI tile drills into the Booking→Akad→Cash-In detail. Status tiles
  // filter to that status; Total Booking scopes to active bookings (akad+proses,
  // no Batal) so the list count ties to the KPI. Static tile if no handler.
  const tile = (
    value: number,
    label: string,
    color: string | undefined,
    status: "akad" | "proses" | "batal" | null,
    bookingOnly = false,
  ) =>
    onPick ? (
      <button type="button" className="ek ek-btn" onClick={() => onPick(status, bookingOnly)} title={`Lihat detail ${label}`}>
        <span className="ek-v" style={color ? { color } : undefined}>{value}</span>
        <span className="ek-k">{label}</span>
      </button>
    ) : (
      <div className="ek">
        <span className="ek-v" style={color ? { color } : undefined}>{value}</span>
        <span className="ek-k">{label}</span>
      </div>
    );
  return (
    <Card
      title="Executive Sales Snapshot"
      tag="Panel 1 · Posisi Target 500 Unit"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.5" fill="currentColor" />
        </svg>
      }
      className="card-exec"
    >
      <div className="exec-top">
        {(() => {
          const ring = (
            <Ring value={bookingSnap} max={e.target2026} size={150} stroke={15} color="#1F9D54">
              <div className="ring-big">{bookingSnap}</div>
              <div className="ring-small">/ {e.target2026} booking</div>
              <div className="ring-pct">{pct(ach, 1)}</div>
            </Ring>
          );
          return onPick ? (
            <button type="button" className="ring-btn" onClick={() => onPick(null, true)} title={`Lihat ${bookingSnap} booking 2026 (di luar batal)`}>
              {ring}
            </button>
          ) : (
            ring
          );
        })()}
        <div className="exec-side">
          {/* Gap → ringkasan posisi target (Executive detail). */}
          {onExpand ? (
            <button type="button" className="exec-cell cell-btn" onClick={onExpand} title="Lihat posisi target">
              <span className="ec-k">Gap ke Target</span>
              <span className="ec-v" style={{ color: "#D6453A" }}>
                {e.target2026 - bookingSnap}
              </span>
              <span className="ec-s">booking lagi menuju 500</span>
            </button>
          ) : (
            <div className="exec-cell">
              <span className="ec-k">Gap ke Target</span>
              <span className="ec-v" style={{ color: "#D6453A" }}>
                {e.target2026 - bookingSnap}
              </span>
              <span className="ec-s">booking lagi menuju 500</span>
            </div>
          )}
          {/* Akad 2026 terdata (menggantikan Pipeline Aktif). */}
          {onPick ? (
            <button type="button" className="exec-cell cell-btn" onClick={() => onPick("akad")} title={`Lihat ${e.akad} akad 2026`}>
              <span className="ec-k">Akad 2026</span>
              <span className="ec-v">{e.akad}</span>
              <span className="ec-s">akad terdata</span>
            </button>
          ) : (
            <div className="exec-cell">
              <span className="ec-k">Akad 2026</span>
              <span className="ec-v">{e.akad}</span>
              <span className="ec-s">akad terdata</span>
            </div>
          )}
        </div>
      </div>

      <div className="exec-kpis">
        {tile(e.proses, "Proses Menuju Akad", undefined, "proses")}
        {tile(prosesCash, "Proses Akad Cash", "#1F9D54", "proses")}
        {tile(prosesKpr, "Proses Akad KPR", "#D9930B", "proses")}
        {tile(e.batal, "Batal / Gugur", "#D6453A", "batal")}
      </div>

      <div className="exec-rev">
        <div className="er-main">
          <span className="er-k">Revenue Akad (Cash-In)</span>
          <span className="er-v">{rpShort(e.revenueAkad)}</span>
        </div>
        <div className="er-side">
          <div>
            <span className="er-k2">Potensi Pipeline</span>
            <b>{rpShort(e.potentialRevenue)}</b>
          </div>
          <div>
            <span className="er-k2">Ads Spent</span>
            <b>{rpShort(e.adsSpent)}</b>
          </div>
        </div>
      </div>

      <div className="exec-trend">
        <div className="et-head">
          <span>Akad per Bulan 2026</span>
          <span className="et-leg">
            <i className="lg-akad" />
            Akad <i className="lg-bk" />
            Booking
          </span>
        </div>
        <MiniBars data={d.monthly} height={56} />
      </div>
    </Card>
  );
}

/* ===================== PANEL 2 — MAIN FUNNEL ===================== */
/** Compact Indonesian number for the funnel bars (4.8jt / 214rb / 940). */
function shortNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/[.,]0$/, "").replace(".", ",") + "jt";
  if (abs >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/[.,]0$/, "").replace(".", ",") + "rb";
  return num(n);
}

/**
 * Full Funnel Control Tower — the end-to-end demand funnel from Impression to
 * Cash-In. Stages are data-driven (Master Data → Full Funnel), so it renders
 * however many stages exist. Bar heights use a log scale because values span
 * several orders of magnitude (jutaan impression → puluhan cash-in); the
 * step-to-step conversion under each bar turns red/amber when below its `std`.
 */
export function FunnelPanel({ d, onExpand }: PanelProps) {
  const f = d.funnel;
  if (f.length === 0)
    return <EmptyCard title="Full Funnel Control Tower" tag="Impression → Cash-In" onExpand={onExpand} />;

  const positives = f.map((s) => s.value).filter((v) => v > 0);
  const maxV = Math.max(...positives, 1);
  const minV = Math.min(...positives, 1);
  const lo = Math.log(minV + 1);
  const hi = Math.log(maxV + 1);
  const heightOf = (v: number) => (hi === lo ? 1 : 0.14 + 0.86 * ((Math.log(Math.max(v, 0) + 1) - lo) / (hi - lo)));
  // Three colour zones (awareness → qualification → closing) by position, so it
  // reads like the war-room without hard-coding any stage name.
  const zoneOf = (i: number) => {
    const z = f.length > 1 ? i / (f.length - 1) : 0;
    if (z < 0.5) return "linear-gradient(180deg,#3FA864,#0E5C34)";
    if (z < 0.78) return "linear-gradient(180deg,#2B5B7C,#163A52)";
    return "linear-gradient(180deg,#E0B23C,#C2912A)";
  };

  const e2e = f.length > 1 && f[0].value ? (f[f.length - 1].value / f[0].value) * 100 : null;
  let worst = -1;
  let worstConv = Infinity;
  f.forEach((_, i) => {
    const c = funnelConv(f, i);
    if (c != null && c < worstConv) {
      worstConv = c;
      worst = i;
    }
  });

  return (
    <Card
      title="Full Funnel Control Tower"
      tag="Impression → Cash-In"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h18l-7 8v6l-4 2v-8z" />
        </svg>
      }
      className="card-funnel"
    >
      <div className="ff-chart">
        {f.map((stage, i) => {
          const conv = funnelConv(f, i);
          let stKey: keyof typeof STATUS = "hijau";
          if (stage.std && conv != null) stKey = statusFor(conv, stage.std);
          const st = STATUS[stKey];
          return (
            <div className="ff-col" key={i}>
              <span className="ff-val">{stage.isMoney ? rpShort(stage.value) : shortNum(stage.value)}</span>
              <div className="ff-track">
                <div className="ff-bar" style={{ height: heightOf(stage.value) * 100 + "%", background: zoneOf(i) }} />
              </div>
              <span
                className="ff-conv"
                style={{ color: conv != null && stage.std ? st.c : "var(--muted)" }}
                title={stage.std ? "min " + stage.std + "%" : undefined}
              >
                {conv != null ? pct(conv, conv < 10 ? 1 : 0) : "100%"}
              </span>
              <span className="ff-name" title={stage.owner || stage.key}>
                {stage.key}
              </span>
            </div>
          );
        })}
      </div>
      <div className="funnel-note">
        {e2e != null && (
          <>
            <b>Konversi Impression → Cash-In: {pct(e2e, e2e < 1 ? 2 : 1)}</b>.{" "}
          </>
        )}
        {worst > 0 && (
          <>
            Bocor terbesar di <b>{f[worst - 1].key} → {f[worst].key}</b> ({pct(worstConv, worstConv < 10 ? 1 : 0)}).{" "}
          </>
        )}
        Tahap di bawah standar ditandai merah/kuning. Isi/ubah tahap lewat <b>Master Data → Full Funnel</b>.
      </div>
    </Card>
  );
}

/* ===================== PANEL 3 — LEAD QUALITY ===================== */
export function LeadQualityPanel({ d, onExpand }: PanelProps) {
  const f = d.funnel;
  if (f.length < 2)
    return <EmptyCard title="Lead Quality & Ads Efficiency" tag="Panel 3 · Kualitas Leads" onExpand={onExpand} />;
  const leads = f[0].value;
  const valid = f[1].value;
  return (
    <Card
      title="Lead Quality Analysis"
      tag="Panel 3 · Kualitas & Konversi Leads"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      }
      className="card-lq"
    >
      <div className="lq-rings">
        <div className="lq-ring">
          <Ring value={valid} max={leads} size={104} stroke={12} color="#1F9D54">
            <b className="lqr-v">{pct((valid / leads) * 100, 0)}</b>
            <span className="lqr-k">Valid</span>
          </Ring>
          <span className="lq-cap">
            {num(valid)} / {num(leads)}
          </span>
        </div>
        <div className="lq-ring">
          <Ring value={5.4} max={20} size={104} stroke={12} color="#D6453A">
            <b className="lqr-v" style={{ color: "#D6453A" }}>
              5,4%
            </b>
            <span className="lqr-k">Lead→CV</span>
          </Ring>
          <span className="lq-cap">target ≥20%</span>
        </div>
      </div>
      <div className="lq-stats">
        <div>
          <span>Total Leads</span>
          <b>{num(leads)}</b>
        </div>
        <div>
          <span>Unreachable</span>
          <b style={{ color: "#D6453A" }}>1.376</b>
        </div>
        <div>
          <span>Not Engaged</span>
          <b style={{ color: "#D9930B" }}>1.326</b>
        </div>
        <div>
          <span>Not Qualified</span>
          <b style={{ color: "#D9930B" }}>420</b>
        </div>
      </div>
    </Card>
  );
}

/* ===================== PANEL 4 — SALES PERFORMANCE ===================== */
export function SalesPanel({ d, onExpand }: PanelProps) {
  const ranked = [...d.sales].sort((a, b) => b.akad - a.akad || b.conv - a.conv).slice(0, 8);
  if (ranked.length === 0)
    return <EmptyCard title="Sales Performance" tag="Panel 4 · Ranking Akad" onExpand={onExpand} />;
  const maxA = ranked[0].akad || 1;
  return (
    <Card
      title="Sales Performance"
      tag={`Panel 4 · ${d.sales.length} Kontributor · Ranking Akad`}
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V3h12v6a6 6 0 0 1-12 0zM4 6h2M18 6h2M9 21h6M12 15v6" />
        </svg>
      }
      className="card-sales"
    >
      <div className="sales-list">
        {ranked.map((s, i) => (
          <div className="sl-row" key={s.name}>
            <span className="sl-rank" style={{ color: rankColor(i) }}>
              {i + 1}
            </span>
            <div className="sl-name">
              <b>{s.name}</b>
              <span className={"role role-" + s.role.toLowerCase()}>{s.role === "Agent" ? "Agent" : s.project}</span>
            </div>
            <div className="sl-bar">
              <div style={{ width: (s.akad / maxA) * 100 + "%", background: rankColor(i) }} />
            </div>
            <span className="sl-akad">{s.akad}</span>
            <span className="sl-conv" style={{ color: convColor(s.conv) }}>
              {s.conv}%
            </span>
          </div>
        ))}
      </div>
      <div className="sales-foot">
        <span>
          <b style={{ color: "#1F9D54" }}>Top:</b> {ranked[0].name} ({ranked[0].akad} akad · {ranked[0].conv}%)
        </span>
        <span>
          <b style={{ color: "#D6453A" }}>Coaching:</b>{" "}
          {[...d.sales]
            .filter((s) => s.total >= 3)
            .sort((a, b) => a.conv - b.conv)
            .slice(0, 2)
            .map((s) => s.name)
            .join(", ") || "—"}
        </span>
      </div>
    </Card>
  );
}

/* ===================== PANEL 5 — PROJECT MONITORING ===================== */
export function ProjectPanel({ d, onExpand, onPick }: PanelProps & { onPick?: (p: Project) => void }) {
  const ps = [...d.projects].sort((a, b) => b.rev - a.rev);
  if (ps.length === 0)
    return <EmptyCard title="Project Sales Monitoring" tag="Panel 5 · Mesin Utama vs Pembenahan" onExpand={onExpand} />;
  const maxRev = Math.max(...ps.map((p) => p.rev), 1);
  return (
    <Card
      title="Project Sales Monitoring"
      tag={`Panel 5 · ${d.projects.length} Project · Mesin Utama vs Pembenahan`}
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V8l5-4 5 4M14 21V11l5-3v13" />
        </svg>
      }
      className="card-project"
    >
      <div className="proj-list">
        {ps.map((p) => (
          <div className="proj-row" key={p.code} onClick={() => onPick && onPick(p)} title={p.name}>
            <div className="pr-cat" style={{ background: CAT[p.cat].c }} />
            <div className="pr-name">
              <b>{p.code}</b>
              <span>{p.name}</span>
            </div>
            <div className="pr-bar-wrap">
              <div className="pr-bar" style={{ width: Math.max(3, (p.rev / maxRev) * 100) + "%" }} />
            </div>
            <div className="pr-akad">
              <b>{p.akad}</b>
              <span>akad</span>
            </div>
            <div className="pr-rev">{p.rev ? rpShort(p.rev) : "—"}</div>
          </div>
        ))}
      </div>
      <div className="proj-legend">
        {(Object.entries(CAT) as [keyof typeof CAT, (typeof CAT)[keyof typeof CAT]][]).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: v.c }} />
            {v.label} · {d.projects.filter((p) => p.cat === k).length}
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ===================== PANEL 6 — CHANNELS / SUMBER ===================== */
export function ChannelPanel({ d, onExpand }: PanelProps) {
  const data = d.channels.map((c, i) => ({ label: c.name, value: c.total, color: CH_C[i] }));
  const tot = d.channels.reduce((a, c) => a + c.total, 0);
  return (
    <Card
      title="Sumber Penjualan"
      tag="Panel 6 · Channel Booking & Konversi"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10H12z" />
          <path d="M12 2v10h10A10 10 0 0 0 12 2z" />
        </svg>
      }
      className="card-chan"
    >
      <div className="chan-wrap">
        <div className="chan-donut">
          <Donut data={data} size={112} stroke={20} colors={CH_C} />
          <div className="chan-c">
            <b>{tot}</b>
            <span>booking</span>
          </div>
        </div>
        <div className="chan-list">
          {d.channels.map((c, i) => (
            <div className="ch-row" key={c.code}>
              <i style={{ background: CH_C[i] }} />
              <span className="ch-name">{c.name}</span>
              <span className="ch-v">{c.total}</span>
              <span className="ch-conv" style={{ color: c.conv >= 50 ? "#1F9D54" : "#D9930B" }}>
                {c.conv}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ===================== PANEL 7 — REASON CODE ===================== */
export function ReasonPanel({ d, onExpand }: PanelProps) {
  const top = [...d.reasons].sort((a, b) => b.count - a.count).slice(0, 6);
  if (top.length === 0)
    return <EmptyCard title="Opportunity Loss · Reason Code" tag="Panel 7 · 3-Layer · Kenapa Prospek Hilang" onExpand={onExpand} />;
  const max = top[0].count;
  return (
    <Card
      title="Opportunity Loss · Reason Code"
      tag="Panel 7 · 3-Layer · Kenapa Prospek Hilang"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 2 22h20z" />
          <path d="M12 9v5M12 18h.01" />
        </svg>
      }
      className="card-reason"
    >
      <div className="reason-list">
        {top.map((r) => (
          <div className="rs-row" key={r.layer + r.code} title={`${r.id} · ${r.layer} · ${num(r.count)} prospek`}>
            <span className="rs-code" style={{ background: LAYER_C[r.layer] }}>
              {r.code}
            </span>
            <span className="rs-name">{r.name}</span>
            <div className="rs-bar">
              <div style={{ width: (r.count / max) * 100 + "%", background: LAYER_C[r.layer] }} />
            </div>
            <span className="rs-count">{num(r.count)}</span>
          </div>
        ))}
      </div>
      <div className="reason-foot">
        <span>
          <i style={{ background: LAYER_C.L1 }} />
          L1 Leads→CV
        </span>
        <span>
          <i style={{ background: LAYER_C.L2 }} />
          L2 CV→PV
        </span>
        <span>
          <i style={{ background: LAYER_C.L3 }} />
          L3 PV→Booking
        </span>
      </div>
    </Card>
  );
}

/* ===================== PANEL 8 — BOOKING → AKAD → CASH-IN ===================== */
export function CashPanel({ d, onExpand, onPick }: PanelProps & { onPick?: (status: "akad" | "proses" | "batal" | null) => void }) {
  const e = d.exec;
  const baRate = (e.akad / e.booking) * 100;
  const stages: { k: string; v: number; c: string; status: "akad" | "proses" | "batal" | null }[] = [
    { k: "Booking", v: e.booking, c: "#0E5C34", status: null },
    { k: "Proses/KPR", v: e.proses, c: "#D9930B", status: "proses" },
    { k: "Akad", v: e.akad, c: "#1F9D54", status: "akad" },
    { k: "Batal", v: e.batal, c: "#D6453A", status: "batal" },
  ];
  return (
    <Card
      title="Booking → Akad → Cash-In"
      tag="Panel 8 · Kontrol Transaksi"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 15h4" />
        </svg>
      }
      className="card-cash"
    >
      <div className="cash-stages">
        {stages.map((s) => (
          <div
            className={"cs" + (onPick ? " cs-click" : "")}
            key={s.k}
            onClick={onPick ? (ev) => { ev.stopPropagation(); onPick(s.status); } : undefined}
            title={onPick ? "Klik untuk rincian transaksi" : undefined}
          >
            <span className="cs-v" style={{ color: s.c }}>
              {s.v}
            </span>
            <span className="cs-k">{s.k}</span>
          </div>
        ))}
      </div>
      <div className="cash-rate">
        <div className="cr-head">
          <span>Booking → Akad Rate</span>
          <b style={{ color: baRate >= 70 ? "#1F9D54" : "#D6453A" }}>{pct(baRate, 1)}</b>
        </div>
        <div className="cr-track">
          <div style={{ width: baRate + "%", background: baRate >= 70 ? "#1F9D54" : "#D9930B" }} />
          <div className="cr-tgt" style={{ left: "70%" }} title="target 70%" />
        </div>
        <span className="muted small">target ≥70%</span>
      </div>
      <div className="cash-money">
        <div>
          <span>Cash-In Aktual</span>
          <b style={{ color: "#1F9D54" }}>{rpShort(e.revenueAkad)}</b>
        </div>
        <div>
          <span>Potensi Pipeline</span>
          <b style={{ color: "#D9930B" }}>{rpShort(e.potentialRevenue)}</b>
        </div>
      </div>
    </Card>
  );
}

/* ===================== PANEL 9 — AGENT & EVENT ===================== */
export function AgentEventPanel({ d, onExpand }: PanelProps) {
  const a = d.agents;
  const ev = d.events.attributed;
  const agentAkad = a.reduce((x, y) => x + y.akad, 0);
  const contrib = d.exec.akad > 0 ? Math.round((agentAkad / d.exec.akad) * 1000) / 10 : 0;
  return (
    <Card
      title="Agent Performance"
      tag="Panel 9 · Kontribusi Eksternal"
      accent="#0E5C34"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      }
      className="card-agent"
    >
      <div className="ag-summary">
        <div className="ag-s">
          <b>{a.length}</b>
          <span>Agent Aktif</span>
        </div>
        <div className="ag-s">
          <b style={{ color: "#1F9D54" }}>{agentAkad}</b>
          <span>Akad Agent</span>
        </div>
        <div className="ag-s">
          <b>{contrib}%</b>
          <span>Kontribusi</span>
        </div>
      </div>
      <div className="ag-list">
        {a.map((x) => (
          <div className="ag-row" key={x.name}>
            <span className="ag-name">{x.name}</span>
            <span className="ag-proj muted">{x.project}</span>
            <span className="ag-akad">{x.akad} akad</span>
            <span className="ag-status" style={{ color: x.conv >= 60 ? "#1F9D54" : x.conv >= 33 ? "#D9930B" : "#D6453A" }}>
              {x.conv}%
            </span>
          </div>
        ))}
      </div>
      <div className="ag-event">
        <span className="age-k">Event / Walk-in (proxy)</span>
        <span className="age-v">
          {ev.booking} booking · {ev.akad} akad · {ev.conv}%
        </span>
      </div>
    </Card>
  );
}

/* ===================== PANEL 10 — AI ALERT & ACTION PLAN ===================== */
const ORDER: Record<string, number> = { merah: 0, kuning: 1, hijau: 2 };
/**
 * CEO Command Panel — the war-room's action board: every issue with its command
 * (recommended action), PIC, deadline and expected impact. Sorted by severity so
 * the most critical commands sit on top.
 */
export function AlertPanel({ d, onExpand }: PanelProps) {
  const sorted = [...d.alerts].sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  return (
    <Card
      title="CEO Command Panel"
      tag="Issue → PIC → Deadline"
      accent="#C0392B"
      onExpand={onExpand}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 0-7 7c0 3-1.5 4.5-2 5.5h18c-.5-1-2-2.5-2-5.5a7 7 0 0 0-7-7zM10 21a2 2 0 0 0 4 0" />
        </svg>
      }
      className="card-alert"
    >
      <div className="cmd-table">
        <div className="cmd-head">
          <span>ISSUE</span>
          <span>COMMAND</span>
          <span>PIC</span>
          <span>DL</span>
          <span>IMPACT</span>
        </div>
        {sorted.slice(0, 6).map((a, i) => (
          <div className="cmd-row" key={i}>
            <div className="cmd-issue">
              <b>{a.title}</b>
              {a.detail && <small>{a.detail}</small>}
            </div>
            <div className="cmd-cmd">{a.action}</div>
            <div className="cmd-pic">{a.pic}</div>
            <div className="cmd-dl">{a.deadline}</div>
            <div className="cmd-impact">
              {a.impact && <span>{a.impact}</span>}
              <i className="cmd-dot" style={{ background: SEV[a.sev].c }} title={SEV[a.sev].label} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
