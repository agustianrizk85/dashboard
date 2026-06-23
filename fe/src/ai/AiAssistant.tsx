import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import "./ai.css";

/** Live grounding a page publishes so the assistant can answer about its data. */
export interface Grounding {
  /** Division/area label, e.g. "Sales", "Keuangan". */
  division: string;
  /** Optional sub-page / tab, e.g. "Control Tower". */
  page?: string;
  /** Compact JSON-able summary of what's on screen (the source of truth). */
  data?: unknown;
}

type GroundingCtx = { setGrounding: (g: Grounding | null) => void };
const AiGroundingContext = createContext<GroundingCtx>({ setGrounding: () => {} });

/** Map a route prefix to a human division label (fallback grounding). */
const ROUTE_DIVISION: Record<string, string> = {
  perencanaan: "Perencanaan",
  permit: "Legal & Perizinan",
  marketing: "Marketing",
  sales: "Sales",
  keuangan: "Keuangan",
  approvals: "Persetujuan",
  rekap: "Rekap Penjualan",
  "ai-import": "AI Import",
  admin: "Admin",
};

const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";
const TOKEN_KEY = "gp_dashboard_token";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Pages call this to publish their live data for grounding:
 *   const setG = useAiGrounding();
 *   useEffect(() => setG({ division: "Sales", page: "Control Tower", data: summary }), [summary]);
 * Returns a stable setter; the published context is cleared on unmount.
 */
export function useAiGrounding(): (g: Grounding | null) => void {
  const { setGrounding } = useContext(AiGroundingContext);
  useEffect(() => () => setGrounding(null), [setGrounding]);
  return setGrounding;
}

/**
 * Provides grounding context to the tree and renders the floating chat widget.
 * Mount once, inside the auth + router providers, wrapping the routes.
 */
export function AiAssistant({ children }: { children: ReactNode }) {
  const [grounding, setGrounding] = useState<Grounding | null>(null);
  const ctx = useMemo<GroundingCtx>(() => ({ setGrounding }), []);
  return (
    <AiGroundingContext.Provider value={ctx}>
      {children}
      <AiChatWidget grounding={grounding} />
    </AiGroundingContext.Provider>
  );
}

function AiChatWidget({ grounding }: { grounding: Grounding | null }) {
  const { status } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Runtime API-key configuration (set from this UI, no server restart).
  const [config, setConfig] = useState<{ configured: boolean; model: string } | null>(null);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(AUTH_API + "/ai/config", { headers: token ? { Authorization: "Bearer " + token } : {} });
      if (res.ok) setConfig((await res.json()) as { configured: boolean; model: string });
    } catch {
      /* leave config null */
    }
  }, []);

  useEffect(() => {
    if (open && config === null) void loadConfig();
  }, [open, config, loadConfig]);

  const saveKey = useCallback(async () => {
    if (!keyInput.trim() || savingKey) return;
    setSavingKey(true);
    setError("");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(AUTH_API + "/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ key: keyInput.trim(), model: modelInput.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { configured?: boolean; model?: string; error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setConfig({ configured: !!body.configured, model: body.model || "" });
      setShowKeyForm(false);
      setKeyInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingKey(false);
    }
  }, [keyInput, modelInput, savingKey]);

  // Division derived from the URL — used when the page hasn't published richer
  // grounding, so the assistant still knows where the user is.
  const routeDivision = useMemo(() => {
    const seg = location.pathname.split("/").filter(Boolean)[0] ?? "";
    return ROUTE_DIVISION[seg] ?? "Dashboard";
  }, [location.pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(AUTH_API + "/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({
          messages: next,
          division: grounding?.division || routeDivision,
          page: grounding?.page || "",
          context: grounding?.data ?? null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setTurns((t) => [...t, { role: "assistant", content: body.reply || "(kosong)" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [input, busy, turns, grounding, routeDivision]);

  if (status !== "in") return null;

  const grounded = grounding?.data != null;
  const where = grounding?.page ? `${grounding.division} · ${grounding.page}` : grounding?.division || routeDivision;
  const needKey = showKeyForm || (config !== null && !config.configured);

  return (
    <>
      <button
        className={"ai-fab" + (open ? " on" : "")}
        onClick={() => setOpen((o) => !o)}
        title="Asisten AI Greenpark"
        aria-label="Buka asisten AI"
      >
        {open ? "✕" : <AiSparkIcon />}
      </button>

      {open && (
        <div className="ai-panel" role="dialog" aria-label="Asisten AI">
          <header className="ai-head">
            <div className="ai-head-t">
              <AiSparkIcon />
              <div>
                <b>Asisten AI</b>
                <span className={"ai-scope" + (grounded ? " grounded" : "")}>
                  {grounded ? "● " : "○ "}
                  {where}
                </span>
              </div>
            </div>
            <div className="ai-head-act">
              <button
                className="ai-clear"
                onClick={() => {
                  setModelInput(config?.model || "");
                  setShowKeyForm((v) => !v);
                }}
                title="Atur API key"
              >
                ⚙
              </button>
              <button className="ai-clear" onClick={() => setTurns([])} title="Bersihkan percakapan">
                ⟲
              </button>
            </div>
          </header>

          {needKey ? (
            <div className="ai-body">
              <div className="ai-keyform">
                <b>Atur OpenRouter API Key</b>
                <p>Asisten AI butuh API key OpenRouter. Key disimpan di server (auth), bukan di browser.</p>
                <label>API Key</label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-or-v1-…"
                  autoComplete="off"
                />
                <label>Model (opsional)</label>
                <input
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="openai/gpt-oss-120b:free"
                />
                {error && <div className="ai-err">{error}</div>}
                <div className="ai-keyform-act">
                  <button className="save" onClick={() => void saveKey()} disabled={savingKey || !keyInput.trim()}>
                    {savingKey ? "Menyimpan…" : "Simpan & Aktifkan"}
                  </button>
                  {config?.configured && (
                    <button className="cancel" onClick={() => setShowKeyForm(false)}>
                      Batal
                    </button>
                  )}
                </div>
                <a className="ai-keyform-link" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                  Dapatkan API key →
                </a>
              </div>
            </div>
          ) : (
            <div className="ai-body" ref={scrollRef}>
              {turns.length === 0 && (
                <div className="ai-empty">
                  <p>Tanya apa saja tentang halaman ini.</p>
                  <div className="ai-suggest">
                    {(grounded
                      ? ["Ringkas kondisi halaman ini", "Apa yang perlu diperhatikan?", "Jelaskan angka utamanya"]
                      : ["Apa fungsi halaman ini?", "Bagaimana cara membaca dashboard ini?"]
                    ).map((s) => (
                      <button key={s} onClick={() => setInput(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((t, i) => (
                <div key={i} className={"ai-msg " + t.role}>
                  {t.content}
                </div>
              ))}
              {busy && <div className="ai-msg assistant ai-typing"><span /><span /><span /></div>}
              {error && <div className="ai-err">{error}</div>}
            </div>
          )}

          <form
            className="ai-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            hidden={needKey}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Tulis pertanyaan…"
              rows={1}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Kirim">
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function AiSparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"
        fill="currentColor"
      />
      <circle cx="18.5" cy="17.5" r="2.2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
