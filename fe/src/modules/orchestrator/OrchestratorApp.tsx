import { useCallback, useState } from "react";
import { useAuth, AUTH_EXPIRED_EVENT } from "@/auth/AuthContext";
import { DivisionTabs } from "@/components/DivisionTabs";
import "./orchestrator.css";

/** The 5-stage pipeline, in the fixed order set by the product owner. */
const STAGES = [
  { key: "ceo", label: "CEO — Arah Strategis", icon: "♛", hint: "Menetapkan prioritas lintas divisi" },
  { key: "solusi", label: "Solusi", icon: "✦", hint: "Usulan konkret & actionable" },
  { key: "permasalahan", label: "Permasalahan", icon: "⚠", hint: "Risiko & hambatan utama" },
  { key: "overview", label: "Overview — Dashboard", icon: "▦", hint: "Dashboard eksekutif tergenerate" },
  { key: "approval", label: "Persetujuan", icon: "✓", hint: "Keputusan untuk disetujui" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

/** Division data sources (read-only). permit/legal has no dev backend, so it's
 *  gathered best-effort and skipped when unreachable. */
const DIVS = [
  { key: "sales", label: "Sales", base: (import.meta.env.VITE_SALES_API as string) ?? "http://localhost:8085", token: "gp_sales_token" },
  { key: "keuangan", label: "Keuangan", base: (import.meta.env.VITE_KEUANGAN_API as string) ?? "http://localhost:8084", token: "gp_keuangan_token" },
  { key: "perencanaan", label: "Perencanaan", base: (import.meta.env.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082", token: "gp_perencanaan_token" },
  { key: "marketing", label: "Marketing", base: (import.meta.env.VITE_MARKETING_API as string) ?? "http://localhost:8086", token: "marketingflow_token" },
];
const HEAVY = ["saleRows", "byProject", "akads", "leads", "rows"];
const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";

const roleLabel: Record<string, string> = { ceo: "CEO", dirops: "Direktur Operasional", kadep: "Kepala Departemen" };

type StageState = { status: "idle" | "running" | "done" | "error"; output?: string; error?: string };
type Decision = { judul: string; divisi?: string; pic?: string; dampak?: string; rekomendasi?: string; vote?: "setuju" | "tolak" };
type Tone = "ok" | "warn" | "bad" | "neutral";
type DashKpi = { label: string; value: string; note?: string; tone?: Tone };
type DashSection = { heading: string; items: { title: string; detail?: string; tone?: Tone }[] };
type Dash = { title?: string; kpis?: DashKpi[]; sections?: DashSection[] };

/** Extract the first JSON object from model output (tolerating prose/fences). */
function tryParseDashboard(output: string): Dash | null {
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

/** Pull a compact dashboard snapshot for one division (heavy arrays stripped). */
async function fetchDivision(d: (typeof DIVS)[number]): Promise<string | null> {
  const token = localStorage.getItem(d.token);
  try {
    const res = await fetch(d.base.replace(/\/$/, "") + "/api/dashboard", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (j && typeof j === "object") HEAVY.forEach((k) => delete j[k]);
    let s = JSON.stringify(j);
    if (s.length > 3500) s = s.slice(0, 3500) + "…";
    return s;
  } catch {
    return null;
  }
}

function tryParseDecisions(output: string): Decision[] | null {
  const i = output.indexOf("[");
  const j = output.lastIndexOf("]");
  if (i < 0 || j <= i) return null;
  try {
    const arr = JSON.parse(output.slice(i, j + 1)) as Decision[];
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export default function OrchestratorApp() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [phase, setPhase] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(DIVS.map((d) => [d.key, true])));
  const [dash, setDash] = useState<Dash | null>(null);
  const [states, setStates] = useState<Record<StageKey, StageState>>(() =>
    Object.fromEntries(STAGES.map((s) => [s.key, { status: "idle" }])) as Record<StageKey, StageState>,
  );
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  // The division snapshot from the last run, kept so a per-stage revision can
  // re-ground the model without re-fetching every division.
  const [divData, setDivData] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<Record<string, string>>({});
  const [revising, setRevising] = useState<StageKey | null>(null);

  const run = useCallback(async () => {
    const chosen = DIVS.filter((d) => selected[d.key]);
    if (chosen.length === 0) return;
    setBusy(true);
    setDecisions(null);
    setDash(null);
    setStates(Object.fromEntries(STAGES.map((s) => [s.key, { status: "idle" }])) as Record<StageKey, StageState>);

    // 1) Gather the selected divisions' data (best-effort, in parallel).
    setPhase("Memuat data divisi terpilih…");
    const results = await Promise.all(chosen.map(async (d) => ({ d, data: await fetchDivision(d) })));
    const divisions: Record<string, string> = {};
    const ok: string[] = [];
    for (const { d, data } of results) {
      if (data) {
        divisions[d.key] = data;
        ok.push(d.label);
      }
    }
    setLoaded(ok);
    setDivData(divisions);
    if (ok.length === 0) {
      setPhase("");
      setBusy(false);
      setStates((s) => ({ ...s, ceo: { status: "error", error: "Tidak ada data divisi yang bisa dimuat. Pastikan backend divisi berjalan & Anda sudah login." } }));
      return;
    }

    // 2) Run the pipeline sequentially, threading prior outputs forward.
    const token = localStorage.getItem("gp_dashboard_token");
    const prior: Record<string, string> = {};
    for (const stage of STAGES) {
      setPhase(`Menjalankan tahap: ${stage.label}…`);
      setStates((s) => ({ ...s, [stage.key]: { status: "running" } }));
      try {
        const res = await fetch(AUTH_API + "/ai/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
          body: JSON.stringify({ stage: stage.key, divisions, prior }),
        });
        if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        const body = (await res.json().catch(() => ({}))) as { output?: string; error?: string };
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const output = body.output || "(kosong)";
        setStates((s) => ({ ...s, [stage.key]: { status: "done", output } }));
        prior[stage.key] = output.length > 1200 ? output.slice(0, 1200) : output;
        if (stage.key === "overview") setDash(tryParseDashboard(output));
        if (stage.key === "approval") setDecisions(tryParseDecisions(output));
      } catch (e) {
        setStates((s) => ({ ...s, [stage.key]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
        break;
      }
    }
    setPhase("");
    setBusy(false);
  }, [selected]);

  // Re-run a single stage with a user follow-up / revision request, keeping the
  // existing output visible until the revised one arrives.
  const revise = useCallback(
    async (stage: (typeof STAGES)[number]) => {
      const q = (ask[stage.key] || "").trim();
      if (!q || revising) return;
      const idx = STAGES.findIndex((s) => s.key === stage.key);
      const prior: Record<string, string> = {};
      for (let i = 0; i < idx; i++) {
        const o = states[STAGES[i].key].output;
        if (o) prior[STAGES[i].key] = o.length > 1200 ? o.slice(0, 1200) : o;
      }
      setRevising(stage.key);
      const token = localStorage.getItem("gp_dashboard_token");
      try {
        const res = await fetch(AUTH_API + "/ai/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
          body: JSON.stringify({ stage: stage.key, divisions: divData, prior, question: q, current: states[stage.key].output || "" }),
        });
        if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        const body = (await res.json().catch(() => ({}))) as { output?: string; error?: string };
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const output = body.output || "(kosong)";
        setStates((s) => ({ ...s, [stage.key]: { status: "done", output } }));
        if (stage.key === "overview") setDash(tryParseDashboard(output));
        if (stage.key === "approval") setDecisions(tryParseDecisions(output));
        setAsk((a) => ({ ...a, [stage.key]: "" }));
      } catch (e) {
        setStates((s) => ({ ...s, [stage.key]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
      } finally {
        setRevising(null);
      }
    },
    [ask, revising, states, divData],
  );

  const setVote = (i: number, vote: "setuju" | "tolak") =>
    setDecisions((d) => (d ? d.map((x, k) => (k === i ? { ...x, vote: x.vote === vote ? undefined : vote } : x)) : d));

  return (
    <div className="orc-stage">
      <header className="orc-hdr">
        <div className="orc-hdr-logo">
          <img src="/brand/logo-mark.png" alt="Greenpark Group" />
        </div>
        <div className="orc-hdr-titles">
          <h1>Orchestrator AI</h1>
          <div className="orc-sub">Greenpark Group · Analisis & Keputusan Lintas Divisi</div>
        </div>
        <div className="orc-hdr-spacer" />
        <div className="orc-hdr-user">
          <div className="hu-name">{user?.name}</div>
          <div className="hu-role">{user ? roleLabel[user.role] ?? user.role : ""}</div>
        </div>
        <button className="orc-logout" onClick={logout} title="Keluar">
          ✕
        </button>
      </header>

      <nav className="orc-nav">
        <DivisionTabs />
      </nav>

      <main className="orc-content">
        <div className="orc-intro">
          <div className="orc-intro-main">
            <h2>Pipeline Orchestrator</h2>
            <p>
              AI membaca data divisi terpilih lalu menjalankan 5 tahap berurutan: CEO → Solusi → Permasalahan →
              Overview (dashboard) → Persetujuan. Tiap tahap bisa Anda tanyai atau minta revisi setelah selesai.
              Read-only — tidak mengubah data divisi.
            </p>
            <div className="orc-divpick">
              <span className="orc-divpick-l">Divisi:</span>
              {DIVS.map((d) => (
                <label key={d.key} className={"orc-divopt" + (selected[d.key] ? " on" : "")}>
                  <input
                    type="checkbox"
                    checked={!!selected[d.key]}
                    disabled={busy}
                    onChange={() => setSelected((s) => ({ ...s, [d.key]: !s[d.key] }))}
                  />
                  {d.label}
                </label>
              ))}
            </div>
            {loaded.length > 0 && (
              <div className="orc-loaded">
                Divisi termuat: {loaded.map((l) => <span key={l} className="orc-chip">{l}</span>)}
              </div>
            )}
          </div>
          <button className="orc-run" onClick={() => void run()} disabled={busy || !Object.values(selected).some(Boolean)}>
            {busy ? "Menjalankan…" : "▶ Jalankan Orchestrator"}
          </button>
        </div>
        {phase && <div className="orc-phase">{phase}</div>}

        <ol className="orc-pipe">
          {STAGES.map((stage, idx) => {
            const st = states[stage.key];
            const isRevising = revising === stage.key;
            const visStatus = isRevising ? "running" : st.status;
            return (
              <li key={stage.key} className={"orc-step " + visStatus}>
                <div className="orc-step-rail">
                  <span className="orc-step-dot">{stage.icon}</span>
                  {idx < STAGES.length - 1 && <span className="orc-step-line" />}
                </div>
                <div className="orc-step-card">
                  <div className="orc-step-head">
                    <span className="orc-step-no">{idx + 1}</span>
                    <div>
                      <b>{stage.label}</b>
                      <span className="orc-step-hint">{stage.hint}</span>
                    </div>
                    <span className={"orc-badge " + visStatus}>
                      {isRevising
                        ? "merevisi…"
                        : st.status === "idle"
                          ? "menunggu"
                          : st.status === "running"
                            ? "memproses…"
                            : st.status === "done"
                              ? "selesai"
                              : "gagal"}
                    </span>
                  </div>

                  {st.status === "error" && <div className="orc-err">{st.error}</div>}

                  {stage.key === "overview" && st.status === "done" && dash ? (
                    <DashboardOutput dash={dash} />
                  ) : stage.key === "approval" && st.status === "done" && decisions ? (
                    <div className="orc-decisions">
                      {decisions.map((d, i) => (
                        <div key={i} className={"orc-dec" + (d.vote ? " v-" + d.vote : "")}>
                          <div className="orc-dec-main">
                            <b>{d.judul}</b>
                            <div className="orc-dec-meta">
                              {d.divisi && <span className="orc-tag">{d.divisi}</span>}
                              {d.pic && <span>PIC: {d.pic}</span>}
                              {d.rekomendasi && <span className={"orc-reco r-" + d.rekomendasi}>Rekom: {d.rekomendasi}</span>}
                            </div>
                            {d.dampak && <div className="orc-dec-dampak">{d.dampak}</div>}
                          </div>
                          <div className="orc-dec-act">
                            <button className={"ok" + (d.vote === "setuju" ? " on" : "")} onClick={() => setVote(i, "setuju")}>
                              Setuju
                            </button>
                            <button className={"no" + (d.vote === "tolak" ? " on" : "")} onClick={() => setVote(i, "tolak")}>
                              Tolak
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    st.output && <div className="orc-out">{st.output}</div>
                  )}

                  {(st.status === "done" || isRevising) && !busy && (
                    <div className="orc-ask">
                      <input
                        type="text"
                        className="orc-ask-input"
                        placeholder="Tanya atau minta revisi tahap ini…"
                        value={ask[stage.key] || ""}
                        disabled={revising !== null}
                        onChange={(e) => setAsk((a) => ({ ...a, [stage.key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void revise(stage);
                        }}
                      />
                      <button
                        className="orc-ask-btn"
                        disabled={revising !== null || !(ask[stage.key] || "").trim()}
                        onClick={() => void revise(stage)}
                      >
                        {isRevising ? "Merevisi…" : "Revisi"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}

/** Renders the AI-generated executive dashboard (Overview stage output). */
function DashboardOutput({ dash }: { dash: Dash }) {
  return (
    <div className="orc-dash">
      {dash.title && <div className="orc-dash-title">{dash.title}</div>}
      {dash.kpis && dash.kpis.length > 0 && (
        <div className="orc-dash-kpis">
          {dash.kpis.map((k, i) => (
            <div key={i} className={"orc-kpi t-" + (k.tone || "neutral")}>
              <div className="orc-kpi-l">{k.label}</div>
              <div className="orc-kpi-v">{k.value}</div>
              {k.note && <div className="orc-kpi-n">{k.note}</div>}
            </div>
          ))}
        </div>
      )}
      {dash.sections?.map((sec, i) => (
        <div key={i} className="orc-dash-sec">
          <div className="orc-dash-sec-h">{sec.heading}</div>
          <div className="orc-dash-sec-items">
            {sec.items?.map((it, j) => (
              <div key={j} className={"orc-item t-" + (it.tone || "neutral")}>
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
