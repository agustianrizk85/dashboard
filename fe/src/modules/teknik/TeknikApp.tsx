import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DashboardData, ProyekMetric, KurvaWeek, Tone } from "./types";
import { api } from "./api/client";
import { useDashboard } from "./hooks/useDashboard";
import { Clock } from "./components/Clock";
import { Bar, Kpi, Panel, Pill } from "./components/ui";
import { INFO } from "./components/infoTips";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { MasterData } from "./master/MasterData";
import { SyncSpreadsheet } from "./master/SyncSpreadsheet";
import { AiInsight } from "./components/AiInsight";
import "../sales/sales.css"; // shared division shell chrome (green header + tabs)
import "./teknik.css"; // teknik dashboard content, scoped under .tk-scope
import { AiGenerateButton } from "@/ai/AiGenerate";

interface TabDef {
  id: string;
  label: string;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview" },
  { id: "deviasi", label: "Deviasi & SPI" },
  { id: "kpi", label: "KPI Direksi" },
  { id: "sync", label: "Sync Spreadsheet" },
  { id: "master", label: "Master Data" },
];

const roleLabel: Record<string, string> = {
  ceo: "Direktur Utama",
  dirops: "Direktur Operasional",
  kadep: "Kepala Departemen",
  viewer: "Viewer",
  admin: "Administrator",
};

/** Deviation status → pill tone. */
function statusTone(status: string): Tone {
  switch (status) {
    case "Sangat Cepat":
      return "neutral";
    case "Lebih Cepat":
    case "On Schedule":
      return "green";
    case "Warning":
      return "yellow";
    default:
      return "red";
  }
}

const pct = (v: number) => `${v.toFixed(1)}%`;
const rupiah = (v: number) =>
  v >= 1e9 ? `Rp ${(v / 1e9).toFixed(2)} M` : v >= 1e6 ? `Rp ${(v / 1e6).toFixed(0)} jt` : `Rp ${v.toLocaleString("id-ID")}`;

/**
 * Teknik division shell. Uses the SAME unified chrome as the other divisions
 * (green header + tab bar from the shared sales.css), with the Teknik dashboard
 * content rendered inside `.tk-scope` so its styles stay isolated. Auth is the
 * unified @/auth/AuthContext. All-access overview directors (CEO) + viewers see
 * only the dashboard views; the division's managers (+ Dirops) also get the
 * operational tabs (Sync Spreadsheet, Master Data).
 */
