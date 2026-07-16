import { useMemo, useState } from "react";
import type { Dashboard, Metrics, NameCount, Ticket } from "./types";
import { api } from "./api/client";
import { useDashboard } from "./hooks/useDashboard";
import { Bar, Clock, Kpi, Panel } from "./components/ui";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { SyncSpreadsheet } from "./master/SyncSpreadsheet";
import { TicketsView } from "./TicketsView";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { CsoOverviewWms } from "./CsoOverviewWms";
import "../sales/sales.css"; // shared division chrome (green header + tabs)
import "./cso.css"; // CSO dashboard content, scoped under .cso-scope

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "kurva", label: "Kurva-S" },
  { id: "ranking", label: "Ranking" },
  { id: "tiket", label: "Tiket WA" },
  { id: "sync", label: "Sync Spreadsheet" },
];

const roleLabel: Record<string, string> = {
  ceo: "Direktur Utama",
  dirops: "Direktur Operasional",
  kadep: "Kepala Departemen",
  viewer: "Viewer",
  admin: "Administrator",
};

const pct = (v: number) => `${v.toFixed(1)}%`;
const slaTone = (v: number): "ok" | "warn" | "bad" => (v >= 90 ? "ok" : v >= 75 ? "warn" : "bad");

const WMS_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "kurva", label: "Kurva-S" },
  { key: "ranking", label: "Ranking" },
  { key: "tiket", label: "Tiket WA" },
  { key: "sync", label: "Sync Spreadsheet" },
];

/**
 * CSO division entry. All-access directors (CEO / Dirops) keep the existing
 * dashboard UI unchanged; staff & kadep get the new WMS "Ops Console" redesign.
 */
export default function CsoApp() {
  const { user } = useAuth();
  const wms = !user?.allAccess;
  return wms ? <CsoWms /> : <CsoClassic />;
}

/**
 * WMS "Ops Console" chrome for CSO staff/kadep — the shared shell with the CSO
 * sections in the sidebar. The Overview section is the new WMS-style dashboard;
 * every other section reuses the existing views, scoped under `.cso-scope`. All
 * tabs/functionality are preserved.
 */
function CsoWms() {
  const { user } = useAuth();
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [state] = useDashboard();
  const [rawTab, setRawTab] = useState<string>(() => localStorage.getItem("gp_cso_tab") ?? "overview");
  const tab = !canManage && rawTab === "sync" ? "overview" : rawTab;
  const setTab = (t: string) => {
    setRawTab(t);
    try {
      localStorage.setItem("gp_cso_tab", t);
    } catch {
      /* ignore */
    }
  };
  const visible = WMS_SECTIONS.filter((t) => canManage || t.key !== "sync");
  const groups: WmsNavGroup[] = [
    {
      heading: "Menu",
      items: visible.map((sec) => ({ label: sec.label, active: tab === sec.key, onClick: () => setTab(sec.key) })),
    },
  ];

  return (
    <WmsShell brand="CSO" brandSub="Customer Complaint" nav={groups}>
      <div className="cso-scope">
        {state.status === "loading" ? (
          <div className="body">
            <div className="splash">
              <div className="spinner" />
              Memuat data komplain…
            </div>
          </div>
        ) : state.status === "error" ? (
          <div className="body">
            <div className="splash error">
              <div className="splash-title">Gagal memuat data</div>
              <div className="splash-msg">{state.error}</div>
              <div className="splash-msg">API: {api.base}</div>
            </div>
          </div>
        ) : (
          <div className="body">
            {tab === "sync" ? (
              <SyncSpreadsheet />
            ) : tab === "tiket" ? (
              <TicketsView tickets={state.data.tickets ?? []} canManage={canManage} />
            ) : tab === "ranking" ? (
              <RankingView D={state.data} />
            ) : tab === "kurva" ? (
              <KurvaView D={state.data} />
            ) : (
              <CsoOverviewWms D={state.data} setTab={setTab} />
            )}
          </div>
        )}
      </div>
    </WmsShell>
  );
}

/**
 * CSO (Customer Complaint) division shell. Same unified chrome as the other
 * divisions (green header + tab bar from sales.css), dashboard content scoped
 * under `.cso-scope`. Data comes from the CSO backend (:8088), fed by async
 * Google-Sheets sync of GREENPARK_CSO_MASTER_DATA and live WhatsApp tickets.
 */
