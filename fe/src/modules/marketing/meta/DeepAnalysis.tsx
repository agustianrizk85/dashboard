// Deep Analysis — riset mendalam multi-agent untuk Meta Ads. Berbeda dari
// ✨ Generate AI (analisis data internal saja): di sini AI merancang panel
// hingga 9 agent riset (+ 1 sintesis = maksimal 10 agent) dan tiap agent bisa
// MERISET INTERNET (search + buka halaman kredibel) lewat tool loop di backend
// (/api/ai/deep-agent). Semua agent tunduk pada skill markdown di
// dashboard/skillmd (metodologi deep analysis + sumber kredibel). Hasil akhir:
// dashboard eksekutif bersitasi + daftar sumber yang benar-benar dibuka.
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_EXPIRED_EVENT } from "@/auth/AuthContext";
import type { MetaAds } from "./metaApi";
import { buildSnapshot, tryParseDash, DashboardOutput, type Dash } from "./MetaGenerate";

const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";

// Jalankan agent riset paralel secukupnya: cukup cepat tanpa membanjiri backend.
const CONCURRENCY = 3;

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

const SYNTHESIS: DeepAgent = {
  key: "synthesis",
  title: "Head of Marketing — Sintesis Deep Analysis",
  icon: "♛",
};

// Fallback panel bila planner tak terjangkau (cermin defaultDeepPlan backend).
const FALLBACK_AGENTS: DeepAgent[] = [
  { key: "funnel", title: "Analis Performa & Funnel", icon: "📈", instruksi: "Campaign pemenang vs boros, efisiensi funnel vs baseline internal.", peranan: "Media buyer senior Meta Ads properti.", kompetensi: "CPR/CPC/CPM/CTR." },
  { key: "benchmark", title: "Riset Benchmark Industri", icon: "🌐", instruksi: "Benchmark CTR/CPM/CPL real estate terbaru vs angka internal.", peranan: "Analis riset pasar digital advertising.", kompetensi: "Benchmark iklan.", riset: ["Meta Ads benchmark real estate CTR CPM 2026"] },
  { key: "pasar", title: "Riset Pasar Properti", icon: "🏘", instruksi: "Kondisi pasar (KPR, tren permintaan) → implikasi ke iklan.", peranan: "Analis pasar properti Indonesia.", kompetensi: "Tren rumah tapak Tangerang.", riset: ["suku bunga KPR Indonesia 2026"] },
  { key: "kreatif", title: "Auditor Kreatif & Copy", icon: "✍", instruksi: "Diagnosis CTR lemah / fatigue + usulan 3 angle baru.", peranan: "Creative strategist properti.", kompetensi: "Hook, angle, CTA." },
  { key: "aksi", title: "Strategist Realokasi & Aksi", icon: "🎯", instruksi: "Rencana realokasi budget spesifik dengan target angka.", peranan: "Ahli alokasi budget Meta Ads.", kompetensi: "Realokasi & struktur campaign." },
];

/** Pool paralel sederhana: kerjakan items dengan maksimal `limit` sekaligus. */
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

