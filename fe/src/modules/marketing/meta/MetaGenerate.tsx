// Meta Ads multi-agent PKPSICOV generator. Clicking "Generate" in the Ads view
// runs a panel of expert agents (Media Buyer → Creative → Budget → Head of
// Marketing synthesis) against the live Meta Ads snapshot via the auth backend
// (/api/ai/meta-agent, Ollama Cloud). The final synthesis agent returns a JSON
// executive dashboard that overlays the normal Ads view.
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_EXPIRED_EVENT } from "@/auth/AuthContext";
import type { MetaAds } from "./metaApi";

const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";

// A planned expert agent. The panel is decided at runtime by the AI planner
// (/ai/meta-plan) — the count is NOT fixed. Each carries its own PKPSICOV frame.
type PlannedAgent = {
  key: string;
  title: string;
  icon: string;
  hint?: string;
  peranan?: string;
  kompetensi?: string;
  instruksi?: string;
  output?: string;
};

// Fallback panel used only if the planner can't be reached (mirrors the backend
// defaultPlan) so the pipeline still runs.
const FALLBACK_AGENTS: PlannedAgent[] = [
  { key: "mediabuyer", title: "Media Buyer / Performance", icon: "📈", hint: "Efisiensi funnel, campaign boros vs pemenang" },
  { key: "creative", title: "Creative & Copywriter", icon: "✍", hint: "CTR lemah, ad fatigue, angle copy baru" },
  { key: "budget", title: "Budget & Audience", icon: "🎯", hint: "Realokasi budget, targeting, struktur" },
];

// The synthesis finalizer is always appended after the AI-chosen analysts; it is
// a built-in on the backend and returns the executive dashboard JSON.
const SYNTHESIS: PlannedAgent = {
  key: "synthesis",
  title: "Head of Marketing — Sintesis",
  icon: "♛",
  hint: "Dashboard eksekutif + keputusan final",
};

type AgentState = { status: "idle" | "running" | "done" | "error"; output?: string; error?: string };
type Tone = "ok" | "warn" | "bad" | "neutral";
type DashKpi = { label: string; value: string; note?: string; tone?: Tone };
type DashSection = { heading: string; items: { title: string; detail?: string; tone?: Tone }[] };
export type Dash = { title?: string; kpis?: DashKpi[]; sections?: DashSection[] };

/** Extract the first JSON object from model output (tolerating prose/fences). */
export function tryParseDash(output: string): Dash | null {
  const i = output.indexOf("{");
  const j = output.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try {
    const d = JSON.parse(output.slice(i, j + 1)) as Dash;
    return d && (d.kpis || d.sections) ? d : null;
  } catch {
    return null;
  }
}

/** Build a compact, token-bounded snapshot of the current Ads data for grounding. */
export function buildSnapshot(data: MetaAds, rangeLabel: string): string {
  const t = data.totals;
  const camps = (data.campaigns ?? [])
    .slice()
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30)
    .map((c) => ({
      name: c.name,
      objective: c.objective,
      status: c.effectiveStatus || c.status,
      spend: Math.round(c.spend),
      ctr: +c.ctr.toFixed(2),
      results: c.results,
      resultLabel: c.resultLabel,
      costPerResult: Math.round(c.costPerResult),
      frequency: +c.frequency.toFixed(2),
      issues: c.issues,
    }));
  return JSON.stringify({
    rentang: rangeLabel,
    catatan: "hasil = chat WhatsApp masuk (bukan penjualan); ROAS tak dapat dihitung",
    totals: t,
    jumlahCampaign: data.campaigns?.length ?? 0,
    top30Campaign: camps,
  });
}

