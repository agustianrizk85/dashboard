/**
 * "✨ Generate AI" — division-agnostic multi-agent analysis, same engine as the
 * Meta Ads generator but reusable on EVERY dashboard.
 *
 * Flow (all via the auth AI service):
 *   1. fetch the division's compact dashboard snapshot (aiDivisions.ts)
 *   2. POST /ai/analyze-plan   → AI designs a 2–5 expert panel for this data
 *   3. POST /ai/analyze-agent  → run each expert, then the `synthesis` finalizer
 *   4. render the synthesis JSON as an executive dashboard (KPIs + sections)
 *
 * Drop `<AiGenerateButton division="sales" />` into any dashboard header.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_EXPIRED_EVENT } from "@/auth/AuthContext";
import { AI_DIVS, type DivKey } from "./aiDivisions";
import "./ai-generate.css";

const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";

type Tone = "ok" | "warn" | "bad" | "neutral";
type DashKpi = { label: string; value: string; note?: string; tone?: Tone };
type DashSection = { heading: string; items: { title: string; detail?: string; tone?: Tone }[] };
export type Dash = { title?: string; kpis?: DashKpi[]; sections?: DashSection[] };
type PlannedAgent = { key: string; title: string; icon?: string; peranan?: string; kompetensi?: string; instruksi?: string; output?: string; hint?: string };
type AgentState = { status: "idle" | "running" | "done" | "error"; output?: string; error?: string };

const SYNTHESIS: PlannedAgent = { key: "synthesis", title: "Sintesis Eksekutif", icon: "🧠", hint: "Menggabungkan semua ahli jadi dashboard" };
const FALLBACK_AGENTS: PlannedAgent[] = [
  { key: "kinerja", title: "Analis Kinerja", icon: "📊", hint: "Capaian & tren vs target" },
  { key: "risiko", title: "Auditor Risiko", icon: "⚠", hint: "Masalah & risiko kritis" },
  { key: "rekomendasi", title: "Strategist Aksi", icon: "🎯", hint: "Aksi prioritas" },
];

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

/** Split an expert's prose into clean bullet lines (fallback when synthesis JSON
 *  is missing) so the insight sections are never empty. */
function toBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 2)
    .slice(0, 6);
}

export function AiGenerateButton({ division, className }: { division: DivKey; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={"aig-btn " + (className ?? "")} onClick={() => setOpen(true)} title="Generate analisa AI untuk dashboard ini">
        ✨ Generate AI
      </button>
      {open && <AiGeneratePanel division={division} onClose={() => setOpen(false)} />}
    </>
  );
}

