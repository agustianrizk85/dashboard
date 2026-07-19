import { useCallback, useEffect, useState } from "react";
import { useAiGrounding } from "@/ai/AiAssistant";
import { useRealtimeSocket } from "@/lib/realtime";
import { StatCard } from "@/components/wms/widgets";
import type { Alert, Dashboard } from "../controltower/types";
import { api, AuthError } from "../controltower/api/client";
import { num, pct, rpShort, SEV } from "../controltower/lib/format";
import "./saleswms.css";

// Same shared service account the war-room uses; every dashboard user reads the
// sales backend (:8085) through it when no personal token is present.
const SALES_VIEWER = { user: "admin", pass: "admin123" };

type LoadState =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: Dashboard; error: "" }
  | { status: "error"; data: null; error: string };

/**
 * WMS "Ops Console" overview for non-all-access Sales staff/kadep — the same live
 * war-room data (GET /api/dashboard) re-laid-out in the shared green Ops-Console
 * cards. The full war-room stays available under the "Control Tower" nav item.
 */
export function SalesOverviewWms({ onOpenTower }: { onOpenTower?: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: "" });
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const setGrounding = useAiGrounding();

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    const fetchOnce = async () => {
      if (!api.hasToken()) await api.login(SALES_VIEWER.user, SALES_VIEWER.pass);
      return api.dashboard();
    };
    try {
      setState({ status: "ready", data: await fetchOnce(), error: "" });
    } catch (e) {
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

  useEffect(() => void load(), [load]);
  useRealtimeSocket(api.realtimeURL(), () => void load());

  // AI Alert & Action Plan (OpenRouter server-side, rule-based fallback).
  useEffect(() => {
    let alive = true;
    api.aiAlerts().then((r) => alive && setAlerts(r.alerts)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const d = state.data;
    setGrounding({
      division: "Sales",
      page: "Ringkasan",
      data: {
        period: d.period,
        summary: d.summary,
        exec: d.exec,
        funnel: d.funnel,
        channels: d.channels,
        projects: d.projects?.map((p) => ({ code: p.code, akad: p.akad, proses: p.proses, rev: p.rev })),
        sales: d.sales?.slice(0, 15).map((s) => ({ name: s.name, akad: s.akad, total: s.total })),
      },
    });
  }, [state, setGrounding]);

  if (state.status === "loading") return <div className="swms wms-empty">Memuat data sales…</div>;
  if (state.status === "error") {
    return (
      <div className="swms">
        <div className="wms-card wms-col-12">
          <div className="wms-card-h"><h3>Gagal memuat data</h3></div>
          <div className="wms-note">{state.error}</div>
          <div className="wms-note small">API: {api.base}</div>
          <button className="wms-btn" style={{ marginTop: 10 }} onClick={() => void load()}>Coba lagi</button>
        </div>
      </div>
    );
  }

  const d = state.data;
  const s = d.summary;
  const empty = (d.funnel?.length ?? 0) === 0 && (d.projects?.length ?? 0) === 0 && (d.sales?.length ?? 0) === 0;
  if (empty) {
    return (
      <div className="swms">
        <div className="wms-empty" style={{ padding: 60 }}>
          📊 Belum ada data sales. Buka <b>Master Data</b> untuk upload Excel / sync Google Sheets.
        </div>
      </div>
    );
  }

  const akadSeries = (d.monthly ?? []).map((m) => m.akad);
  const bookingSeries = (d.monthly ?? []).map((m) => m.booking);
  const funnelUnits = (d.funnel ?? []).filter((f) => !f.isMoney);
  const funnelMax = funnelUnits[0]?.value || 1;
  const topProjects = [...(d.projects ?? [])].sort((a, b) => b.akad - a.akad).slice(0, 6);
  const topSales = [...(d.sales ?? [])].sort((a, b) => b.akad - a.akad).slice(0, 6);
  const salesMax = topSales[0]?.akad || 1;
  const topChannels = [...(d.channels ?? [])].sort((a, b) => b.total - a.total).slice(0, 6);
  const chanMax = topChannels[0]?.total || 1;
  const shownAlerts = (alerts ?? d.alerts ?? []).slice(0, 5);

  return (
    <div className="swms">
      <div className="swms-period">
        {d.period}
        {d.updated && d.updated !== "—" ? ` · diperbarui ${d.updated}` : ""}
      </div>

      {/* KPI row */}
      <div className="wms-grid" style={{ marginBottom: 16 }}>
        <StatCard
          className="wms-col-3"
          title="Akad (unit)"
          value={num(s.akad)}
          data={akadSeries.length ? akadSeries : undefined}
          delta={pct(s.achievement, 1)}
          deltaUp={s.achievement >= 50}
          subtitle={`dari target ${num(s.target2026)} · gap ${num(s.gapToTarget)}`}
        />
        <StatCard
          className="wms-col-3"
          title="Booking (unit)"
          value={num(s.booking)}
          data={bookingSeries.length ? bookingSeries : undefined}
          subtitle={`pipeline aktif ${num(s.pipelineActive)} · batal ${num(s.batal)}`}
        />
        <StatCard
          className="wms-col-3"
          title="Cash-In (akad)"
          value={rpShort(s.cashIn)}
          subtitle={`potensi pipeline ${rpShort(s.potentialRevenue)}`}
        />
        <StatCard
          className="wms-col-3"
          title="Konversi Booking→Akad"
          value={pct(s.bookingToAkad, 1)}
          delta={pct(s.cancelRate, 1) + " batal"}
          deltaUp={false}
          subtitle={`biaya iklan/akad ${rpShort(s.avgCostPerAkad * 1_000_000)}`}
        />
      </div>

      <div className="wms-grid">
        {/* Progress to target */}
        <div className="wms-card wms-col-4">
          <div className="wms-card-h"><h3>Progres Target 2026</h3></div>
          <div className="swms-gauge-val">{pct(s.achievement, 1)}</div>
          <div className="swms-gauge">
            <div className="swms-gauge-fill" style={{ width: Math.min(100, s.achievement) + "%" }} />
          </div>
          <div className="wms-card-sub">
            <b>{num(s.akad)}</b> akad dari <b>{num(s.target2026)}</b> unit · sisa <b>{num(s.gapToTarget)}</b>
          </div>
          <div className="swms-status" data-tone={s.status}>{s.status.replace("-", " ")}</div>
        </div>

        {/* Funnel */}
        <div className="wms-card wms-col-8">
          <div className="wms-card-h"><h3>Funnel Leads → Akad</h3></div>
          <div className="swms-funnel">
            {funnelUnits.map((f, i) => {
              const w = Math.max(2, (f.value / funnelMax) * 100);
              const prev = i > 0 ? funnelUnits[i - 1].value : 0;
              const conv = i > 0 && prev > 0 ? (f.value / prev) * 100 : null;
              return (
                <div className="swms-fn-row" key={f.key + i}>
                  <div className="swms-fn-label">{f.key}</div>
                  <div className="swms-fn-track">
                    <div className="swms-fn-fill" style={{ width: w + "%" }}>
                      <span>{num(f.value)}</span>
                    </div>
                  </div>
                  <div className="swms-fn-conv">{conv == null ? "—" : pct(conv, 0)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top projects */}
        <div className="wms-card wms-col-6">
          <div className="wms-card-h"><h3>Proyek Teratas</h3></div>
          <div className="swms-tablewrap">
            <table className="wms-table">
              <thead>
                <tr><th>Proyek</th><th className="r">Akad</th><th className="r">Proses</th><th className="r">Cash-In</th></tr>
              </thead>
              <tbody>
                {topProjects.map((p) => (
                  <tr key={p.code}>
                    <td><b>{p.code}</b> <span className="swms-dim">{p.name}</span></td>
                    <td className="r">{num(p.akad)}</td>
                    <td className="r">{num(p.proses)}</td>
                    <td className="r">{rpShort(p.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top sales */}
        <div className="wms-card wms-col-6">
          <div className="wms-card-h"><h3>Sales Terbaik</h3></div>
          <div className="swms-rank">
            {topSales.map((sr, i) => (
              <div className="swms-rank-row" key={sr.name + i}>
                <div className="swms-rank-no" data-top={i === 0 ? "1" : ""}>{i + 1}</div>
                <div className="swms-rank-main">
                  <div className="swms-rank-name">{sr.name}</div>
                  <div className="swms-rank-bar"><div style={{ width: (sr.akad / salesMax) * 100 + "%" }} /></div>
                </div>
                <div className="swms-rank-val">{num(sr.akad)} <span>akad</span></div>
              </div>
            ))}
            {topSales.length === 0 && <div className="wms-empty">Belum ada data sales.</div>}
          </div>
        </div>

        {/* Channels */}
        <div className="wms-card wms-col-6">
          <div className="wms-card-h"><h3>Sumber Penjualan</h3></div>
          <div className="swms-rank">
            {topChannels.map((c, i) => (
              <div className="swms-rank-row" key={c.name + i}>
                <div className="swms-rank-main">
                  <div className="swms-rank-name">{c.name}</div>
                  <div className="swms-rank-bar alt"><div style={{ width: (c.total / chanMax) * 100 + "%" }} /></div>
                </div>
                <div className="swms-rank-val">{num(c.total)} <span>lead · {num(c.akad)} akad</span></div>
              </div>
            ))}
            {topChannels.length === 0 && <div className="wms-empty">Belum ada data sumber.</div>}
          </div>
        </div>

        {/* AI Alerts */}
        <div className="wms-card wms-col-6">
          <div className="wms-card-h">
            <h3>AI Alert & Action Plan</h3>
            {onOpenTower && <button className="wms-btn ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={onOpenTower}>War Room →</button>}
          </div>
          <div className="swms-alerts">
            {shownAlerts.map((a, i) => (
              <div className="swms-alert" key={i} style={{ borderLeftColor: SEV[a.sev]?.c ?? "#8a998e" }}>
                <div className="swms-alert-top">
                  <span className="swms-alert-sev" style={{ background: SEV[a.sev]?.bg, color: SEV[a.sev]?.c }}>{SEV[a.sev]?.label ?? a.sev}</span>
                  <span className="swms-alert-title">{a.title}</span>
                </div>
                {a.detail && <div className="swms-alert-detail">{a.detail}</div>}
                {(a.pic || a.deadline) && (
                  <div className="swms-alert-meta">{a.pic}{a.pic && a.deadline ? " · " : ""}{a.deadline}</div>
                )}
              </div>
            ))}
            {shownAlerts.length === 0 && <div className="wms-empty">Belum ada alert.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalesOverviewWms;