/** Runs the agent pipeline sequentially, threading prior outputs forward. */
export function MetaAiGenerate({ data, rangeLabel, onClose }: { data: MetaAds; rangeLabel: string; onClose: () => void }) {
  const [agents, setAgents] = useState<PlannedAgent[]>(FALLBACK_AGENTS);
  const [planning, setPlanning] = useState(false);
  const [states, setStates] = useState<Record<string, AgentState>>({});
  const [dash, setDash] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const started = useRef(false);

  // ── AI config: key is set centrally in the Admin panel. Here we only read
  //    whether it's configured, and let the user pick a model per-run. ──
  const [configured, setConfigured] = useState<boolean | null>(null); // null = unknown/loading
  const [model, setModel] = useState(""); // selected model for this run ("" = backend default)
  const [models, setModels] = useState<string[]>([]); // fetched from Ollama

  const authBase = AUTH_API.replace(/\/$/, "");
  const authHeaders = () => {
    const token = localStorage.getItem("gp_dashboard_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
  };

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch(authBase + "/ai/models", { headers: authHeaders() });
      if (!res.ok) return;
      const b = (await res.json()) as { models?: string[]; current?: string };
      setModels(b.models ?? []);
      setModel((m) => m || b.current || "");
    } catch {
      /* leave models empty — manual entry still works */
    }
  }, [authBase]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(authBase + "/ai/config", { headers: authHeaders() });
      const b = (await res.json().catch(() => ({}))) as { configured?: boolean; model?: string };
      setConfigured(!!b.configured);
      setModel((m) => m || b.model || "");
      if (b.configured) void loadModels();
      return !!b.configured;
    } catch {
      setConfigured(false);
      return false;
    }
  }, [authBase, loadModels]);

  const run = useCallback(async () => {
    setBusy(true);
    setDash(null);
    setStates({});
    const snapshot = buildSnapshot(data, rangeLabel);

    // Stage 1 — the AI planner decides the expert panel (count is not fixed).
    setPlanning(true);
    let panel: PlannedAgent[] = FALLBACK_AGENTS;
    try {
      const res = await fetch(authBase + "/ai/meta-plan", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ model: model.trim(), ads: snapshot }),
      });
      if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      const body = (await res.json().catch(() => ({}))) as { agents?: PlannedAgent[]; error?: string };
      if (res.ok && body.agents && body.agents.length) panel = body.agents;
    } catch {
      /* planner unreachable — keep the fallback panel */
    }
    setAgents(panel);
    setPlanning(false);

    // Stage 2 — run each planned analyst, then the synthesis finalizer.
    const sequence = [...panel, SYNTHESIS];
    setStates(Object.fromEntries(sequence.map((a) => [a.key, { status: "idle" }])) as Record<string, AgentState>);
    const prior: Record<string, string> = {};
    for (const agent of sequence) {
      setStates((s) => ({ ...s, [agent.key]: { status: "running" } }));
      try {
        const res = await fetch(authBase + "/ai/meta-agent", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            agent: agent.key,
            model: model.trim(),
            ads: snapshot,
            prior,
            title: agent.title,
            peranan: agent.peranan,
            kompetensi: agent.kompetensi,
            instruksi: agent.instruksi,
            output: agent.output,
          }),
        });
        if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        const body = (await res.json().catch(() => ({}))) as { output?: string; error?: string };
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const output = body.output || "(kosong)";
        setStates((s) => ({ ...s, [agent.key]: { status: "done", output } }));
        if (agent.key === "synthesis") setDash(tryParseDash(output));
        else prior[agent.key] = output.length > 1400 ? output.slice(0, 1400) : output;
      } catch (e) {
        setStates((s) => ({ ...s, [agent.key]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
        break;
      }
    }
    setBusy(false);
  }, [data, rangeLabel, model, authBase]);

  // On mount: load config + model list, then auto-run only when a key is set.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const ok = await loadConfig();
      if (ok) void run();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="meta-ai">
      <div className="meta-ai-bar">
        <button className="meta-ai-back" onClick={onClose}>← Kembali ke data</button>
        <div className="meta-ai-title">
          <b>✨ Generate AI — Dashboard Iklan (PKPSICOV)</b>
          <span>AI menentukan sendiri panel ahli untuk data Meta Ads rentang {rangeLabel}</span>
        </div>
        <div className="meta-ai-model">
          <label>Model</label>
          <input
            list="meta-ai-models"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="glm-5.2:cloud"
            disabled={busy}
            title="Pilih / ketik model Ollama untuk generate ini (dinamis)"
          />
          <datalist id="meta-ai-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <button className="meta-ai-rerun" onClick={() => void run()} disabled={busy || configured === false}>
          {busy ? "Menjalankan…" : "⟳ Jalankan ulang"}
        </button>
      </div>

      {/* AI key is set centrally in the Admin panel now. */}
      {configured === false && (
        <div className="meta-ai-keybar">
          <span className="mai-key-status">⚠ AI belum dikonfigurasi. Minta admin menyetel kunci di <b>Panel Admin → 🔑 Kunci AI</b>.</span>
        </div>
      )}

      {/* Planner: AI is deciding how many experts + which ones */}
      {planning && (
        <div className="meta-ai-plan">🧭 AI sedang menyusun panel ahli yang paling sesuai untuk data ini…</div>
      )}

      {/* Progress: dynamic expert panel (AI-chosen) + synthesis finalizer */}
      <div className="meta-ai-agents">
        {[...agents, SYNTHESIS].map((a, i) => {
          const st = states[a.key] ?? { status: "idle" as const };
          return (
            <div key={a.key} className={"meta-ai-agent " + st.status}>
              <div className="mai-ag-head">
                <span className="mai-ag-icon">{a.icon}</span>
                <div className="mai-ag-titles">
                  <b>{a.title}</b>
                  <span>{a.hint ?? a.instruksi ?? ""}</span>
                </div>
                <span className={"mai-ag-badge " + st.status}>
                  {st.status === "idle" ? "menunggu" : st.status === "running" ? "menganalisis…" : st.status === "done" ? "selesai" : "gagal"}
                </span>
              </div>
              {st.status === "error" && <div className="mai-ag-err">{st.error}</div>}
              {st.output && a.key !== "synthesis" && (
                <>
                  <button className="mai-ag-toggle" onClick={() => setExpanded((e) => ({ ...e, [a.key]: !e[a.key] }))}>
                    {expanded[a.key] ? "▾ Sembunyikan analisis" : "▸ Lihat analisis ahli #" + (i + 1)}
                  </button>
                  {expanded[a.key] && <div className="mai-ag-out">{st.output}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Immersive executive dashboard — ALWAYS populated from real data,
          augmented by the AI synthesis when available (never blank). */}
      {(states.synthesis?.status === "done" || states.synthesis?.status === "error") && (
        <DashboardOutput
          dash={dash}
          data={data}
          rangeLabel={rangeLabel}
          analysts={agents
            .map((a) => ({ title: a.title, icon: a.icon, output: states[a.key]?.output ?? "" }))
            .filter((x) => x.output && x.output !== "(kosong)")}
        />
      )}
    </div>
  );
}

type Analyst = { title: string; icon: string; output: string };

const rp = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return "Rp " + (n / 1e9).toFixed(1).replace(/\.0$/, "") + " M";
  if (a >= 1e6) return "Rp " + (n / 1e6).toFixed(1).replace(/\.0$/, "") + " jt";
  if (a >= 1e3) return "Rp " + Math.round(n / 1e3) + " rb";
  return "Rp " + Math.round(n);
};
const num = (n: number): string => Math.round(n).toLocaleString("id-ID");
const pct = (n: number): string => n.toFixed(2) + "%";

/** Split an analyst's prose into clean bullet lines (fallback when the AI
 *  synthesis JSON is unavailable) so the insight sections are never empty. */
function toBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 2)
    .slice(0, 6);
}

/** Renders the immersive executive Meta Ads dashboard: real-data KPI hero +
 *  funnel + per-campaign bars, then the AI's synthesized insights (or, if the
 *  synthesis JSON is missing, insights derived from each expert's analysis). */
export function DashboardOutput({
  dash,
  data,
  rangeLabel,
  analysts,
}: {
  dash: Dash | null;
  data: MetaAds;
  rangeLabel: string;
  analysts: Analyst[];
}) {
  const t = data.totals;
  const heroKpis: DashKpi[] = t
    ? [
        { label: "Total Spend", value: rp(t.spend), tone: "neutral" },
        { label: "Hasil (WA/Lead)", value: num(t.results), tone: t.results > 0 ? "ok" : "bad" },
        { label: "Cost / Hasil", value: rp(t.costPerResult), tone: t.costPerResult > 60000 ? "bad" : t.costPerResult > 40000 ? "warn" : "ok" },
        { label: "CTR", value: pct(t.ctr), tone: t.ctr < 0.7 ? "warn" : "ok" },
        { label: "CPC", value: rp(t.cpc), tone: "neutral" },
        { label: "CPM", value: rp(t.cpm), tone: "neutral" },
        { label: "Jangkauan", value: num(t.reach), tone: "neutral" },
        { label: "Frekuensi", value: t.frequency.toFixed(2) + "x", tone: t.frequency >= 3 ? "warn" : "ok" },
      ]
    : [];

  const funnel = t
    ? [
        { label: "Impressions", value: t.impressions },
        { label: "Jangkauan", value: t.reach },
        { label: "Clicks", value: t.clicks },
        { label: "Hasil", value: t.results },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const camps = (data.campaigns ?? []).slice().sort((a, b) => b.spend - a.spend).slice(0, 8);
  const campMax = Math.max(1, ...camps.map((c) => c.spend));
  const avgCpr = t?.costPerResult ?? 0;

  const aiSections: DashSection[] = dash?.sections?.length
    ? dash.sections
    : analysts.map((a) => ({
        heading: a.icon + " " + a.title,
        items: toBullets(a.output).map((b) => ({ title: b })),
      }));
  const aiKpis = dash?.kpis ?? [];

  return (
    <div className="meta-ai-dash">
      <div className="mai-dash-title">{dash?.title || "Dashboard Eksekutif Iklan Meta — " + rangeLabel}</div>

      {heroKpis.length > 0 && (
        <div className="mai-dash-kpis">
          {heroKpis.map((k, i) => (
            <div key={i} className={"mai-kpi t-" + (k.tone || "neutral")}>
              <div className="mai-kpi-l">{k.label}</div>
              <div className="mai-kpi-v">{k.value}</div>
              {k.note && <div className="mai-kpi-n">{k.note}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="mai-charts">
        <div className="mai-chart">
          <div className="mai-chart-h">Funnel Iklan · {rangeLabel}</div>
          <div className="mai-funnel">
            {funnel.map((f, i) => (
              <div key={i} className="mai-frow">
                <span className="mai-flabel">{f.label}</span>
                <div className="mai-ftrack">
                  <i style={{ width: (f.value / funnelMax) * 100 + "%" }} />
                </div>
                <span className="mai-fval">{num(f.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mai-chart">
          <div className="mai-chart-h">Spend per Campaign · Top {camps.length}</div>
          <div className="mai-bars">
            {camps.length === 0 && <div className="mai-empty">Tidak ada campaign pada rentang ini.</div>}
            {camps.map((c, i) => {
              const tone = c.costPerResult === 0 ? "neutral" : c.costPerResult > avgCpr * 1.5 ? "bad" : c.costPerResult <= avgCpr ? "ok" : "warn";
              return (
                <div key={i} className="mai-bar-row">
                  <span className="mai-bar-name" title={c.name}>{c.name}</span>
                  <div className="mai-bar-track">
                    <i className={"t-" + tone} style={{ width: (c.spend / campMax) * 100 + "%" }} />
                  </div>
                  <span className="mai-bar-meta">
                    {rp(c.spend)} · {num(c.results)} hasil · CPR {rp(c.costPerResult)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {aiKpis.length > 0 && (
        <div className="mai-dash-kpis">
          {aiKpis.map((k, i) => (
            <div key={i} className={"mai-kpi t-" + (k.tone || "neutral")}>
              <div className="mai-kpi-l">{k.label}</div>
              <div className="mai-kpi-v">{k.value}</div>
              {k.note && <div className="mai-kpi-n">{k.note}</div>}
            </div>
          ))}
        </div>
      )}

      {aiSections.map((sec, i) => (
        <div key={i} className="mai-dash-sec">
          <div className="mai-dash-sec-h">{sec.heading}</div>
          <div className="mai-dash-sec-items">
            {sec.items?.map((it, j) => (
              <div key={j} className={"mai-item t-" + (it.tone || "neutral")}>
                <b>{it.title}</b>
                {it.detail && <span>{it.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
