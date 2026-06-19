import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useRealtimeSocket } from "@/lib/realtime";
import type { Alert, Cat, Dashboard, Exec, Project, ProjectView } from "./types";
import { api, AuthError } from "./api/client";
import { CAT, pct, rpShort } from "./lib/format";
import { Modal } from "./components/ui";
import {
  AgentEventPanel,
  AlertPanel,
  CashPanel,
  ChannelPanel,
  ExecutivePanel,
  FunnelPanel,
  LeadQualityPanel,
  ProjectPanel,
  ReasonPanel,
  SalesPanel,
} from "./components/panels";
import {
  AgentEventDetail,
  AlertDetail,
  CashDetail,
  ChannelDetail,
  ExecutiveDetail,
  FunnelDetail,
  LeadQualityDetail,
  ProjectDetail,
  ReasonDetail,
  SalesDetail,
} from "./components/details";
import "./controltower.css";

/**
 * Marketing "Control Tower" — the Qualified Demand war-room (ported from the
 * standalone greenparksales app) embedded as a Marketing view. It reads the
 * sales backend (:8085) directly; every Marketing user views it through a shared
 * read-only `viewer` account, so no per-user sales login is required.
 */
// The sales module signs in to its backend with the admin service account so
// the Master Data tab (upload / Google-Sheets sync) works; the Control Tower
// itself only reads. Access to /sales is already gated by the unified login.
const SALES_VIEWER = { user: "admin", pass: "admin123" };

interface Filter {
  cat: "all" | Cat;
  proj: string | null;
}

interface DrillDef {
  title: string;
  tag: string;
  render: (d: Dashboard) => ReactNode;
  wide?: boolean;
}

const DRILLS: Record<string, DrillDef> = {
  exec: { title: "Executive Sales Snapshot", tag: "Panel 1 · Posisi menuju target 500 unit", render: (d) => <ExecutiveDetail d={d} />, wide: true },
  funnel: { title: "Full Funnel Control Tower", tag: "Panel 2 · Impression → Cash-In", render: (d) => <FunnelDetail d={d} />, wide: true },
  project: { title: "Project Sales Monitoring", tag: "Panel 5 · Project monitoring", render: (d) => <ProjectDetail d={d} />, wide: true },
  sales: { title: "Sales Performance", tag: "Panel 4 · Ranking sales", render: (d) => <SalesDetail d={d} />, wide: true },
  lq: { title: "Lead Quality & Ads Efficiency", tag: "Panel 3 · Kualitas leads & cost/akad", render: (d) => <LeadQualityDetail d={d} />, wide: true },
  reason: { title: "Opportunity Loss · Reason Code", tag: "Panel 7 · 3-layer system", render: (d) => <ReasonDetail d={d} />, wide: true },
  cash: { title: "Booking → Akad → Cash-In", tag: "Panel 8 · Kontrol transaksi", render: (d) => <CashDetail d={d} /> },
  chan: { title: "Sumber Penjualan", tag: "Panel 6 · Channel performance", render: (d) => <ChannelDetail d={d} /> },
  agent: { title: "Agent Performance", tag: "Panel 9 · Kontribusi eksternal", render: (d) => <AgentEventDetail d={d} />, wide: true },
  alert: { title: "CEO Command Panel", tag: "Panel 10 · Issue → Command → PIC → Deadline → Impact", render: (d) => <AlertDetail d={d} />, wide: true },
};

/** Build a filtered copy of the dataset (project/category drives every panel). */
function applyFilter(base: Dashboard, filter: Filter): Dashboard & { _filtered: boolean } {
  if (filter.proj) {
    const projects = base.projects.filter((p) => p.code === filter.proj);
    const v = base.byProject?.[filter.proj];
    if (v) return { ...base, ...viewToDash(base, v), projects, _filtered: true };
    return { ...base, projects, _filtered: true };
  }
  if (filter.cat !== "all") {
    const projects = base.projects.filter((p) => p.cat === filter.cat);
    const views = projects.map((p) => base.byProject?.[p.code]).filter((x): x is ProjectView => !!x);
    if (views.length) return { ...base, ...viewToDash(base, mergeViews(views)), projects, _filtered: true };
    return { ...base, projects, _filtered: true };
  }
  return { ...base, _filtered: false };
}