export default function TeknikApp() {
  const { user, logout } = useAuth();
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [state, reload] = useDashboard();
  const [rawTab, setRawTab] = useState<string>(() => localStorage.getItem("gp_tab") ?? "overview");
  const [sel, setSel] = useState<ProyekMetric | null>(null);

  // Never land a non-manager on an admin tab (e.g. a remembered "master"/"sync").
  const tab = !canManage && (rawTab === "master" || rawTab === "sync") ? "overview" : rawTab;
  const setTab = (t: string) => {
    setRawTab(t);
    try {
      localStorage.setItem("gp_tab", t);
    } catch {
      /* ignore */
    }
  };
  const visible = TABS.filter((t) => canManage || (t.id !== "sync" && t.id !== "master"));

  return (
    <div className="sales-stage">
      <div className="sales-canvas">
        <header className="hdr">
          <div className="hdr-logo">
            <img src="/brand/logo-mark.png" alt="Greenpark Group" />
          </div>
          <div className="hdr-titles">
            <h1>Dashboard Teknik</h1>
            <div className="sub">Greenpark Group · Departemen Teknik</div>
            <div className="tag">PROGRES · KURVA S · DEVIASI · SPI</div>
          </div>
          <div className="hdr-spacer" />
          <AiGenerateButton division="teknik" />
          <div className="hdr-meta">
            <Clock />
            <div className="hdr-user">
              <div className="hu-name">{user?.name}</div>
              <div className="hu-role">{user ? roleLabel[user.role] ?? user.role : ""}</div>
            </div>
            <button className="logout-btn" onClick={() => logout()} title="Keluar">
              ✕
            </button>
          </div>
        </header>

        <DivisionTabBar>
          {visible.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </DivisionTabBar>

        <main className="content">
          <div className="tk-scope">
            {state.status === "loading" ? (
              <div className="body">
                <div className="splash">
                  <div className="spinner" />
                  Memuat data teknik…
                </div>
              </div>
            ) : state.status === "error" ? (
              <div className="body">
                <div className="splash error">
                  <div className="splash-title">Gagal memuat data</div>
                  <div className="splash-msg">{state.error}</div>
                  <div className="splash-msg">API: {api.base}</div>
                  <button className="splash-btn" onClick={reload}>
                    Coba lagi
                  </button>
                </div>
              </div>
            ) : (
              <div className="body">
                {tab === "master" ? (
                  <MasterData />
                ) : tab === "sync" ? (
                  <SyncSpreadsheet />
                ) : tab === "deviasi" ? (
                  <DeviasiView D={state.data} onProject={setSel} />
                ) : tab === "kpi" ? (
                  <KpiView D={state.data} onProject={setSel} />
                ) : (
                  <Overview D={state.data} setTab={setTab} onProject={setSel} />
                )}
                {sel && <ProjectModal p={sel} D={state.data} onClose={() => setSel(null)} />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---- Overview ---------------------------------------------------------- */

function Overview({ D, setTab, onProject }: { D: DashboardData; setTab: (t: string) => void; onProject: (p: ProyekMetric) => void }) {
  const s = D.summary;
  const goDeviasi = () => setTab("deviasi");
  const attention = [...D.proyek]
    .filter((p) => p.status === "Critical Delay" || p.status === "Warning")
    .sort((a, b) => a.deviasi - b.deviasi);
  return (
    <>
      <div className="kpi-row">
        <Kpi label="Total Proyek" value={s.totalProyek} info={INFO.totalProyek} />
        <Kpi label="Total Unit" value={s.totalUnits} info={INFO.totalUnit} />
        <Kpi label="Total SPK" value={s.totalSpk} info={INFO.totalSpk} />
        <Kpi label="Overall Progress" value={pct(s.overall)} tone={s.overall >= 50 ? "ok" : "warn"} info={INFO.overall} />
        <Kpi label="On Schedule" value={s.onSchedule} tone="ok" onClick={goDeviasi} hint="Lihat detail" info={INFO.onSchedule} />
        <Kpi label="Warning" value={s.warning} tone="warn" onClick={goDeviasi} hint="Perlu dipantau →" info={INFO.warning} />
        <Kpi label="Critical Delay" value={s.critical} tone="bad" onClick={goDeviasi} hint="Butuh recovery →" info={INFO.critical} />
        <Kpi label="Avg SPI" value={s.avgSpi.toFixed(2)} tone={s.avgSpi >= 1 ? "ok" : "warn"} info={INFO.avgSpi} />
      </div>

      <Panel
        tag="BUTUH PERHATIAN"
        title={`${attention.length} Proyek Terlambat / Berisiko`}
        sub="klik kartu untuk detail & rekomendasi tindakan"
        info={INFO.attention}
        onExpand={goDeviasi}
      >
        {attention.length === 0 ? (
          <div className="tbl-empty">✓ Semua proyek on schedule.</div>
        ) : (
          <div className="attn-grid">
            {attention.map((p) => (
              <button key={p.id} className={`attn-card ${statusTone(p.status)}`} onClick={() => onProject(p)}>
                <div className="attn-top">
                  <span className="attn-name">{p.nama}</span>
                  <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                </div>
                <div className="attn-big">{p.lateWeeks > 0 ? `Telat ${p.lateWeeks.toFixed(1)} mgg` : `Deviasi ${p.deviasi.toFixed(1)}%`}</div>
                <div className="attn-sub">
                  Aktual {pct(p.aktual)} vs target {pct(p.target)} · {p.units} unit · {p.kontraktor || "—"}
                </div>
                <div className="attn-cta">Klik untuk detail & rekomendasi →</div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-2">
        <Panel tag="ALERT" title="Alert System" sub="Red · Yellow · Green — otomatis dari data" info={INFO.alert}>
          <AlertSystem D={D} />
        </Panel>
        <Panel tag="CEO COMMAND" title="CEO Command Panel" sub="Issue → Command → PIC → Deadline" info={INFO.ceo} onExpand={goDeviasi}>
          <CeoCommand rows={attention.slice(0, 8)} />
        </Panel>
      </div>

      <AiInsight scope="overview" label="Ringkasan Eksekutif" />
      <KurvaView D={D} />
      <div className="grid grid-2">
        <Panel tag="PROYEK" title="Progress per Proyek" sub={`${D.proyek.length} proyek · klik baris untuk detail`} info={INFO.proyekTable}>
          <ProyekTable rows={D.proyek} onRow={onProject} />
        </Panel>
        <Panel tag="KONTRAKTOR" title="Ranking Kontraktor" sub="berdasarkan jumlah SPK & nilai kontrak" info={INFO.kontraktorRank}>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>#</th><th>Kontraktor</th><th className="num">SPK</th><th className="num">Nilai Kontrak</th></tr>
              </thead>
              <tbody>
                {D.kontraktor.map((k, i) => (
                  <tr key={k.id}>
                    <td>{i + 1}</td>
                    <td>{k.nama}</td>
                    <td className="num">{k.units}</td>
                    <td className="num">{rupiah(k.nilai)}</td>
                  </tr>
                ))}
                {D.kontraktor.length === 0 && <tr><td colSpan={4} className="tbl-empty">Belum ada kontraktor.</td></tr>}
              </tbody>
            </table>
          </div>
          <AiInsight scope="kontraktor" label="Evaluasi Vendor" />
        </Panel>
      </div>
    </>
  );
}

function ProyekTable({ rows, onRow }: { rows: ProyekMetric[]; onRow?: (p: ProyekMetric) => void }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Proyek</th><th>Cluster</th><th>SPV</th><th className="num">Unit</th>
            <th className="num">Aktual</th><th className="num">Target</th><th className="num">Deviasi</th>
            <th className="num">SPI</th><th className="num">Telat (mgg)</th><th>Status</th><th>Kontraktor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={onRow ? "clickable" : ""} onClick={onRow ? () => onRow(p) : undefined}>
              <td><b>{p.nama}</b></td>
              <td>{p.clusterKode}</td>
              <td>{p.spv || "—"}</td>
              <td className="num">{p.units}</td>
              <td className="num">{pct(p.aktual)}</td>
              <td className="num">{pct(p.target)}</td>
              <td className="num" style={{ color: p.deviasi < -1 ? "var(--bad)" : p.deviasi >= 1 ? "var(--ok)" : undefined }}>
                {p.deviasi > 0 ? "+" : ""}{p.deviasi.toFixed(1)}
              </td>
              <td className="num">{p.spi.toFixed(2)}</td>
              <td className="num" style={{ color: p.lateWeeks > 0 ? "var(--bad)" : undefined }}>
                {p.lateWeeks > 0 ? `▲ ${p.lateWeeks.toFixed(1)}` : "—"}
              </td>
              <td><Pill tone={statusTone(p.status)}>{p.status}</Pill></td>
              <td>{p.kontraktor || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Kurva S ----------------------------------------------------------- */

/** Map a cumulative % onto the weekly Kurva S baseline → (fractional) week. */
function planWeekFE(kurva: KurvaWeek[], cum: number): number {
  if (cum <= 0 || !kurva.length) return 0;
  let pw = 0, pc = 0;
  for (const k of kurva) {
    if (k.cumulative >= cum) {
      const span = k.cumulative - pc;
      return span <= 0 ? k.week : pw + ((cum - pc) / span) * (k.week - pw);
    }
    pw = k.week;
    pc = k.cumulative;
  }
  return kurva[kurva.length - 1].week;
}

function statusColor(status: string): string {
  switch (status) {
    case "Sangat Cepat":
      return "#4a90d9";
    case "Lebih Cepat":
    case "On Schedule":
      return "var(--ok)";
    case "Warning":
      return "var(--warn)";
    default:
      return "var(--bad)";
  }
}

function KurvaView({ D }: { D: DashboardData }) {
  const [focus, setFocus] = useState<string>("all");
  const weeks = [...D.kurvaBaseline].sort((a, b) => a.week - b.week);
  const W = 760, H = 340, padL = 42, padB = 30, padT = 16, padR = 16;
  const maxWeek = weeks.length || 20;
  const x = (wk: number) => padL + ((Math.max(1, Math.min(maxWeek, wk)) - 1) / (maxWeek - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - padT - padB);
  const planPts = weeks.map((w) => `${x(w.week)},${y(w.cumulative)}`).join(" ");
  const dots = D.proyek.filter((p) => p.week > 0 && (focus === "all" || p.id === focus));
  const sel = D.proyek.find((p) => p.id === focus);

  // Filter per Unit (dihitung dari checklist + tgl SPK).
  const [unitFocus, setUnitFocus] = useState<string>("");
  const stageW = useMemo(() => Object.fromEntries(D.constructionStages.map((s) => [s.name, s.weight])), [D.constructionStages]);
  const proyUnits = useMemo(() => (sel ? D.progressUnits.filter((u) => u.project === sel.nama) : []), [sel, D.progressUnits]);
  const unitDot = useMemo(() => {
    const pu = proyUnits.find((u) => u.id === unitFocus);
    if (!pu) return null;
    const aktual = Object.entries(pu.stages).reduce((a, [k, v]) => a + (v ? stageW[k] ?? 0 : 0), 0);
    let week = 0;
    // SLA start = tgl ACC gambar kerja (acuan mulai vs Kurva S), fallback tgl SPK.
    const start = pu.tglAccGK || pu.tglSpk;
    if (start) {
      const days = (Date.now() - new Date(start).getTime()) / 86400000;
      if (!isNaN(days)) week = Math.min(maxWeek, Math.max(1, Math.floor(days / 7) + 1));
    }
    const target = week > 0 ? weeks.find((w) => w.week === week)?.cumulative ?? 0 : 0;
    return { blok: pu.blok, week, aktual, target };
  }, [proyUnits, unitFocus, stageW, weeks, maxWeek]);

  return (
    <Panel
      tag="KURVA S"
      title="Kurva S — Posisi Tiap Proyek vs Rencana"
      sub="garis biru = rencana baseline · tiap titik = 1 proyek pada minggu berjalannya · titik di bawah garis = tertinggal"
      info={INFO.kurva}
    >
      <div className="kurva-wrap">
        <div className="kurva-toolbar">
          <select value={focus} onChange={(e) => { setFocus(e.target.value); setUnitFocus(""); }}>
            <option value="all">Semua proyek ({dots.length})</option>
            {D.proyek.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
          {sel && (
            <select value={unitFocus} onChange={(e) => setUnitFocus(e.target.value)} title="Filter per unit">
              <option value="">— semua unit —</option>
              {proyUnits.map((u) => (
                <option key={u.id} value={u.id}>Blok {u.blok}</option>
              ))}
            </select>
          )}
          {sel && (
            <span className="kurva-selinfo">
              {sel.nama}: minggu ~{sel.week} · aktual {pct(sel.aktual)} · target {pct(sel.target)} ·{" "}
              <b style={{ color: statusColor(sel.status) }}>{sel.status}</b>
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="kurva-svg" preserveAspectRatio="xMidYMid meet">
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 6} y={y(g) + 3} textAnchor="end" className="kurva-axis">{g}</text>
            </g>
          ))}
          {weeks.filter((_, i) => i % 2 === 0).map((w) => (
            <text key={w.week} x={x(w.week)} y={H - padB + 16} textAnchor="middle" className="kurva-axis">M{w.week}</text>
          ))}
          {/* plan curve */}
          <polyline points={planPts} fill="none" stroke="#4a90d9" strokeWidth="2.5" />
          {/* per-project dots */}
          {dots.map((p) => (
            <g key={p.id}>
              {focus === p.id && (
                <line x1={x(p.week)} y1={y(p.target)} x2={x(p.week)} y2={y(p.aktual)} stroke={statusColor(p.status)} strokeDasharray="3 3" strokeWidth="1.5" />
              )}
              <circle cx={x(p.week)} cy={y(p.aktual)} r={focus === p.id ? 6 : 4} fill={statusColor(p.status)} stroke="#fff" strokeWidth="1">
                <title>{`${p.nama} — minggu ~${p.week}, aktual ${p.aktual.toFixed(1)}%, target ${p.target.toFixed(1)}%, deviasi ${p.deviasi.toFixed(1)} (${p.status})`}</title>
              </circle>
            </g>
          ))}
          {/* unit terpilih */}
          {unitDot && unitDot.week > 0 && (
            <g>
              <line x1={x(unitDot.week)} y1={y(unitDot.target)} x2={x(unitDot.week)} y2={y(unitDot.aktual)} stroke="#7b2ff7" strokeDasharray="3 3" strokeWidth="1.5" />
              <circle cx={x(unitDot.week)} cy={y(unitDot.aktual)} r="7" fill="#7b2ff7" stroke="#fff" strokeWidth="1.5">
                <title>{`Unit ${unitDot.blok} — minggu ~${unitDot.week}, aktual ${unitDot.aktual.toFixed(1)}%, target ${unitDot.target.toFixed(1)}%`}</title>
              </circle>
            </g>
          )}
        </svg>
        <div className="kurva-legend">
          <span><i className="lg-line" style={{ background: "#4a90d9" }} /> Rencana (baseline)</span>
          <span><i className="lg-dot" style={{ background: "var(--ok)" }} /> On/Ahead</span>
          <span><i className="lg-dot" style={{ background: "var(--warn)" }} /> Warning</span>
          <span><i className="lg-dot" style={{ background: "var(--bad)" }} /> Critical</span>
          {unitDot && <span><i className="lg-dot" style={{ background: "#7b2ff7" }} /> Unit terpilih</span>}
        </div>
      </div>
      <div className="tbl-scroll" style={{ marginTop: 12 }}>
        <table className="tbl">
          <thead><tr><th>Minggu</th><th className="num">Bobot Mingguan</th><th className="num">Target Kumulatif</th><th>Progres</th></tr></thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id}>
                <td>M{w.week}</td>
                <td className="num">{w.weight.toFixed(2)}%</td>
                <td className="num">{w.cumulative.toFixed(2)}%</td>
                <td style={{ minWidth: 160 }}><Bar value={w.cumulative} tone="green" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StageSchedule D={D} weeks={weeks} />
      <AiInsight scope="kurva" label="Narasi Jadwal" />
    </Panel>
  );
}

/** Jadwal Tahap: setiap tahap dipetakan ke perkiraan minggu & durasi dari bobot
 * kumulatif terhadap baseline Kurva S — menjawab "tahap X jatuh di minggu berapa". */
function StageSchedule({ D, weeks }: { D: DashboardData; weeks: KurvaWeek[] }) {
  const sorted = [...D.constructionStages].sort((a, b) => a.no - b.no);
  let cum = 0;
  const rows = sorted.map((s) => {
    const before = cum;
    cum += s.weight;
    const mulai = planWeekFE(weeks, before > 0 ? before : 0.01);
    const selesai = planWeekFE(weeks, cum);
    return { s, before, after: cum, mulai, selesai, durasi: Math.max(0, selesai - mulai) };
  });
  return (
    <div className="tbl-scroll" style={{ marginTop: 12 }}>
      <div className="kurva-subhead">Jadwal Tahap (perkiraan dari bobot vs Kurva S)</div>
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th><th>Tahap</th><th>Termin</th><th className="num">Bobot</th>
            <th className="num">Kumulatif</th><th className="num">Minggu</th><th className="num">Durasi (mgg)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.s.id}>
              <td>{r.s.no}</td>
              <td>{r.s.name}</td>
              <td>{r.s.termin}</td>
              <td className="num">{r.s.weight.toFixed(2)}%</td>
              <td className="num">{r.after.toFixed(2)}%</td>
              <td className="num">M{Math.round(r.mulai) || 1}–M{Math.round(r.selesai) || 1}</td>
              <td className="num">{r.durasi.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Deviasi & SPI ----------------------------------------------------- */

function DeviasiView({ D, onProject }: { D: DashboardData; onProject: (p: ProyekMetric) => void }) {
  const rows = [...D.proyek].sort((a, b) => a.deviasi - b.deviasi); // worst first
  const s = D.summary;
  return (
    <>
      <div className="kpi-row">
        <Kpi label="Avg Deviasi" value={`${s.avgDeviasi > 0 ? "+" : ""}${s.avgDeviasi.toFixed(1)}%`} tone={s.avgDeviasi < -1 ? "bad" : s.avgDeviasi >= 0 ? "ok" : "warn"} info={INFO.avgDeviasi} />
        <Kpi label="Avg SPI" value={s.avgSpi.toFixed(2)} tone={s.avgSpi >= 1 ? "ok" : "warn"} info={INFO.avgSpi} />
        <Kpi label="On Schedule" value={s.onSchedule} tone="ok" info={INFO.onSchedule} />
        <Kpi label="Warning" value={s.warning} tone="warn" info={INFO.warning} />
        <Kpi label="Critical Delay" value={s.critical} tone="bad" info={INFO.critical} />
      </div>
      <AiInsight scope="deviasi" label="Analisa Risiko & Recovery" />
      <Panel tag="DEVIASI" title="Deviasi & SPI per Proyek" sub="klik baris untuk detail · urut paling kritis dahulu" info={INFO.deviasiTable}>
        <ProyekTable rows={rows} onRow={onProject} />
      </Panel>
    </>
  );
}

/* ---- KPI Direksi / Control Tower --------------------------------------- */

function barTone(status: string): "green" | "yellow" | "red" {
  return status === "Warning" ? "yellow" : status === "Critical Delay" ? "red" : "green";
}

function KpiView({ D, onProject }: { D: DashboardData; onProject: (p: ProyekMetric) => void }) {
  const k = D.kpi;
  const q = D.quality;
  const kd = D.kontraktorDeviasi.slice(0, 12);
  const kritis = [...D.proyek].sort((a, b) => a.deviasi - b.deviasi).filter((p) => p.status !== "On Schedule" && p.status !== "Lebih Cepat" && p.status !== "Sangat Cepat").slice(0, 8);
  return (
    <>
      {/* KPI utama — 4 angka kunci direksi */}
      <div className="kpi-row kpi-row-4">
        <Kpi label="On-Time Completion" value={pct(k.onTimeCompletion)} unit={`(${k.proyekOnTime}/${k.proyekTotal})`} tone={k.onTimeCompletion >= 95 ? "ok" : k.onTimeCompletion >= 80 ? "warn" : "bad"} hint="target ≥95%" info={INFO.onTime} />
        <Kpi label="Overall Progress" value={pct(k.overall)} tone={k.overall >= 50 ? "ok" : "warn"} info={INFO.overall} />
        <Kpi label="Avg SPI" value={k.avgSpi.toFixed(2)} tone={k.avgSpi >= 1 ? "ok" : "warn"} hint="target ≥1.0" info={INFO.avgSpi} />
        <Kpi label="Avg Deviasi" value={`${k.avgDeviasi > 0 ? "+" : ""}${k.avgDeviasi.toFixed(1)}%`} tone={k.avgDeviasi < -1 ? "bad" : k.avgDeviasi >= 0 ? "ok" : "warn"} hint="target ±3%" info={INFO.avgDeviasi} />
      </div>

      <AiInsight scope="deviasi" label="Rekomendasi Direksi" />

      {/* Proyek paling kritis — kartu actionable */}
      <Panel tag="PRIORITAS" title={`${kritis.length} Proyek Paling Kritis`} sub="klik kartu untuk detail & rekomendasi tindakan" info={INFO.attention}>
        {kritis.length === 0 ? (
          <div className="tbl-empty">✓ Tidak ada proyek bermasalah.</div>
        ) : (
          <div className="attn-grid">
            {kritis.map((p) => (
              <button key={p.id} className={`attn-card ${statusTone(p.status)}`} onClick={() => onProject(p)}>
                <div className="attn-top">
                  <span className="attn-name">{p.nama}</span>
                  <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                </div>
                <div className="attn-big">{p.lateWeeks > 0 ? `Telat ${p.lateWeeks.toFixed(1)} mgg` : `Deviasi ${p.deviasi.toFixed(1)}%`}</div>
                <div className="attn-sub">Aktual {pct(p.aktual)} / target {pct(p.target)} · {p.units} unit · {p.kontraktor || "—"}</div>
                <div className="attn-cta">Klik untuk detail →</div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {/* Cluster — strip kartu ringkas (full width) */}
      <Panel tag="CLUSTER" title="Progres per Cluster" sub="agregat per kawasan" info={INFO.cluster}>
        <div className="ct-cards">
          {D.clusterMetrics.map((c) => (
            <div key={c.kode} className={`ct-card ${statusTone(c.status)}`}>
              <div className="ct-head">
                <span className="ct-kode">{c.kode}</span>
                <span className="ct-nama">{c.nama}</span>
                <Pill tone={statusTone(c.status)}>{c.status}</Pill>
              </div>
              <div className="ct-bar"><Bar value={c.aktual} tick={c.target} tone={barTone(c.status)} /></div>
              <div className="ct-meta">
                <span>{c.proyek} proyek · {c.units} unit</span>
                <span>Aktual <b>{pct(c.aktual)}</b> / target {pct(c.target)} · dev <b style={{ color: c.deviasi < -1 ? "var(--bad)" : "var(--ink)" }}>{c.deviasi > 0 ? "+" : ""}{c.deviasi.toFixed(1)}</b></span>
              </div>
            </div>
          ))}
          {D.clusterMetrics.length === 0 && <div className="tbl-empty">Belum ada data.</div>}
        </div>
      </Panel>

      {/* Kontraktor — tabel ringkas + bar (full width) */}
      <Panel tag="KONTRAKTOR" title="Deviasi per Kontraktor" sub="paling kritis dahulu (top 12)" info={INFO.kontraktorDev}>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Kontraktor</th><th className="num">Unit</th><th style={{ width: 180 }}>Aktual</th><th className="num">Deviasi</th><th className="num">SPI</th><th>Status</th></tr>
            </thead>
            <tbody>
              {kd.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.nama}</td>
                  <td className="num">{c.units}</td>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 38, fontVariantNumeric: "tabular-nums" }}>{Math.round(c.aktual)}%</span><Bar value={c.aktual} tone={barTone(c.status)} /></div></td>
                  <td className="num" style={{ color: c.deviasi < -1 ? "var(--bad)" : "var(--ink-2)" }}>{c.deviasi > 0 ? "+" : ""}{c.deviasi.toFixed(1)}</td>
                  <td className="num">{c.spi.toFixed(2)}</td>
                  <td><Pill tone={statusTone(c.status)}>{c.status}</Pill></td>
                </tr>
              ))}
              {kd.length === 0 && <tr><td colSpan={7} className="tbl-empty">Belum ada SPK ber-kontraktor.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Mutu */}
      <Panel tag="MUTU" title="Komplain & Defect" sub="komplain dari sheet · defect manual" info={INFO.mutu}>
        <div className="kpi-row kpi-row-4" style={{ marginTop: 4 }}>
          <Kpi label="Komplain Open" value={q.komplainOpen} unit={`/ ${q.komplainTotal}`} tone={q.komplainOpen > 0 ? "warn" : "ok"} />
          <Kpi label="Defect Open" value={q.defectOpen} unit={`/ ${q.defectTotal}`} tone={q.defectOpen > 0 ? "warn" : "ok"} />
          <Kpi label="Defect Berulang" value={q.defectRepeat} tone={q.defectRepeat > 0 ? "bad" : "ok"} />
          <Kpi label="Total Temuan" value={q.komplainTotal + q.defectTotal} />
        </div>
      </Panel>
    </>
  );
}

/* ---- Alert System & CEO Command (derived) ------------------------------ */

function AlertSystem({ D }: { D: DashboardData }) {
  const red = [
    ...D.proyek.filter((p) => p.status === "Critical Delay").map((p) => `${p.nama} · dev ${p.deviasi.toFixed(1)}% · telat ${p.lateWeeks.toFixed(1)} mgg`),
    ...(D.quality.komplainOpen > 0 ? [`${D.quality.komplainOpen} komplain belum selesai`] : []),
    ...(D.quality.defectRepeat > 0 ? [`${D.quality.defectRepeat} defect berulang`] : []),
  ];
  const yellow = D.proyek.filter((p) => p.status === "Warning").map((p) => `${p.nama} · dev ${p.deviasi.toFixed(1)}%`);
  const green = [
    `${D.summary.onSchedule} proyek on schedule`,
    `Overall ${pct(D.summary.overall)} · Avg SPI ${D.summary.avgSpi.toFixed(2)}`,
  ];
  const blocks = [
    { key: "red", title: "Red Alert", items: red, c: "var(--bad)" },
    { key: "yellow", title: "Yellow", items: yellow, c: "var(--warn)" },
    { key: "green", title: "Green Signal", items: green, c: "var(--ok)" },
  ];
  return (
    <div className="alert-cols">
      {blocks.map((b) => (
        <div key={b.key} className="alert-blk">
          <div className="alert-blk-hd" style={{ color: b.c }}>
            <span className="alert-dot" style={{ background: b.c }} />
            {b.title}
            <span className="alert-count">{b.items.length}</span>
          </div>
          <ul className="alert-list">
            {b.items.length === 0 ? <li className="alert-none">—</li> : b.items.map((it, i) => <li key={i} style={{ borderColor: b.c }}>{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CeoCommand({ rows }: { rows: ProyekMetric[] }) {
  if (rows.length === 0) return <div className="tbl-empty">✓ Tidak ada isu kritis.</div>;
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr><th>Issue</th><th>Command</th><th>PIC</th><th>Deadline</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const r = rekomendasi(p);
            return (
              <tr key={p.id}>
                <td><b>{p.nama}</b><div className="ceo-sub">{p.status} · dev {p.deviasi.toFixed(1)}%</div></td>
                <td>{r.aksi[0]}</td>
                <td className="ceo-nowrap">{p.kontraktor || p.spv || "—"}</td>
                <td className="ceo-nowrap">{p.status === "Critical Delay" ? "48 jam" : "Mingguan"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Project detail modal ---------------------------------------------- */

function rekomendasi(p: ProyekMetric): { judul: string; aksi: string[] } {
  if (p.status === "Critical Delay") {
    return {
      judul: "🔴 KRITIS — wajib tindakan segera",
      aksi: [
        "Buat Recovery Plan + Root Cause Analysis (wajib).",
        "Tambah tim/shift atau realokasi kontraktor.",
        "Eskalasi ke Manajemen; tetapkan target percepatan mingguan.",
      ],
    };
  }
  if (p.status === "Warning") {
    return {
      judul: "🟡 WARNING — pantau ketat",
      aksi: [
        "Cek tahap yang tertahan di Cek List Progress.",
        "Pastikan material & tukang cukup minggu ini.",
        "Bila deviasi membesar → siapkan Recovery Plan.",
      ],
    };
  }
  return { judul: "🟢 Aman — sesuai/di atas rencana", aksi: ["Pertahankan ritme.", "Dorong unit yang belum mulai agar terjadwal."] };
}

/** Per-unit breakdown row inside the project modal. Aktual = checklist %; Target
 * = Kurva S cumulative at the unit's elapsed week counted from TGL ACC GAMBAR
 * KERJA (SLA start, fallback tgl SPK) — the same "ACC gambar vs Kurva S" logic
 * the project metric uses, but per blok so you see exactly which units lag. */
interface UnitRow {
  id: string;
  blok: string;
  status: string;
  start: string;
  week: number;
  aktual: number;
  target: number;
  doneCount: number;
  pending: string[];
}

function ProjectModal({ p, D, onClose }: { p: ProyekMetric; D: DashboardData; onClose: () => void }) {
  const [openBlok, setOpenBlok] = useState<string>("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const stagesOrder = useMemo(() => [...D.constructionStages].sort((a, b) => a.no - b.no), [D.constructionStages]);
  const totalW = useMemo(() => D.constructionStages.reduce((a, s) => a + s.weight, 0) || 100, [D.constructionStages]);
  const weeks = useMemo(() => [...D.kurvaBaseline].sort((a, b) => a.week - b.week), [D.kurvaBaseline]);
  const maxWeek = weeks.length ? weeks[weeks.length - 1].week : 20;
  const targetAt = (start: string): { week: number; target: number } => {
    if (!start) return { week: 0, target: 0 };
    const days = (Date.now() - new Date(start).getTime()) / 86400000;
    if (isNaN(days)) return { week: 0, target: 0 };
    const week = Math.min(maxWeek, Math.max(1, Math.floor(days / 7) + 1));
    const target = weeks.find((w) => w.week >= week)?.cumulative ?? weeks[weeks.length - 1]?.cumulative ?? 0;
    return { week, target };
  };

  const rows = useMemo<UnitRow[]>(() => {
    const list = D.progressUnits
      .filter((u) => u.project === p.nama)
      .map<UnitRow>((u) => {
        const done = stagesOrder.filter((s) => u.stages?.[s.name]);
        const aktual = (done.reduce((a, s) => a + s.weight, 0) / totalW) * 100;
        const start = u.tglAccGK || u.tglSpk || "";
        const { week, target } = targetAt(start);
        return {
          id: u.id, blok: u.blok, status: u.status, start, week, aktual, target,
          doneCount: done.length, pending: stagesOrder.filter((s) => !u.stages?.[s.name]).map((s) => s.name),
        };
      });
    // Paling tertinggal dulu (deviasi aktual−target terkecil), lalu blok.
    list.sort((a, b) => (a.aktual - a.target) - (b.aktual - b.target) || a.blok.localeCompare(b.blok, undefined, { numeric: true }));
    return list;
  }, [D.progressUnits, p.nama, stagesOrder, totalW, weeks, maxWeek]);

  const belumMulai = rows.filter((u) => !u.start).length;
  const nol = rows.filter((u) => u.start && u.aktual <= 0.05).length;
  const selesai = rows.filter((u) => u.aktual >= 99.95).length;
  const berjalan = rows.length - belumMulai - nol - selesai;

  const r = rekomendasi(p);
  const stat = (label: string, value: ReactNode, tone?: "ok" | "warn" | "bad") => (
    <div className="pm-stat">
      <span className="pm-stat-l">{label}</span>
      <span className={`pm-stat-v ${tone ?? ""}`}>{value}</span>
    </div>
  );
  const rowTone = (u: UnitRow): "green" | "yellow" | "red" => {
    if (u.aktual >= 99.95) return "green";
    const dev = u.aktual - u.target;
    if (!u.start) return "yellow";
    return dev <= -5 ? "red" : dev <= -1 ? "yellow" : "green";
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-hd">
          <h2>{p.nama}</h2>
          <span className="mh-sub">{p.clusterKode} · SPV {p.spv || "—"} · {p.kontraktor || "kontraktor —"}</span>
          <span className="mh-sp" />
          <button className="mclose" onClick={onClose}>×</button>
        </header>
        <div className="modal-bd">
          <div className="pm-grid">
            {stat("Status", <Pill tone={statusTone(p.status)}>{p.status}</Pill>)}
            {stat("Unit", p.units)}
            {stat("Minggu berjalan", `~${p.week}`)}
            {stat("Aktual", pct(p.aktual), p.aktual >= p.target ? "ok" : undefined)}
            {stat("Target", pct(p.target))}
            {stat("Deviasi", `${p.deviasi > 0 ? "+" : ""}${p.deviasi.toFixed(1)}%`, p.deviasi < -1 ? "bad" : p.deviasi >= 1 ? "ok" : undefined)}
            {stat("SPI", p.spi.toFixed(2), p.spi >= 1 ? "ok" : "warn")}
            {stat("Keterlambatan", p.lateWeeks > 0 ? `${p.lateWeeks.toFixed(1)} mgg` : "—", p.lateWeeks > 0 ? "bad" : "ok")}
          </div>
          <div className={`pm-reco ${statusTone(p.status)}`}>
            <div className="pm-reco-h">{r.judul}</div>
            <ul>{r.aksi.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>

          {/* Rincian per unit — Aktual vs Target (ACC gambar kerja vs Kurva S) */}
          <div className="tbl-scroll" style={{ marginTop: 14, maxHeight: 340 }}>
            <div className="kurva-subhead">
              Rincian {rows.length} Unit · aktual vs target (acuan TGL ACC GAMBAR KERJA → Kurva S)
              {" — "}
              <b>{belumMulai}</b> belum ACC · <b>{nol}</b> mulai 0% · <b>{berjalan}</b> berjalan · <b style={{ color: "var(--ok)" }}>{selesai}</b> selesai
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Blok</th><th>Status</th><th className="num">Mgg</th>
                  <th style={{ width: 170 }}>Aktual</th><th className="num">Target</th><th className="num">Dev</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="tbl-empty">Tidak ada unit ter-checklist untuk proyek ini.</td></tr>}
                {rows.map((u) => {
                  const dev = u.aktual - u.target;
                  const open = openBlok === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr
                        className={u.pending.length > 0 ? "clickable" : ""}
                        onClick={u.pending.length > 0 ? () => setOpenBlok(open ? "" : u.id) : undefined}
                      >
                        <td><b>{u.blok}</b></td>
                        <td>{u.status || "—"}</td>
                        <td className="num">{u.start ? `~${u.week}` : "—"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 34, fontVariantNumeric: "tabular-nums" }}>{u.aktual.toFixed(0)}%</span>
                            <Bar value={u.aktual} tick={u.target} tone={rowTone(u)} />
                          </div>
                        </td>
                        <td className="num">{u.start ? `${u.target.toFixed(0)}%` : "—"}</td>
                        <td className="num" style={{ color: dev < -1 ? "var(--bad)" : dev >= 1 ? "var(--ok)" : undefined }}>
                          {u.start ? `${dev > 0 ? "+" : ""}${dev.toFixed(0)}` : "—"}
                        </td>
                        <td>{u.pending.length === 0 ? "✓" : open ? "▲" : "▼"}</td>
                      </tr>
                      {open && u.pending.length > 0 && (
                        <tr>
                          <td colSpan={7} style={{ background: "rgba(0,0,0,0.02)" }}>
                            <div style={{ fontSize: 12, lineHeight: 1.6, padding: "2px 2px" }}>
                              <b>Belum dikerjakan ({u.pending.length}):</b> {u.pending.join(" · ")}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
