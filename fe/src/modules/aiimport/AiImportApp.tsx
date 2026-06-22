import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ai-import.css";

/** sheets-api base (read-only Google Sheets bridge + AI mapper). */
const SHEETS = ((import.meta.env.VITE_SHEETS_API as string) ?? "http://localhost:8091").replace(/\/$/, "");
const KEY_LS = "gp_openrouter_key";

interface TabInfo {
  title: string;
  rows: number;
  cols: number;
}
interface MapResult {
  spreadsheetId?: string;
  tab?: string | null;
  model?: string;
  headers?: string[];
  rowCount?: number;
  sample?: Record<string, unknown>[];
  mapped?: unknown;
  note?: string;
  raw?: string;
  parseError?: string;
}

/** Ready-made target schemas — "put a link, pick a shape". Editable. */
const PRESETS: Record<string, string> = {
  "(kustom)": "",
  "Funnel": `[\n  { "stage": "string", "count": 0, "value": 0 }\n]`,
  "Proyek": `[\n  { "name": "string", "units": 0, "akad": 0, "value": 0, "status": "green|yellow|red" }\n]`,
  "KPI": `[\n  { "name": "string", "value": 0, "target": 0, "unit": "string" }\n]`,
  "Ringkasan (summary)": `{\n  "total": 0,\n  "byStatus": [ { "status": "string", "count": 0 } ]\n}`,
};

