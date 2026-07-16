import { useCallback, useEffect, useState } from "react";
import { useAiGrounding } from "@/ai/AiAssistant";
import { useRealtimeSocket } from "@/lib/realtime";
import type { Dashboard, Purchasing, Summary } from "../types";
import { api, AuthError } from "../api/client";
import { KpiRowWms } from "./sections/KpiRowWms";
import { AchievementWms } from "./sections/AchievementWms";
import { MonthlyWms } from "./sections/MonthlyWms";
import { ProjectWms } from "./sections/ProjectWms";
import { BankWms } from "./sections/BankWms";
import { SalesWms } from "./sections/SalesWms";
import { PayMixWms } from "./sections/PayMixWms";
import { PipelineWms } from "./sections/PipelineWms";
import { PurchasingWms } from "./sections/PurchasingWms";
import { AlertWms } from "./sections/AlertWms";

// Shared finance service account (same as the war-room view) — every dashboard
// user reads the keuangan backend (:8084) through it.
const FIN_USER = { user: "admin", pass: "admin123" };

/** Null-safe payload coercion (Go serialises empty slices as JSON null). */
function normalizeDashboard(d: Dashboard): Dashboard {
  const arr = <T,>(x: T[] | null | undefined): T[] => (Array.isArray(x) ? x : []);
  return {
    ...d,
    years: arr(d.years),
    funnel: arr(d.funnel),
    monthly: arr(d.monthly),
    projects: arr(d.projects),
    banks: arr(d.banks),
    sales: arr(d.sales),
    payMix: arr(d.payMix),
    pipeline: arr(d.pipeline),
    akads: arr(d.akads),
    alerts: arr(d.alerts),
    ai: arr(d.ai),
    decisions: arr(d.decisions),
    kpis: arr(d.kpis),
    triggers: arr(d.triggers),
    summary: d.summary ?? ({} as Summary),
    purchasing: {
      summary: d.purchasing?.summary ?? ({} as Purchasing["summary"]),
      bySupplier: arr(d.purchasing?.bySupplier),
      byProject: arr(d.purchasing?.byProject),
      monthly: arr(d.purchasing?.monthly),
      orders: arr(d.purchasing?.orders),
      invoices: arr(d.purchasing?.invoices),
      payments: arr(d.purchasing?.payments),
    },
  };
}

type LoadState =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: Dashboard; error: "" }
  | { status: "error"; data: null; error: string };

/** WMS-style Finance overview (staff/kadep). Same live data as the war-room
 *  dashboard, re-laid-out in the shared Ops-Console cards. */
export function KeuanganOverviewWms() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: "" });
  const setGrounding = useAiGrounding();

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    const fetchOnce = async () => {
      if (!api.hasToken()) await api.login(FIN_USER.user, FIN_USER.pass);
      return normalizeDashboard(await api.dashboard());
    };
    try {
      setState({ status: "ready", data: await fetchOnce(), error: "" });
    } catch (e) {
      if (e instanceof AuthError) {
        try {
          await api.login(FIN_USER.user, FIN_USER.pass);
          setState({ status: "ready", data: normalizeDashboard(await api.dashboard()), error: "" });
          return;
        } catch (e2) {
          setState({ status: "error", data: null, error: e2 instanceof Error ? e2.message : String(e2) });
          return;
        }
      }
      setState({ status: "error", data: null, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => void load(), [load]);
  useRealtimeSocket(api.realtimeURL(), () => void load());

  // Publish a compact finance summary to the AI assistant.
  useEffect(() => {
    if (state.status !== "ready") return;
    const d = state.data;
    setGrounding({
      division: "Keuangan",
      page: "Akad / KPR",
      data: {
        period: d.period,
        summary: d.summary,
        monthly: d.monthly,
        projects: d.projects,
        banks: d.banks,
        sales: d.sales,
        payMix: d.payMix,
        pipeline: d.pipeline,
        alerts: d.alerts,
        purchasing: { summary: d.purchasing.summary, bySupplier: d.purchasing.bySupplier },
      },
    });
  }, [state, setGrounding]);

  if (state.status === "loading") {
    return <div className="kwms wms-empty">Memuat data keuangan…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="kwms">
        <div className="wms-card wms-col-12">
          <div className="wms-card-h"><h3>Gagal memuat data</h3></div>
          <div className="wms-note">{state.error}</div>
          <div className="wms-note small">API: {api.base}</div>
          <button className="wms-btn" style={{ marginTop: 10 }} onClick={() => void load()}>Coba lagi</button>
        </div>
      </div>
    );
  }

  const D = state.data;
  const empty = D.summary.akadCount === 0 && D.projects.length === 0 && (D.purchasing?.summary?.poCount ?? 0) === 0;
  if (empty) {
    return (
      <div className="kwms">
        <div className="wms-empty" style={{ padding: 60 }}>
          📊 Belum ada data keuangan. Buka tab <b>Sync / Import</b> untuk tarik data dari Google Sheets.
        </div>
      </div>
    );
  }

  return (
    <div className="kwms">
      <div style={{ fontSize: 12, color: "var(--wms-muted)", margin: "0 0 12px" }}>
        {D.period}{D.updated ? ` · diperbarui ${D.updated}` : ""}
      </div>

      <KpiRowWms s={D.summary} />

      <div className="wms-grid">
        <AchievementWms s={D.summary} />
        <MonthlyWms monthly={D.monthly} />
        <ProjectWms projects={D.projects} />

        <BankWms banks={D.banks} />
        <SalesWms sales={D.sales} />
        <PayMixWms payMix={D.payMix} />

        <PipelineWms pipeline={D.pipeline} />
        <PurchasingWms pur={D.purchasing} />
        <AlertWms alerts={D.alerts} ai={D.ai} decisions={D.decisions} />
      </div>
    </div>
  );
}