export function DeepAnalysis({ data, rangeLabel, onClose }: { data: MetaAds; rangeLabel: string; onClose: () => void }) {
  const [agents, setAgents] = useState<DeepAgent[]>([]);
  const [states, setStates] = useState<Record<string, AgState>>({});
  const [dash, setDash] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focus, setFocus] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const started = useRef(false);

  const authBase = AUTH_API.replace(/\/$/, "");
  const authHeaders = () => {
    const token = localStorage.getItem("gp_dashboard_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
  };

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
      return !!b.configured;
    } catch {
      setConfigured(false);
      return false;
    }
  }, [authBase]);

  // Info skill yang memerintah pipeline (dari dashboard/skillmd).
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
    const snapshot = buildSnapshot(data, rangeLabel);
    const fokus = focus.trim();

    // Tahap 1 — planner merancang panel agent riset (3–9, maks 10 dgn sintesis).
    setPlanning(true);
    let panel: DeepAgent[] = FALLBACK_AGENTS;
    try {
      const res = await fetch(authBase + "/ai/deep-plan", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ model: model.trim(), ads: snapshot, focus: fokus }),
      });
      if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      const body = (await res.json().catch(() => ({}))) as { agents?: DeepAgent[]; skills?: string[] };
      if (res.ok && body.agents?.length) panel = body.agents.slice(0, 9);
      if (body.skills?.length) setSkills(body.skills);
    } catch {
      /* planner tak terjangkau — pakai panel fallback */
    }
    setAgents(panel);
    setPlanning(false);
    setStates(Object.fromEntries([...panel, SYNTHESIS].map((a) => [a.key, { status: "idle" }])) as Record<string, AgState>);

    // Tahap 2 — agent riset berjalan PARALEL (masing-masing punya tool loop
    // search/open di backend), independen satu sama lain.
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
            agent: agent.key,
            model: model.trim(),
            ads: snapshot,
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

    // Tahap 3 — sintesis akhir menggabungkan semua hasil + sumber bersitasi.
    setStates((s) => ({ ...s, synthesis: { status: "running" } }));
    try {
      const res = await fetch(authBase + "/ai/deep-agent", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          agent: "synthesis",
          model: model.trim(),
          ads: snapshot,
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
  }, [data, rangeLabel, model, focus, authBase]);

  // Saat dibuka: cek konfigurasi. Deep analysis TIDAK auto-run (lebih berat &
  // lebih lama dari Generate AI) — pengguna menekan "Mulai Deep Analysis".
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

  return (
    <div className="meta-ai">
      <div className="meta-ai-bar">
        <button className="meta-ai-back" onClick={onClose}>← Kembali ke data</button>
        <div className="meta-ai-title">
          <b>🔬 Deep Analysis — Riset Mendalam Iklan</b>
          <span>
            Maks 10 agent AI (riset internet + data {rangeLabel})
            {skills.length > 0 && <> · skill: {skills.join(", ")}</>}
          </span>
        </div>
        <div className="meta-ai-model">
          <label>Model</label>
          <input
            list="deep-ai-models"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="glm-5.2:cloud"
            disabled={busy}
            title="Pilih / ketik model Ollama untuk analisis ini"
          />
          <datalist id="deep-ai-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <button className="meta-ai-rerun" onClick={() => void run()} disabled={busy || configured === false}>
          {busy ? "Meriset…" : agents.length ? "⟳ Jalankan ulang" : "🔬 Mulai Deep Analysis"}
        </button>
      </div>

      <div className="mai-deep-focus">
        <label>Fokus riset (opsional)</label>
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          disabled={busy}
          placeholder='Mis. "kenapa CPR naik bulan ini & berapa benchmark wajarnya?" — kosongkan untuk analisis menyeluruh'
        />
      </div>

      {configured === false && (
        <div className="meta-ai-keybar">
          <span className="mai-key-status">⚠ AI belum dikonfigurasi. Minta admin menyetel kunci di <b>Panel Admin → 🔑 Kunci AI</b>.</span>
        </div>
      )}

      {planning && <div className="meta-ai-plan">🧭 AI sedang merancang panel agent riset (maks 10) untuk data & fokus ini…</div>}

      {agents.length > 0 && (
        <div className="meta-ai-agents">
          {[...agents, SYNTHESIS].map((a, i) => {
            const st = states[a.key] ?? { status: "idle" as const };
            return (
              <div key={a.key} className={"meta-ai-agent " + st.status}>
                <div className="mai-ag-head">
                  <span className="mai-ag-icon">{a.icon}</span>
                  <div className="mai-ag-titles">
                    <b>{a.title}</b>
                    <span>{a.key === "synthesis" ? "Dashboard eksekutif bersitasi" : a.instruksi ?? ""}</span>
                  </div>
                  <span className={"mai-ag-badge " + st.status}>
                    {st.status === "idle" ? "menunggu" : st.status === "running" ? (a.key === "synthesis" ? "menyintesis…" : "meriset…") : st.status === "done" ? "selesai" : "gagal"}
                  </span>
                </div>
                {(st.steps?.length ?? 0) > 0 && (
                  <div className="mai-steps">
                    {st.steps!.map((sp, j) => (
                      <span key={j} className={"mai-step" + (sp.ok ? "" : " fail")} title={sp.note ?? ""}>
                        {sp.tool === "search" ? "🔎" : "📄"} {sp.arg.length > 60 ? sp.arg.slice(0, 60) + "…" : sp.arg}
                      </span>
                    ))}
                  </div>
                )}
                {(st.sources?.length ?? 0) > 0 && a.key !== "synthesis" && (
                  <div className="mai-src-row">
                    {st.sources!.map((src, j) => (
                      <a key={j} className="mai-src-chip" href={src.url} target="_blank" rel="noreferrer" title={src.url}>
                        🔗 {src.title || src.url}
                      </a>
                    ))}
                  </div>
                )}
                {st.status === "error" && <div className="mai-ag-err">{st.error}</div>}
                {st.output && a.key !== "synthesis" && (
                  <>
                    <button className="mai-ag-toggle" onClick={() => setExpanded((e) => ({ ...e, [a.key]: !e[a.key] }))}>
                      {expanded[a.key] ? "▾ Sembunyikan hasil riset" : "▸ Lihat hasil riset agent #" + (i + 1)}
                    </button>
                    {expanded[a.key] && <div className="mai-ag-out">{st.output}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(states.synthesis?.status === "done" || states.synthesis?.status === "error") && (
        <>
          <DashboardOutput
            dash={dash}
            data={data}
            rangeLabel={rangeLabel}
            analysts={agents
              .map((a) => ({ title: a.title, icon: a.icon, output: states[a.key]?.output ?? "" }))
              .filter((x) => x.output && x.output !== "(kosong)")}
          />
          {allSources.length > 0 && (
            <div className="mai-src-list">
              <div className="mai-dash-sec-h">🔗 Sumber riset yang dibuka ({allSources.length})</div>
              <div className="mai-src-row">
                {allSources.map((src, i) => (
                  <a key={i} className="mai-src-chip" href={src.url} target="_blank" rel="noreferrer" title={src.url}>
                    {src.title || src.url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
