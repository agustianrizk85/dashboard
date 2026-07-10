/**
 * "🔬 Deep Analysis" — division-agnostic deep-research pipeline, the generic
 * sibling of the Marketing Meta Ads deep analysis (modules/marketing/meta/
 * DeepAnalysis.tsx) built on the same auth endpoints:
 *
 *   1. fetch the division's compact dashboard snapshot (aiDivisions.ts)
 *   2. POST /ai/deep-plan  → AI designs 3–19 research agents for this data
 *   3. POST /ai/deep-agent → each agent runs a server-side tool loop and may
 *      RESEARCH THE INTERNET (search + open credible pages), in parallel
 *   4. POST /ai/deep-agent (synthesis) → cited executive dashboard
 *
 * Heavier than ✨ Generate AI, so it never auto-runs — the user presses
 * "Mulai Deep Analysis". Drop `<DeepAnalysisButton division="sales" />` into
 * any dashboard header.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_EXPIRED_EVENT } from "@/auth/AuthContext";
import { AI_DIVS, type DivKey } from "./aiDivisions";
import { DashboardOutput, tryParseDash, type Dash } from "./AiGenerate";
import "./ai-generate.css";

const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";

// Research agents run in parallel — enough to be fast without flooding :8090.
const CONCURRENCY = 4;

type DeepAgent = {
  key: string;
  title: string;
  icon: string;
  peranan?: string;
  kompetensi?: string;
  instruksi?: string;
  output?: string;
  riset?: string[];
};

type Source = { title: string; url: string };
type Step = { tool: string; arg: string; ok: boolean; note?: string };
type AgState = {
  status: "idle" | "running" | "done" | "error";
  output?: string;
  error?: string;
  sources?: Source[];
  steps?: Step[];
};

// Fallback panel when the planner is unreachable (mirrors the backend's
// genericDeepPlan).
const FALLBACK_AGENTS: DeepAgent[] = [
  { key: "kinerja", title: "Analis Kinerja Internal", icon: "📊", instruksi: "Capaian vs target dari data internal; pemenang & masalah terbesar." },
  { key: "benchmark", title: "Riset Benchmark Industri", icon: "🌐", instruksi: "Benchmark eksternal terbaru vs angka internal.", riset: ["benchmark industri properti Indonesia 2026"] },
  { key: "pasar", title: "Riset Pasar Properti", icon: "🏘", instruksi: "Kondisi pasar (KPR, tren permintaan) → implikasi ke divisi.", riset: ["suku bunga KPR Indonesia 2026"] },
  { key: "risiko", title: "Auditor Risiko & Kualitas Data", icon: "⚠", instruksi: "Risiko & anomali dari data internal + dampaknya." },
  { key: "aksi", title: "Strategist Aksi & Prioritas", icon: "🎯", instruksi: "Rencana aksi spesifik dengan target angka." },
];

/** Simple parallel pool: process items with at most `limit` in flight. */
async function runPool<T>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) return;
      await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export function DeepAnalysisButton({ division, className }: { division: DivKey; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={"aig-btn aig-btn-deep " + (className ?? "")} onClick={() => setOpen(true)} title="Riset mendalam multi-agent dengan riset internet">
        🔬 Deep Analysis
      </button>
      {open && <DeepAnalysisPanel division={division} onClose={() => setOpen(false)} />}
    </>
  );
}