async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function AiImportApp() {
  const nav = useNavigate();
  const [key, setKey] = useState<string>(() => localStorage.getItem(KEY_LS) ?? "");
  const [link, setLink] = useState("");
  const [tab, setTab] = useState("");
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [sheetTitle, setSheetTitle] = useState("");
  const [preset, setPreset] = useState("(kustom)");
  const [schema, setSchema] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"" | "tabs" | "preview" | "map">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<MapResult | null>(null);

  const saveKey = (v: string) => {
    setKey(v);
    localStorage.setItem(KEY_LS, v);
  };
  const choosePreset = (name: string) => {
    setPreset(name);
    setSchema(PRESETS[name] ?? "");
  };

  const listTabs = useCallback(async () => {
    if (!link.trim()) return setError("Tempel link / ID spreadsheet dulu.");
    setBusy("tabs");
    setError("");
    try {
      const r = await fetch(`${SHEETS}/api/ai/tabs?link=${encodeURIComponent(link.trim())}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setTabs(j.tabs ?? []);
      setSheetTitle(j.spreadsheet ?? "");
      if (j.tabs?.[0]) setTab(j.tabs[0].title);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }, [link]);

  const run = useCallback(
    async (withAi: boolean) => {
      if (!link.trim() || !tab) return setError("Link + tab wajib diisi.");
      if (withAi && !key.trim()) return setError("Isi OpenRouter API key dulu.");
      setBusy(withAi ? "map" : "preview");
      setError("");
      setResult(null);
      try {
        const body: Record<string, unknown> = { link: link.trim(), tab };
        if (withAi) {
          body.openrouterKey = key.trim();
          body.schema = schema.trim();
          body.instruction = instruction.trim();
        }
        const j = (await postJSON(`${SHEETS}/api/ai/map`, body)) as MapResult;
        setResult(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy("");
      }
    },
    [link, tab, key, schema, instruction],
  );

  const mappedStr =
    result?.mapped != null ? JSON.stringify(result.mapped, null, 2) : result?.raw ?? "";
  const mappedCount = Array.isArray(result?.mapped) ? (result?.mapped as unknown[]).length : null;

  return (
    <div className="aii">
      <header className="aii-top">
        <button className="aii-back" onClick={() => nav(-1)}>← Kembali</button>
        <div className="aii-title">
          <h1>AI Import — Sheet ke Data</h1>
          <p>Tempel link spreadsheet → AI yang memetakan ke struktur data. Key & link semuanya dinamis.</p>
        </div>
      </header>

      <div className="aii-grid">
        {/* ---- INPUT ---- */}
        <section className="aii-card">
          <label className="aii-f">
            <span>🔑 OpenRouter API Key <small>(disimpan di browser ini)</small></span>
            <input type="password" placeholder="sk-or-v1-…" value={key} onChange={(e) => saveKey(e.target.value)} />
            <small className="hint">Belum punya? Buat gratis di <b>openrouter.ai → Keys</b>. Model default gratis: <code>openai/gpt-oss-120b:free</code>.</small>
          </label>

          <label className="aii-f">
            <span>🔗 Link / ID Spreadsheet</span>
            <div className="aii-row">
              <input placeholder="https://docs.google.com/spreadsheets/d/…/edit" value={link} onChange={(e) => setLink(e.target.value)} />
              <button className="aii-btn ghost" disabled={busy !== ""} onClick={listTabs}>{busy === "tabs" ? "…" : "Lihat Tabs"}</button>
            </div>
            {sheetTitle && <small className="hint">📄 {sheetTitle}</small>}
          </label>

          {tabs.length > 0 && (
            <label className="aii-f">
              <span>📑 Tab</span>
              <select value={tab} onChange={(e) => setTab(e.target.value)}>
                {tabs.map((t) => (
                  <option key={t.title} value={t.title}>{t.title} ({t.rows} baris)</option>
                ))}
              </select>
            </label>
          )}

          <label className="aii-f">
            <span>🎯 Struktur target</span>
            <div className="aii-row">
              <select value={preset} onChange={(e) => choosePreset(e.target.value)}>
                {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <textarea className="aii-code" rows={6} placeholder='Contoh: [{ "stage": "string", "count": 0 }]  — atau kosongkan & jelaskan di bawah.' value={schema} onChange={(e) => setSchema(e.target.value)} />
          </label>

          <label className="aii-f">
            <span>💬 Instruksi (opsional)</span>
            <textarea rows={2} placeholder='mis. "Buat funnel tahap Booking→DP→Berkas→Akad dengan jumlah per tahap."' value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          </label>

          <div className="aii-actions">
            <button className="aii-btn ghost" disabled={busy !== "" || !tab} onClick={() => run(false)}>{busy === "preview" ? "Memuat…" : "👁 Preview Sheet"}</button>
            <button className="aii-btn" disabled={busy !== "" || !tab} onClick={() => run(true)}>{busy === "map" ? "AI memetakan…" : "✨ AI Map"}</button>
          </div>
          {error && <div className="aii-err">⚠ {error}</div>}
        </section>

        {/* ---- OUTPUT ---- */}
        <section className="aii-card">
          {!result && <div className="aii-empty">Hasil muncul di sini. Mulai dari <b>Lihat Tabs</b> → <b>Preview</b> → <b>AI Map</b>.</div>}
          {result && (
            <>
              {result.note && <div className="aii-note">ℹ {result.note}</div>}
              <div className="aii-meta">
                {result.headers && <span>{result.headers.length} kolom</span>}
                {result.rowCount != null && <span>{result.rowCount} baris sheet</span>}
                {result.model && <span>model: {result.model}</span>}
                {mappedCount != null && <span className="ok">✓ {mappedCount} record ter-mapping</span>}
              </div>

              {result.headers && (
                <div className="aii-sub">Kolom sheet:</div>
              )}
              {result.headers && (
                <div className="aii-chips">{result.headers.map((h, i) => <span key={i} className="chip">{h}</span>)}</div>
              )}

              {result.parseError && <div className="aii-err">AI balas, tapi JSON-nya gagal di-parse: {result.parseError}</div>}

              {mappedStr && (
                <>
                  <div className="aii-sub">{result.mapped != null ? "Hasil mapping (JSON):" : "Keluaran mentah AI:"}</div>
                  <pre className="aii-json">{mappedStr.slice(0, 20000)}</pre>
                </>
              )}

              {result.sample && !result.mapped && (
                <>
                  <div className="aii-sub">Contoh baris sheet:</div>
                  <pre className="aii-json">{JSON.stringify(result.sample.slice(0, 5), null, 2)}</pre>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