/** Overlay a ProjectView onto the base dashboard (panels follow the project). */
function viewToDash(base: Dashboard, v: ProjectView): Partial<Dashboard> {
  return {
    exec: { ...base.exec, ...v.exec },
    funnel: v.funnel ?? [],
    channels: v.channels ?? [],
    sales: v.sales ?? [],
    reasons: v.reasons ?? [],
    agents: v.agents ?? [],
    monthly: v.monthly ?? [],
    events: v.events,
  };
}

/** Sum several per-project views into one (for a category filter). */
function mergeViews(views: ProjectView[]): ProjectView {
  const sumExec = views.reduce(
    (a, v) => {
      a.booking += v.exec.booking;
      a.akad += v.exec.akad;
      a.proses += v.exec.proses;
      a.batal += v.exec.batal;
      a.revenueAkad += v.exec.revenueAkad;
      a.potentialRevenue += v.exec.potentialRevenue;
      a.adsSpent += v.exec.adsSpent;
      return a;
    },
    { booking: 0, akad: 0, proses: 0, batal: 0, revenueAkad: 0, potentialRevenue: 0, adsSpent: 0 },
  );
  const exec: Exec = { ...views[0].exec, ...sumExec, totalPenjualan: sumExec.akad + sumExec.proses };

  const fkeys = (views[0].funnel ?? []).map((s) => s.key);
  const funnel = fkeys.map((key, i) => {
    const value = views.reduce((s, v) => s + (v.funnel?.[i]?.value ?? 0), 0);
    return { ...views[0].funnel[i], key, value };
  });

  // Sparse projects can have a null/missing collection (e.g. CMGP has no
  // `reasons`); coalesce each array so iterating never throws.
  const sumBy = <T, K extends string>(arrs: (T[] | null | undefined)[], keyOf: (t: T) => K, add: (acc: T, t: T) => T): T[] => {
    const m = new Map<K, T>();
    for (const arr of arrs)
      for (const t of arr ?? []) {
        const k = keyOf(t);
        m.set(k, m.has(k) ? add(m.get(k)!, t) : { ...t });
      }
    return [...m.values()];
  };

  const channels = sumBy(
    views.map((v) => v.channels),
    (c) => c.name,
    (a, c) => ({ ...a, total: a.total + c.total, akad: a.akad + c.akad }),
  ).map((c) => ({ ...c, conv: c.total ? Math.round((c.akad / c.total) * 100) : 0 }));

  const sales = sumBy(
    views.map((v) => v.sales),
    (s) => s.name,
    (a, s) => ({ ...a, akad: a.akad + s.akad, proses: a.proses + s.proses, batal: a.batal + s.batal, total: a.total + s.total, rev: (a.rev ?? 0) + (s.rev ?? 0) }),
  )
    .map((s) => ({ ...s, conv: s.total ? Math.round((s.akad / s.total) * 100) : 0 }))
    .sort((a, b) => b.akad - a.akad);

  const reasons = sumBy(
    views.map((v) => v.reasons),
    (r) => r.code,
    (a, r) => ({ ...a, count: a.count + r.count }),
  ).sort((a, b) => b.count - a.count);

  const agents = sumBy(
    views.map((v) => v.agents),
    (a) => a.name,
    (acc, a) => ({ ...acc, akad: acc.akad + a.akad, total: acc.total + a.total }),
  )
    .map((a) => ({ ...a, conv: a.total ? Math.round((a.akad / a.total) * 100) : 0 }))
    .sort((a, b) => b.akad - a.akad);

  const monthly = sumBy(
    views.map((v) => v.monthly),
    (m) => m.m,
    (a, m) => ({ ...a, akad: a.akad + m.akad, booking: a.booking + m.booking }),
  );

  const evB = views.reduce((s, v) => s + (v.events?.attributed?.booking ?? 0), 0);
  const evA = views.reduce((s, v) => s + (v.events?.attributed?.akad ?? 0), 0);
  const events = {
    attributed: { name: "Walk-in / Undangan", booking: evB, akad: evA, conv: evB ? Math.round((evA / evB) * 100) : 0 },
    note: views[0].events?.note ?? "",
  };

  return { exec, funnel, channels, sales, reasons, agents, monthly, events };
}

type LoadState =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: Dashboard; error: "" }
  | { status: "error"; data: null; error: string };