function DeepAnalysisPanel({ division, onClose }: { division: DivKey; onClose: () => void }) {
  const div = AI_DIVS[division];
  const SYNTHESIS: DeepAgent = { key: "synthesis", title: `Head of ${div.label} — Sintesis Deep Analysis`, icon: "♛" };

  const [agents, setAgents] = useState<DeepAgent[]>([]);
  const [states, setStates] = useState<Record<string, AgState>>({});
  const [dash, setDash] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focus, setFocus] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [noData, setNoData] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const started = useRef(false);

  const authBase = AUTH_API.replace(/\/$/, "");
  const authHeaders = useCallback((): HeadersInit => {
    const token = localStorage.getItem("gp_dashboard_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(authBase + "/ai/config", { headers: authHeaders() });
      const b = (await res.json().catch(() => ({}))) as { configured?: boolean; model?: string };
      setConfigured(!!b.configured);
      setModel((m) => m || b.model || "");
      if (b.configured) {
        void fetch(authBase + "/ai/models", { headers: authHeaders() })
          .then((r) => (r.ok ? r.json() : null))
          .then((mb: { models?: string[] } | null) => mb && setModels(mb.models ?? []))
          .catch(() => undefined);
      }
    } catch {
      setConfigured(false);
    }
  }, [authBase, authHeaders]);

  // Show which skill files (dashboard/skillmd) govern the pipeline.
  useEffect(() => {
    void fetch(authBase + "/ai/deep-skills", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { skills?: string[] } | null) => b && setSkills(b.skills ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authBase]);

  const run = useCallback(async () => {
    setBusy(true);
    setDash(null);
    setStates({});
    setNoData(false);
    const fokus = focus.trim();

    // 0) The division's own snapshot grounds every agent.
    const snapshot = await div.fetchSnapshot();
    if (!snapshot) {
      setNoData(true);
      setBusy(false);
      return;
    }

    // 1) Planner designs the research panel (3–19 agents).
    setPlanning(true);
    let panel: DeepAgent[] = FALLBACK_AGENTS;
    try {
      const res = await fetch(authBase + "/ai/deep-plan", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ division: div.key, label: div.label, model: model.trim(), data: snapshot, focus: fokus }),
      });
      if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      const body = (await res.json().catch(() => ({}))) as { agents?: DeepAgent[]; skills?: string[] };
      if (res.ok && body.agents?.length) panel = body.agents;
      if (body.skills?.length) setSkills(body.skills);
    } catch {
      /* planner unreachable — keep the fallback panel */
    }
    setAgents(panel);
    setPlanning(false);
    setStates(Object.fromEntries([...panel, SYNTHESIS].map((a) => [a.key, { status: "idle" }])) as Record<string, AgState>);

    // 2) Research agents run in PARALLEL, each with its own server-side
    //    search/open tool loop.
    const outputs: Record<string, string> = {};
    const allSources: Source[] = [];
    const seen = new Set<string>();
    await runPool(panel, CONCURRENCY, async (agent) => {
      setStates((s) => ({ ...s, [agent.key]: { status: "running" } }));
      try {
        const res = await fetch(authBase + "/ai/deep-agent", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            division: div.key,
            label: div.label,
            agent: agent.key,
            model: model.trim(),
            data: snapshot,
            focus: fokus,
            title: agent.title,
            peranan: agent.peranan,
            kompetensi: agent.kompetensi,
            instruksi: agent.instruksi,
            output: agent.output,
            riset: agent.riset ?? [],
          }),
        });
        if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        const body = (await res.json().catch(() => ({}))) as { output?: string; sources?: Source[]; steps?: Step[]; error?: string };
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const output = body.output || "(kosong)";
        outputs[agent.key] = output.length > 1400 ? output.slice(0, 1400) : output;
        for (const src of body.sources ?? []) {
          if (src.url && !seen.has(src.url)) {
            seen.add(src.url);
            allSources.push(src);
          }
        }
        setStates((s) => ({ ...s, [agent.key]: { status: "done", output, sources: body.sources, steps: body.steps } }));
      } catch (e) {
        setStates((s) => ({ ...s, [agent.key]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
      }
    });

    // 3) Synthesis merges everything into the cited executive dashboard.
    setStates((s) => ({ ...s, synthesis: { status: "running" } }));
    try {
      const res = await fetch(authBase + "/ai/deep-agent", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          division: div.key,
          label: div.label,
          agent: "synthesis",
          model: model.trim(),
          data: snapshot,
          focus: fokus,
          prior: outputs,
          sources: allSources,
        }),
      });
      if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      const body = (await res.json().catch(() => ({}))) as { output?: string; error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const output = body.output || "(kosong)";
      setStates((s) => ({ ...s, synthesis: { status: "done", output, sources: allSources } }));
      setDash(tryParseDash(output));
    } catch (e) {
      setStates((s) => ({ ...s, synthesis: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [div, model, focus, authBase, authHeaders]);

  // On open: read the AI config only. Deep analysis is heavy — no auto-run.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSources: Source[] = [];
  {
    const seen = new Set<string>();
    for (const a of [...agents, SYNTHESIS]) {
      for (const src of states[a.key]?.sources ?? []) {
        if (src.url && !seen.has(src.url)) {
          seen.add(src.url);
          allSources.push(src);
        }
      }
    }
  }

  const synthDone = states.synthesis?.status === "done" || states.synthesis?.status === "error";
  const analysts = agents
    .map((a) => ({ title: a.title, icon: a.icon || "🔎", output: states[a.key]?.output ?? "" }))
    .filter((x) => x.output && x.output !== "(kosong)");

  return (
    <div className="aig-overlay" onClick={onClose}>
      <div className="aig-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aig-bar">
          <div className="aig-title">
            <b>🔬 Deep Analysis — {div.label}</b>
            <span>
              Maks 20 agent AI (riset internet gigih + data divisi)
              {skills.length > 0 && <> · skill: {skills.join(", ")}</>}
            </span>
          </div>
          <div className="aig-model">
            <label>Model</label>
            <input
              list="aig-deep-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="glm-5.2:cloud"
              disabled={busy}
              title="Pilih / ketik model Ollama untuk analisis ini"
            />
            <datalist id="aig-deep-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <button className="aig-rerun" onClick={() => void run()} disabled={busy || configured === false}>
            {busy ? "Meriset…" : agents.length ? "⟳ Jalankan ulang" : "🔬 Mulai Deep Analysis"}
          </button>
          <button className="aig-close" onClick={onClose} title="Tutup">
            ✕
          </button>
        </div>

        <div className="aig-body">
          <div className="aig-deep-focus">
            <label>Fokus riset (opsional)</label>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={busy}
              placeholder='Mis. "kenapa cash-in meleset dari target & berapa benchmark wajarnya?" — kosongkan untuk analisis menyeluruh'
            />
          </div>

          {configured === false && (
            <div className="aig-keybar">
              <span className="aig-key-status">⚠ AI belum dikonfigurasi. Minta admin menyetel kunci di <b>Panel Admin → 🔑 Kunci AI</b>.</span>
            </div>
          )}
          {noData && (
            <div className="aig-nodata">
              📭 Data divisi <b>{div.label}</b> tak bisa dimuat. Pastikan backend divisi berjalan & Anda punya akses.
            </div>
          )}
          {planning && <div className="aig-plan">🧭 AI sedang merancang panel agent riset (maks 20) untuk data & fokus ini…</div>}

          {agents.length > 0 && (
            <div className="aig-agents">
              {[...agents, SYNTHESIS].map((a, i) => {
                const st = states[a.key] ?? { status: "idle" as const };
                return (
                  <div key={a.key} className={"aig-agent " + st.status}>
                    <div className="aig-ag-head">
                      <span className="aig-ag-icon">{a.icon || "🔎"}</span>
                      <div className="aig-ag-titles">
                        <b>{a.title}</b>
                        <span>{a.key === "synthesis" ? "Dashboard eksekutif bersitasi" : a.instruksi ?? ""}</span>
                      </div>
                      <span className={"aig-ag-badge " + st.status}>
                        {st.status === "idle" ? "menunggu" : st.status === "running" ? (a.key === "synthesis" ? "menyintesis…" : "meriset…") : st.status === "done" ? "selesai" : "gagal"}
                      </span>
                    </div>
                    {(st.steps?.length ?? 0) > 0 && (
                      <div className="aig-steps">
                        {st.steps!.map((sp, j) => (
                          <span key={j} className={"aig-step" + (sp.ok ? "" : " fail")} title={sp.note ?? ""}>
                            {sp.tool === "search" ? "🔎" : "📄"} {sp.arg.length > 60 ? sp.arg.slice(0, 60) + "…" : sp.arg}
                          </span>
                        ))}
                      </div>
                    )}
                    {(st.sources?.length ?? 0) > 0 && a.key !== "synthesis" && (
                      <div className="aig-src-row">
                        {st.sources!.map((src, j) => (
                          <a key={j} className="aig-src-chip" href={src.url} target="_blank" rel="noreferrer" title={src.url}>
                            🔗 {src.title || src.url}
                          </a>
                        ))}
                      </div>
                    )}
                    {st.status === "error" && <div className="aig-ag-err">{st.error}</div>}
                    {st.output && a.key !== "synthesis" && (
                      <>
                        <button className="aig-ag-toggle" onClick={() => setExpanded((e) => ({ ...e, [a.key]: !e[a.key] }))}>
                          {expanded[a.key] ? "▾ Sembunyikan hasil riset" : "▸ Lihat hasil riset agent #" + (i + 1)}
                        </button>
                        {expanded[a.key] && <div className="aig-ag-out">{st.output}</div>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {synthDone && (
            <>
              <DashboardOutput dash={dash} label={div.label} analysts={analysts} />
              {allSources.length > 0 && (
                <div className="aig-src-list">
                  <div className="aig-dash-sec-h">🔗 Sumber riset yang dibuka ({allSources.length})</div>
                  <div className="aig-src-row">
                    {allSources.map((src, i) => (
                      <a key={i} className="aig-src-chip" href={src.url} target="_blank" rel="noreferrer" title={src.url}>
                        {src.title || src.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeepAnalysisButton;