function CsoClassic() {
  const { user, logout } = useAuth();
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [state] = useDashboard();
  const [rawTab, setRawTab] = useState<string>(() => localStorage.getItem("gp_cso_tab") ?? "overview");

  const tab = !canManage && rawTab === "sync" ? "overview" : rawTab;
  const setTab = (t: string) => {
    setRawTab(t);
    try {
      localStorage.setItem("gp_cso_tab", t);
    } catch {
      /* ignore */
    }
  };
  const visible = TABS.filter((t) => canManage || t.id !== "sync");

  return (
    <div className="sales-stage">
      <div className="sales-canvas">
        <header className="hdr">
          <div className="hdr-logo">
            <img src="/brand/logo-mark.png" alt="Greenpark Group" />
          </div>
          <div className="hdr-titles">
            <h1>Dashboard CSO</h1>
            <div className="sub">Greenpark Group · Customer Complaint</div>
            <div className="tag">KOMPLAIN · SLA · KURVA-S · RANKING</div>
          </div>
          <div className="hdr-spacer" />
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
          <div className="cso-scope">
            {state.status === "loading" ? (
              <div className="body">
                <div className="splash">
                  <div className="spinner" />
                  Memuat data komplain…
                </div>
              </div>
            ) : state.status === "error" ? (
              <div className="body">
                <div className="splash error">
                  <div className="splash-title">Gagal memuat data</div>
                  <div className="splash-msg">{state.error}</div>
                  <div className="splash-msg">API: {api.base}</div>
                </div>
              </div>
            ) : (
              <div className="body">
                {tab === "sync" ? (
                  <SyncSpreadsheet />
                ) : tab === "tiket" ? (
                  <TicketsView tickets={state.data.tickets ?? []} canManage={canManage} />
                ) : tab === "ranking" ? (
                  <RankingView D={state.data} />
                ) : tab === "kurva" ? (
                  <KurvaView D={state.data} />
                ) : (
                  <Overview D={state.data} setTab={setTab} />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---- Overview ---------------------------------------------------------- */

function delta(now: number, last: number): string {
  const d = now - last;
  if (d === 0) return "±0";
  return d > 0 ? `▲ +${d}` : `▼ ${d}`;
}

function Overview({ D, setTab }: { D: Dashboard; setTab: (t: string) => void }) {
  const s = D.ini;
  const l = D.lalu;
  const topCat = (D.kategori ?? [])[0];
  const topProj = (D.proyek ?? [])[0];
  return (
    <>
      <AlertBanner D={D} />

      <div className="kpi-row">
        <Kpi label={`Total Komplain ${D.yearNow || ""}`} value={s.total} delta={delta(s.total, l.total) + ` vs ${D.yearLast || "thn lalu"}`} tone={s.total > l.total ? "warn" : "ok"} />
        <Kpi label="Selesai (Complete)" value={s.complete} unit={`/ ${s.total}`} tone="ok" />
        <Kpi label="Sudah BAST" value={s.afterBast} />
        <Kpi label="Belum Selesai" value={s.notDone} tone={s.notDone > 3 ? "bad" : "ok"} onClick={() => setTab("tiket")} hint="lihat tiket" />
        <Kpi label="SLA Tepat Waktu" value={pct(s.slaPct)} tone={slaTone(s.slaPct)} hint="Critical≤2h · Major≤5h · Minor≤7h" />
        <Kpi label="Terlambat > Thr.1" value={s.lateT1} tone={s.lateT1 > 0 ? "warn" : "ok"} />
        <Kpi label="Terlambat > Thr.2" value={s.lateT2} tone={s.lateT2 > 0 ? "bad" : "ok"} />
      </div>

      <div className="grid grid-2">
        <Panel tag="PROPORSI" title="Proporsi Penyelesaian" sub={`${D.yearNow} vs ${D.yearLast}`}>
          <div className="donut-row">
            <Donut title={String(D.yearNow || "Tahun Ini")} done={s.complete} open={s.notDone} />
            <Donut title={String(D.yearLast || "Tahun Lalu")} done={l.complete} open={l.notDone} />
          </div>
        </Panel>

        <Panel tag="PERBANDINGAN" title="Tahun Ini vs Tahun Lalu" sub="ringkasan eksekutif">
          <CompareTable now={s} last={l} yearNow={D.yearNow} yearLast={D.yearLast} />
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel tag="DEFECT" title="Kategori Defect Teratas" sub="dari Section 3.1" onExpand={() => setTab("ranking")}>
          <RankTable rows={(D.kategori ?? []).slice(0, 6).map((c) => ({ nama: c.kategori, jumlah: c.jumlah, rank: c.rank }))} col="Kategori" />
          {topCat && <div className="hintline">Terbanyak: <b>{topCat.kategori}</b> ({topCat.jumlah} tiket)</div>}
        </Panel>
        <Panel tag="PROYEK" title="Proyek dengan Komplain Terbanyak" sub="dari DATA_PENDUKUNG" onExpand={() => setTab("ranking")}>
          <RankTable rows={(D.proyek ?? []).slice(0, 6)} col="Proyek" />
          {topProj && <div className="hintline">Fokus: <b>{topProj.nama}</b> ({topProj.jumlah} tiket)</div>}
        </Panel>
      </div>

      <div className="srcline">
        Sumber: {D.source || "—"} · diperbarui {D.updatedAt ? new Date(D.updatedAt).toLocaleString("id-ID") : "—"} · filter ranking {D.dateRange.awal || "—"} s/d {D.dateRange.akhir || "—"}
      </div>
    </>
  );
}

function AlertBanner({ D }: { D: Dashboard }) {
  const below = D.ini.slaPct > 0 && D.ini.slaPct < 90;
  const drop = D.lalu.slaPct - D.ini.slaPct;
  return (
    <div className={`alert-banner ${below ? "bad" : "ok"}`}>
      <span className="ab-dot" />
      {below ? (
        <span>
          <b>SLA {pct(D.ini.slaPct)}</b> di bawah target 90% — turun {drop.toFixed(1)} poin dari {D.yearLast} ({pct(D.lalu.slaPct)}). Belum selesai <b>{D.ini.notDone}</b> tiket.
        </span>
      ) : (
        <span>
          SLA {pct(D.ini.slaPct)} · {D.ini.complete}/{D.ini.total} komplain selesai · {D.ini.notDone} belum selesai.
        </span>
      )}
    </div>
  );
}

function CompareTable({ now, last, yearNow, yearLast }: { now: Metrics; last: Metrics; yearNow: number; yearLast: number }) {
  const rows: [string, number | string, number | string][] = [
    ["Total Komplain", now.total, last.total],
    ["Selesai (Complete)", now.complete, last.complete],
    ["Sudah BAST", now.afterBast, last.afterBast],
    ["In Progress Pembangunan", now.inProgress, last.inProgress],
    ["Belum Selesai", now.notDone, last.notDone],
    ["SLA Tepat Waktu", pct(now.slaPct), pct(last.slaPct)],
    ["Terlambat > Threshold 1", now.lateT1, last.lateT1],
    ["Terlambat > Threshold 2", now.lateT2, last.lateT2],
  ];
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Metrik</th>
            <th className="num">{yearNow || "Tahun Ini"}</th>
            <th className="num">{yearLast || "Tahun Lalu"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num"><b>{a}</b></td>
              <td className="num">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Donut ------------------------------------------------------------- */

function Donut({ title, done, open }: { title: string; done: number; open: number }) {
  const total = done + open;
  const frac = total > 0 ? done / total : 0;
  const R = 42, C = 2 * Math.PI * R;
  return (
    <div className="donut">
      <svg viewBox="0 0 110 110" className="donut-svg">
        <circle cx="55" cy="55" r={R} className="donut-track" />
        <circle
          cx="55"
          cy="55"
          r={R}
          className="donut-val"
          strokeDasharray={`${C * frac} ${C}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="52" textAnchor="middle" className="donut-pct">{(frac * 100).toFixed(0)}%</text>
        <text x="55" y="68" textAnchor="middle" className="donut-lbl">selesai</text>
      </svg>
      <div className="donut-cap">
        <div className="dc-title">{title}</div>
        <div className="dc-sub"><span className="ok">{done} selesai</span> · <span className="bad">{open} belum</span></div>
      </div>
    </div>
  );
}

/* ---- Kurva-S ----------------------------------------------------------- */

function KurvaView({ D }: { D: Dashboard }) {
  const weeks = useMemo(() => [...D.kurva].sort((a, b) => a.week - b.week), [D.kurva]);
  const [metric, setMetric] = useState<"total" | "late">("total");
  const W = 820, H = 340, padL = 34, padB = 28, padT = 16, padR = 12;
  const maxWeek = weeks.length || 53;
  const iniVals = weeks.map((w) => (metric === "total" ? w.totalIni : w.lateIni));
  const laluVals = weeks.map((w) => (metric === "total" ? w.totalLalu : w.lateLalu));
  const maxY = Math.max(1, ...iniVals, ...laluVals);
  const x = (wk: number) => padL + ((Math.max(1, wk) - 1) / (maxWeek - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);
  const line = (vals: number[]) => weeks.map((w, i) => `${x(w.week)},${y(vals[i])}`).join(" ");

  const cumIni = iniVals.reduce((a, b) => a + b, 0);
  const cumLalu = laluVals.reduce((a, b) => a + b, 0);

  return (
    <Panel tag="KURVA-S" title="Diagram Komplain per Minggu" sub={`${D.yearNow} (garis hijau) vs ${D.yearLast} (garis abu) — ${metric === "total" ? "jumlah komplain" : "jumlah terlambat"}`}>
      <div className="kurva-toolbar">
        <select value={metric} onChange={(e) => setMetric(e.target.value as "total" | "late")}>
          <option value="total">Jumlah Komplain</option>
          <option value="late">Jumlah Terlambat</option>
        </select>
        <span className="kurva-selinfo">
          Total {D.yearNow}: <b>{cumIni}</b> · Total {D.yearLast}: <b>{cumLalu}</b>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="kurva-svg" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(maxY * g)} x2={W - padR} y2={y(maxY * g)} className="kurva-grid" />
            <text x={padL - 5} y={y(maxY * g) + 3} textAnchor="end" className="kurva-axis">{Math.round(maxY * g)}</text>
          </g>
        ))}
        {weeks.filter((_, i) => i % 4 === 0).map((w) => (
          <text key={w.week} x={x(w.week)} y={H - padB + 16} textAnchor="middle" className="kurva-axis">M{w.week}</text>
        ))}
        <polyline points={line(laluVals)} fill="none" stroke="#9aa5b1" strokeWidth="2" strokeDasharray="4 3" />
        <polyline points={line(iniVals)} fill="none" stroke="#1f9d55" strokeWidth="2.6" />
        {weeks.map((w, i) => (
          <circle key={w.week} cx={x(w.week)} cy={y(iniVals[i])} r={iniVals[i] > 0 ? 3 : 0} fill="#1f9d55">
            <title>{`M${w.week} ${D.yearNow}: ${iniVals[i]}`}</title>
          </circle>
        ))}
      </svg>
      <div className="kurva-legend">
        <span><i className="lg-line" style={{ background: "#1f9d55" }} /> {D.yearNow || "Tahun Ini"}</span>
        <span><i className="lg-line dash" style={{ background: "#9aa5b1" }} /> {D.yearLast || "Tahun Lalu"}</span>
      </div>
      <div className="tbl-scroll" style={{ marginTop: 12, maxHeight: 320 }}>
        <table className="tbl">
          <thead>
            <tr><th>Minggu</th><th className="num">Komplain {D.yearNow}</th><th className="num">Komplain {D.yearLast}</th><th className="num">Terlambat {D.yearNow}</th><th className="num">Terlambat {D.yearLast}</th></tr>
          </thead>
          <tbody>
            {weeks.filter((w) => w.totalIni || w.totalLalu || w.lateIni || w.lateLalu).map((w) => (
              <tr key={w.week}>
                <td>M{w.week}</td>
                <td className="num">{w.totalIni}</td>
                <td className="num">{w.totalLalu}</td>
                <td className="num">{w.lateIni}</td>
                <td className="num">{w.lateLalu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---- Ranking ----------------------------------------------------------- */

function RankingView({ D }: { D: Dashboard }) {
  return (
    <>
      <Panel tag="3.1" title="Ranking Kategori Defect / Komplain" sub={`filter ${D.dateRange.awal || "—"} s/d ${D.dateRange.akhir || "—"}`}>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Rank</th><th>Kategori</th><th>Kata Kunci</th><th className="num">Jumlah</th><th style={{ width: 160 }}></th></tr></thead>
            <tbody>
              {[...(D.kategori ?? [])].sort((a, b) => b.jumlah - a.jumlah).map((c, i) => {
                const max = Math.max(1, ...(D.kategori ?? []).map((k) => k.jumlah));
                return (
                  <tr key={c.kategori}>
                    <td>{i + 1}</td>
                    <td><b>{c.kategori}</b></td>
                    <td>{c.kataKunci || "—"}</td>
                    <td className="num">{c.jumlah}</td>
                    <td><Bar value={(c.jumlah / max) * 100} tone={i === 0 ? "red" : "green"} /></td>
                  </tr>
                );
              })}
              {(D.kategori ?? []).length === 0 && <tr><td colSpan={5} className="tbl-empty">Belum ada data kategori.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-2">
        <Panel tag="3.2" title="Ranking Proyek" sub={`${(D.proyek ?? []).length} proyek`}>
          <RankTable rows={D.proyek ?? []} col="Proyek" showBar />
        </Panel>
        <Panel tag="3.3" title="Ranking Vendor" sub={`${(D.vendor ?? []).length} vendor terisi`}>
          <RankTable rows={D.vendor ?? []} col="Vendor" showBar />
        </Panel>
      </div>
    </>
  );
}

function RankTable({ rows, col, showBar }: { rows: NameCount[]; col: string; showBar?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.jumlah));
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr><th>#</th><th>{col}</th><th className="num">Jumlah</th>{showBar && <th style={{ width: 140 }}></th>}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.nama + i}>
              <td>{r.rank || i + 1}</td>
              <td>{r.nama}</td>
              <td className="num">{r.jumlah}</td>
              {showBar && <td><Bar value={(r.jumlah / max) * 100} tone={i === 0 ? "red" : "green"} /></td>}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={showBar ? 4 : 3} className="tbl-empty">Belum ada data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export type { Ticket };