export function ControlTowerView({ fullScreen = false }: { fullScreen?: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: "" });

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    const fetchOnce = async () => {
      if (!api.hasToken()) await api.login(SALES_VIEWER.user, SALES_VIEWER.pass);
      return api.dashboard();
    };
    try {
      setState({ status: "ready", data: await fetchOnce(), error: "" });
    } catch (e) {
      // A stale/expired sales token (401) → re-login once with the viewer account.
      if (e instanceof AuthError) {
        try {
          await api.login(SALES_VIEWER.user, SALES_VIEWER.pass);
          setState({ status: "ready", data: await api.dashboard(), error: "" });
          return;
        } catch (e2) {
          setState({ status: "error", data: null, error: e2 instanceof Error ? e2.message : String(e2) });
          return;
        }
      }
      setState({ status: "error", data: null, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: the sales backend pushes on every data change (upload, master
  // edit, Sheets sync) — re-fetch the war-room instantly, no refresh needed.
  useRealtimeSocket(api.realtimeURL(), () => void load());

  // Embedded (inside the Marketing shell tab) renders at natural height + scroll;
  // full-screen (directors) renders the standalone 1920×1080 scaled war-room.
  const wrap = (inner: ReactNode) =>
    fullScreen ? <ScaledScreen>{inner}</ScaledScreen> : <div className="ct-scope embed">{inner}</div>;

  if (state.status === "loading") {
    return wrap(
      <div className="splash">
        <div className="spinner" />
        Memuat data sales…
      </div>,
    );
  }
  if (state.status === "error") {
    return wrap(
      <div className="splash error">
        <div className="splash-title">Gagal memuat data</div>
        <div className="splash-msg">{state.error}</div>
        <div className="splash-msg">API: {api.base}</div>
        <button className="splash-btn" onClick={() => void load()}>
          Coba lagi
        </button>
      </div>,
    );
  }

  return wrap(<DashboardBody base={state.data} fullScreen={fullScreen} />);
}

/** Fixed-canvas wrapper that scales the 1920×1080 war-room to fit the viewport,
 *  exactly like the standalone Control Tower app. */
function ScaledScreen({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      el.style.transform = `scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="ct-screen">
      <div className="ct-screen-canvas" ref={ref}>
        <div className="ct-scope">{children}</div>
      </div>
    </div>
  );
}

/** Standalone-style war-room header (brand + target progress + cash-in/booking). */
function CtHeader({ d }: { d: Dashboard }) {
  const { logout } = useAuth();
  const e = d.exec;
  const ach = e.target2026 ? (e.akad / e.target2026) * 100 : 0;
  return (
    <header className="gp-header">
      <div className="hdr-brand">
        <div className="hdr-logo">GP</div>
        <div className="hdr-titles">
          <h1>
            DASHBOARD SALES <span>· CEO WAR ROOM</span>
          </h1>
          <p>
            {d.period} &nbsp;·&nbsp; One Team · One System · One Goal: <b>500 Unit</b>
          </p>
        </div>
      </div>
      <div className="hdr-mid">
        <div className="hdr-target">
          <div className="ht-bar">
            <div className="ht-fill" style={{ width: ach + "%" }} />
            <span className="ht-mark" style={{ left: "20%" }} />
          </div>
          <div className="ht-meta">
            <span>
              <b>{e.akad}</b> akad
            </span>
            <span className="muted">/ {e.target2026} target</span>
            <span className="ht-pct">{pct(ach, 1)}</span>
          </div>
        </div>
      </div>
      <div className="hdr-right">
        <div className="hdr-stat">
          <span>Cash-In</span>
          <b>{rpShort(e.revenueAkad)}</b>
        </div>
        <div className="hdr-stat">
          <span>Booking</span>
          <b>{e.booking}</b>
        </div>
        <button className="gp-tool-btn ghost" onClick={() => void logout()}>
          Logout
        </button>
      </div>
    </header>
  );
}

function DashboardBody({ base, fullScreen = false }: { base: Dashboard; fullScreen?: boolean }) {
  const [filter, setFilter] = useState<Filter>({ cat: "all", proj: null });
  const [drill, setDrill] = useState<string | null>(null);
  const d = useMemo(() => applyFilter(base, filter), [base, filter]);

  // AI Alert & Action Plan (OpenRouter). Falls back server-side to the
  // rule-based alerts, so `aiAlerts` is always populated once loaded; until
  // then the panel shows the rule-based alerts baked into the dashboard.
  const [aiAlerts, setAiAlerts] = useState<Alert[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .aiAlerts()
      .then((r) => alive && setAiAlerts(r.alerts))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [base]);
  // Alerts are global (not per-filter); overlay the AI list onto the dataset.
  const da = useMemo(() => (aiAlerts ? { ...d, alerts: aiAlerts } : d), [d, aiAlerts]);

  const open = (k: string) => setDrill(k);
  const pickProject = (p: Project) => setFilter({ cat: "all", proj: p.code });

  const empty =
    (base.funnel?.length ?? 0) === 0 &&
    (base.projects?.length ?? 0) === 0 &&
    (base.sales?.length ?? 0) === 0;
  if (empty) {
    return (
      <div className="gp-root">
        <div className="empty-state">
          <div className="empty-emoji">📊</div>
          <div className="empty-title">Belum ada data dashboard</div>
          <div className="empty-msg">
            Data sales belum tersedia di backend. Isi melalui app Sales (Master Data / upload Excel).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gp-root">
      {fullScreen && <CtHeader d={base} />}
      <FilterBar projects={base.projects} filter={filter} setFilter={setFilter} />
      {d._filtered && (
        <div className="filter-flag">
          Menampilkan: <b>{filter.proj ? filter.proj : filter.cat !== "all" ? CAT[filter.cat].label : ""}</b> — angka snapshot, funnel & cash
          menyesuaikan project terpilih.{" "}
          <button onClick={() => setFilter({ cat: "all", proj: null })}>tampilkan semua</button>
        </div>
      )}

      <main className="bento">
        <div className="bento-col bento-col-1">
          <ExecutivePanel d={d} onExpand={() => open("exec")} />
          <CashPanel d={d} onExpand={() => open("cash")} />
        </div>
        <div className="bento-col bento-col-2">
          <FunnelPanel d={d} onExpand={() => open("funnel")} />
          <div className="bento-row">
            <LeadQualityPanel d={d} onExpand={() => open("lq")} />
            <ChannelPanel d={d} onExpand={() => open("chan")} />
          </div>
          <ReasonPanel d={d} onExpand={() => open("reason")} />
        </div>
        <div className="bento-col bento-col-3">
          <ProjectPanel d={d} onExpand={() => open("project")} onPick={pickProject} />
          <SalesPanel d={d} onExpand={() => open("sales")} />
        </div>
        <div className="bento-col bento-col-4">
          <AlertPanel d={da} onExpand={() => open("alert")} />
          <AgentEventPanel d={d} onExpand={() => open("agent")} />
        </div>
      </main>

      <Modal
        open={!!drill}
        title={drill ? DRILLS[drill].title : ""}
        tag={drill ? DRILLS[drill].tag : ""}
        wide={drill ? DRILLS[drill].wide : false}
        onClose={() => setDrill(null)}
      >
        {drill ? DRILLS[drill].render(drill === "alert" ? da : d) : null}
      </Modal>
    </div>
  );
}

function FilterBar({
  projects,
  filter,
  setFilter,
}: {
  projects: Project[];
  filter: Filter;
  setFilter: (f: Filter | ((f: Filter) => Filter)) => void;
}) {
  const cats: { k: "all" | Cat; label: string }[] = [
    { k: "all", label: "Semua Project" },
    { k: "utama", label: "Mesin Utama" },
    { k: "pendukung", label: "Pendukung" },
    { k: "pembenahan", label: "Pembenahan" },
  ];
  return (
    <div className="filter-bar">
      <span className="fb-label">Fokus:</span>
      <div className="fb-chips">
        {cats.map((c) => (
          <button
            key={c.k}
            className={"fb-chip" + (filter.cat === c.k ? " active" : "")}
            onClick={() => setFilter((f) => ({ ...f, cat: c.k, proj: null }))}
          >
            {c.k !== "all" && <i className={"fb-dot fb-" + c.k} />}
            {c.label}
          </button>
        ))}
      </div>
      <div className="fb-sep" />
      <select
        className="fb-select"
        value={filter.proj || ""}
        onChange={(e) => setFilter((f) => ({ ...f, proj: e.target.value || null }))}
      >
        <option value="">Semua Unit Bisnis</option>
        {projects.map((p) => (
          <option key={p.code} value={p.code}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      {(filter.cat !== "all" || filter.proj) && (
        <button className="fb-reset" onClick={() => setFilter({ cat: "all", proj: null })}>
          Reset
        </button>
      )}
    </div>
  );
}