function AiGeneratePanel({ division, onClose }: { division: DivKey; onClose: () => void }) {
  const div = AI_DIVS[division];
  const [agents, setAgents] = useState<PlannedAgent[]>(FALLBACK_AGENTS);
  const [planning, setPlanning] = useState(false);
  const [states, setStates] = useState<Record<string, AgentState>>({});
  const [dash, setDash] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState("");
  const [noData, setNoData] = useState(false);
  const started = useRef(false);

  // AI key is set centrally in the Admin panel; we only read configured + model.
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);

  const authBase = AUTH_API.replace(/\/$/, "");
  const authHeaders = useCallback((): HeadersInit => {
    const token = localStorage.getItem("gp_dashboard_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch(authBase + "/ai/models", { headers: authHeaders() });
      if (!res.ok) return;
      const b = (await res.json()) as { models?: string[]; current?: string };
      setModels(b.models ?? []);
      setModel((m) => m || b.current || "");
    } catch {
      /* ignore */
    }
  }, [authBase, authHeaders]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(authBase + "/ai/config", { headers: authHeaders() });
      const b = (await res.json().catch(() => ({}))) as { configured?: boolean; model?: string };
      setConfigured(!!b.configured);
      if (b.model) setModel((m) => m || b.model!);
      if (b.configured) void loadModels();
      return !!b.configured;
    } catch {
      setConfigured(false);
      return false;
    }
  }, [authBase, authHeaders, loadModels]);

  const run = useCallback(async () => {
    setBusy(true);
    setDash(null);
    setStates({});
    setNoData(false);

    // 0) Gather this division's snapshot.
    setPhase("Memuat data divisi…");
    const snapshot = await div.fetchSnapshot();
    if (!snapshot) {
      setNoData(true);
      setBusy(false);
      setPhase("");
      return;
    }

    // 1) Planner designs the expert panel.
    setPhase("AI menyusun panel ahli…");
    setPlanning(true);
    let panel: PlannedAgent[] = FALLBACK_AGENTS;
    try {
      const res = await fetch(authBase + "/ai/analyze-plan", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ division: div.key, label: div.label, model: model.trim(), data: snapshot }),
      });
      if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      const body = (await res.json().catch(() => ({}))) as { agents?: PlannedAgent[] };
      if (res.ok && body.agents && body.agents.length) panel = body.agents;
    } catch {
      /* keep fallback panel */
    }
    setAgents(panel);
    setPlanning(false);

    // 2) Run each expert, then synthesis.
    const sequence = [...panel, SYNTHESIS];
    setStates(Object.fromEntries(sequence.map((a) => [a.key, { status: "idle" }])) as Record<string, AgentState>);
    const prior: Record<string, string> = {};
    for (const agent of sequence) {
      setPhase(`Menjalankan: ${agent.title}…`);
      setStates((s) => ({ ...s, [agent.key]: { status: "running" } }));
      try {
        const res = await fetch(authBase + "/ai/analyze-agent", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            division: div.key,
            label: div.label,
            agent: agent.key,
            model: model.trim(),
            data: snapshot,
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
    setPhase("");
    setBusy(false);
  }, [div, model, authBase, authHeaders]);

  // On mount: load config/models, then auto-run only when a key is set.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const ok = await loadConfig();
      if (ok) void run();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const synthDone = states.synthesis?.status === "done" || states.synthesis?.status === "error";
  const analysts = agents
    .map((a) => ({ title: a.title, icon: a.icon ?? "🔎", output: states[a.key]?.output ?? "" }))
    .filter((x) => x.output && x.output !== "(kosong)");

  return (
    <div className="aig-overlay" onClick={onClose}>
      <div className="aig-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aig-bar">
          <div className="aig-title">
            <b>✨ Generate AI — Analisa {div.label}</b>
            <span>AI menyusun sendiri panel ahli untuk data divisi ini (PKPSICOV)</span>
          </div>
          <div className="aig-model">
            <label>Model</label>
            <input
              list="aig-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="glm-5.2:cloud"
              disabled={busy}
              title="Pilih / ketik model Ollama"
            />
            <datalist id="aig-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <button className="aig-rerun" onClick={() => void run()} disabled={busy || configured === false}>
            {busy ? "Menjalankan…" : "⟳ Jalankan"}
          </button>
          <button className="aig-close" onClick={onClose} title="Tutup">
            ✕
          </button>
        </div>

        {configured === false && (
          <div className="aig-keybar">
            <span className="aig-key-status">⚠ AI belum dikonfigurasi. Minta admin menyetel kunci di <b>Panel Admin → 🔑 Kunci AI</b>.</span>
          </div>
        )}

        <div className="aig-body">
          {noData && (
            <div className="aig-nodata">
              📭 Data divisi <b>{div.label}</b> tak bisa dimuat. Pastikan backend divisi berjalan & Anda punya akses. Coba <button className="aig-link" onClick={() => void run()}>muat ulang</button>.
            </div>
          )}
          {phase && <div className="aig-phase">{phase}</div>}
          {planning && <div className="aig-plan">🧭 AI sedang menyusun panel ahli paling sesuai untuk data ini…</div>}

          {/* Expert panel progress */}
          <div className="aig-agents">
            {[...agents, SYNTHESIS].map((a, i) => {
              const st = states[a.key] ?? { status: "idle" as const };
              return (
                <div key={a.key} className={"aig-agent " + st.status}>
                  <div className="aig-ag-head">
                    <span className="aig-ag-icon">{a.icon ?? "🔎"}</span>
                    <div className="aig-ag-titles">
                      <b>{a.title}</b>
                      <span>{a.hint ?? a.instruksi ?? ""}</span>
                    </div>
                    <span className={"aig-ag-badge " + st.status}>
                      {st.status === "idle" ? "menunggu" : st.status === "running" ? "menganalisis…" : st.status === "done" ? "selesai" : "gagal"}
                    </span>
                  </div>
                  {st.status === "error" && <div className="aig-ag-err">{st.error}</div>}
                  {st.output && a.key !== "synthesis" && (
                    <>
                      <button className="aig-ag-toggle" onClick={() => setExpanded((e) => ({ ...e, [a.key]: !e[a.key] }))}>
                        {expanded[a.key] ? "▾ Sembunyikan analisis" : "▸ Lihat analisis ahli #" + (i + 1)}
                      </button>
                      {expanded[a.key] && <div className="aig-ag-out">{st.output}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Executive dashboard */}
          {synthDone && <DashboardOutput dash={dash} label={div.label} analysts={analysts} />}
        </div>
      </div>
    </div>
  );
}

export function DashboardOutput({ dash, label, analysts }: { dash: Dash | null; label: string; analysts: { title: string; icon: string; output: string }[] }) {
  const sections: DashSection[] = dash?.sections?.length
    ? dash.sections
    : analysts.map((a) => ({ heading: a.icon + " " + a.title, items: toBullets(a.output).map((b) => ({ title: b })) }));
  const kpis = dash?.kpis ?? [];
  return (
    <div className="aig-dash">
      <div className="aig-dash-title">{dash?.title || "Dashboard Eksekutif — " + label}</div>
      {kpis.length > 0 && (
        <div className="aig-dash-kpis">
          {kpis.map((k, i) => (
            <div key={i} className={"aig-kpi t-" + (k.tone || "neutral")}>
              <div className="aig-kpi-l">{k.label}</div>
              <div className="aig-kpi-v">{k.value}</div>
              {k.note && <div className="aig-kpi-n">{k.note}</div>}
            </div>
          ))}
        </div>
      )}
      {sections.map((sec, i) => (
        <div key={i} className="aig-dash-sec">
          <div className="aig-dash-sec-h">{sec.heading}</div>
          <div className="aig-dash-sec-items">
            {sec.items?.map((it, j) => (
              <div key={j} className={"aig-item t-" + (it.tone || "neutral")}>
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

export default AiGenerateButton;
