// Greenpark — read-only Google Sheets bridge.
//
// Uses the service-account JSON to read the configured spreadsheet and exposes
// a tiny JSON API the dashboard (or a Go backend) can consume.
//
// SECURITY MODEL
//   - Scope is *read-only*: the service account can never modify the sheet.
//   - HIDDEN tabs are BLOCKED. The Google API can see hidden sheets, but this
//     bridge refuses to list or read them, so a tab the team hid (e.g. the
//     "REKAP AKAD" sheets) can never leak into the dashboard. Un-hide a tab in
//     Google Sheets if you intentionally want it exposed.
import express from "express";
import cors from "cors";
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 8091: 8090 is reserved for the Master Auth SSO service (see dev/run-all.ps1).
const PORT = process.env.PORT ?? 8091;
const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID ?? "10au7z7FR6SpWt1VJ5TTB7WJSbuIBauECCj9zf9xWlYw";
// Credential lives one level up (frontend/), already git-ignored.
const KEY_FILE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.resolve(__dirname, "../gen-lang-client-0184893739-5da33d38e992.json");

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const app = express();
app.use(cors()); // allow the Vite dev server (:5174) to call us

/* ── Tab metadata (cached 30s) ─────────────────────────────────────────────
 * Used both to list visible tabs and to enforce the hidden-tab block on reads.
 */
let _tabsCache = { at: 0, data: null };
async function getTabsMeta() {
  const now = Date.now();
  if (_tabsCache.data && now - _tabsCache.at < 30_000) return _tabsCache.data;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields:
      "properties.title,sheets.properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount))",
  });
  const data = {
    title: meta.data.properties?.title ?? null,
    tabs: (meta.data.sheets ?? []).map((s) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
      index: s.properties.index,
      hidden: !!s.properties.hidden,
      rows: s.properties.gridProperties?.rowCount ?? 0,
      cols: s.properties.gridProperties?.columnCount ?? 0,
    })),
  };
  _tabsCache = { at: now, data };
  return data;
}

/** Pull the bare sheet title out of an A1 range: 'My Tab'!A1:F → My Tab. */
function sheetNameFromRange(a1) {
  const bang = a1.indexOf("!");
  let name = (bang >= 0 ? a1.slice(0, bang) : a1).trim();
  if (name.startsWith("'") && name.endsWith("'")) {
    name = name.slice(1, -1).replace(/''/g, "'");
  }
  return name;
}

/** Liveness + which spreadsheet/credential we're bound to. */
app.get("/api/sheets/health", (_req, res) => {
  res.json({ ok: true, spreadsheetId: SPREADSHEET_ID, keyFile: path.basename(KEY_FILE) });
});

/**
 * List the VISIBLE tabs only. Hidden tabs are withheld (see security model);
 * `hiddenCount` is reported so the omission is transparent, not silent.
 */
app.get("/api/sheets/tabs", async (_req, res) => {
  try {
    const meta = await getTabsMeta();
    const visible = meta.tabs.filter((t) => !t.hidden);
    const hidden = meta.tabs.filter((t) => t.hidden);
    res.json({ spreadsheet: meta.title, tabs: visible, hiddenCount: hidden.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Read a VISIBLE tab's values as JSON objects (first row = headers).
 *   GET /api/sheets/data?tab=Sheet1
 *   GET /api/sheets/data?range=Sheet1!A1:F   (explicit range)
 * Reading a hidden / unknown tab is refused (403 / 404).
 */
app.get("/api/sheets/data", async (req, res) => {
  const tab = req.query.tab;
  const range = req.query.range;
  if (!tab && !range) {
    return res.status(400).json({ error: "Specify ?tab=Name or ?range=Tab!A1:F" });
  }
  // Explicit range wins; otherwise quote the tab name so spaces/()/'
  // don't break the A1 notation (e.g. 'REKAP BOOKING 2026 (GP 1234)').
  const a1 = range ? String(range) : `'${String(tab).replace(/'/g, "''")}'`;
  try {
    const meta = await getTabsMeta();
    const targetName = sheetNameFromRange(a1);
    const target = meta.tabs.find((t) => t.title === targetName);
    if (!target) {
      return res.status(404).json({ error: `Tab "${targetName}" tidak ditemukan.` });
    }
    if (target.hidden) {
      return res
        .status(403)
        .json({ error: `Tab "${targetName}" di-hide dan diblokir untuk dashboard.` });
    }
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: a1,
    });
    const values = resp.data.values ?? [];
    const [headers = [], ...body] = values;
    const rows = body
      // skip fully-empty trailing rows
      .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h || `col${i}`, r[i] ?? ""])));
    res.json({ tab: targetName, range: a1, count: rows.length, headers, rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── AI MAPPING ────────────────────────────────────────────────────────────
 * Generic, dynamic sheet → schema mapper. Everything is passed at REQUEST time
 * (no env, no hardcode): the spreadsheet link/ID, the tab, the TARGET SCHEMA,
 * and the OpenRouter API key. An LLM transforms the raw sheet rows into JSON
 * matching the schema. Without a key it returns the raw sheet structure so the
 * caller can preview what the model would receive.
 *
 *   POST /api/ai/map
 *   { link|spreadsheetId, tab|range, schema, instruction?, openrouterKey, model? }
 */
app.use(express.json({ limit: "4mb" }));

/* Central OpenRouter key — stored server-side (file, git-ignored) so an admin
 * sets it ONCE and every user's AI-map runs without pasting their own key. */
const AI_KEY_FILE = path.resolve(__dirname, ".ai-key");
function loadAiKey() {
  try {
    return fs.readFileSync(AI_KEY_FILE, "utf8").trim();
  } catch {
    return "";
  }
}
let _aiKey = loadAiKey();
const maskKey = (k) => (k ? k.slice(0, 9) + "…" + k.slice(-4) : "");

app.get("/api/ai/key", (_req, res) => res.json({ configured: !!_aiKey, masked: maskKey(_aiKey) }));
app.put("/api/ai/key", (req, res) => {
  const k = String(req.body?.key ?? "").trim();
  try {
    if (k) fs.writeFileSync(AI_KEY_FILE, k, { mode: 0o600 });
    else fs.rmSync(AI_KEY_FILE, { force: true });
    _aiKey = k;
    res.json({ configured: !!_aiKey, masked: maskKey(_aiKey) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Extract the spreadsheet ID from a full Google Sheets URL, or pass through an ID. */
function parseSheetId(s) {
  if (!s) return null;
  const m = String(s).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : String(s).trim();
}

/** Read a tab of ANY spreadsheet the service account can access (first row = headers). */
async function fetchSheetRows(spreadsheetId, tab, range) {
  const a1 = range ? String(range) : `'${String(tab).replace(/'/g, "''")}'`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: a1 });
  const values = resp.data.values ?? [];
  const [headers = [], ...body] = values;
  const rows = body
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h || `col${i}`, r[i] ?? ""])));
  return { headers, rows };
}

/** Pull the first valid JSON value out of a model reply (tolerating prose/fences). */
function extractJson(text) {
  let s = String(text ?? "").trim();
  const a = s.indexOf("{");
  const b = s.indexOf("[");
  const start = a < 0 ? b : b < 0 ? a : Math.min(a, b);
  if (start < 0) return { value: null, error: "tidak ada JSON di keluaran model" };
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  s = s.slice(start, end + 1);
  try {
    return { value: JSON.parse(s), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
}

/** List VISIBLE tabs of ANY spreadsheet (dynamic link) — for the AI-map UI picker. */
app.get("/api/ai/tabs", async (req, res) => {
  try {
    const sid = parseSheetId(req.query.link || req.query.spreadsheetId);
    if (!sid) return res.status(400).json({ error: "link/spreadsheetId kosong." });
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sid,
      fields: "properties.title,sheets.properties(title,hidden,gridProperties(rowCount,columnCount))",
    });
    const tabs = (meta.data.sheets ?? [])
      .filter((s) => !s.properties.hidden)
      .map((s) => ({
        title: s.properties.title,
        rows: s.properties.gridProperties?.rowCount ?? 0,
        cols: s.properties.gridProperties?.columnCount ?? 0,
      }));
    res.json({ spreadsheet: meta.data.properties?.title ?? null, spreadsheetId: sid, tabs });
  } catch (e) {
    res.status(500).json({ error: e?.errors?.[0]?.message || e?.message || String(e) });
  }
});

app.post("/api/ai/map", async (req, res) => {
  try {
    const { link, spreadsheetId, tab, range, schema, instruction, openrouterKey, model } = req.body ?? {};
    const sid = parseSheetId(spreadsheetId || link);
    if (!sid) return res.status(400).json({ error: "Sheet link/ID kosong (kirim 'link' atau 'spreadsheetId')." });
    if (!tab && !range) return res.status(400).json({ error: "Sebutkan 'tab' atau 'range'." });

    const { headers, rows } = await fetchSheetRows(sid, tab, range);
    if (rows.length === 0) return res.status(404).json({ error: "Sheet kosong / tidak terbaca." });
    const sample = rows.slice(0, 30); // cap tokens — model only needs the pattern

    const key = String(openrouterKey || _aiKey || process.env.OPENROUTER_API_KEY || "").trim();
    if (!key) {
      // No key yet → return the input so the UI can preview structure & pick a tab.
      return res.json({
        spreadsheetId: sid, tab: tab || null, headers, rowCount: rows.length, sample,
        mapped: null, note: "Belum ada OpenRouter key — kirim 'openrouterKey' untuk menjalankan AI-mapping.",
      });
    }
    if (!schema) return res.status(400).json({ error: "Sebutkan 'schema' (struktur/JSON target yang diinginkan)." });

    const usedModel = model || "openai/gpt-oss-120b:free";
    const sys =
      "Kamu adalah data-mapping engine. Diberi data mentah Google Sheet (headers + baris) dan SKEMA TARGET. " +
      "Petakan & transformasikan data sheet menjadi JSON yang PERSIS mengikuti skema target. " +
      "Balas HANYA JSON valid (tanpa markdown/teks/penjelasan). Pakai nilai dari sheet — JANGAN mengarang angka. " +
      "Bersihkan format angka (hapus 'Rp', titik ribuan, '%') jadi number. Field yang tak ada di sheet isi 0 atau \"\".";
    const user =
      "SKEMA TARGET:\n" + (typeof schema === "string" ? schema : JSON.stringify(schema, null, 2)) +
      (instruction ? "\n\nINSTRUKSI TAMBAHAN:\n" + instruction : "") +
      "\n\nHEADERS:\n" + JSON.stringify(headers) +
      `\n\nDATA (${rows.length} baris; contoh ${sample.length}):\n` + JSON.stringify(sample) +
      "\n\nKeluarkan JSON hasil mapping sekarang.";

    const orResp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Title": "Greenpark AI Map" },
      body: JSON.stringify({
        model: usedModel,
        temperature: 0.1,
        max_tokens: 6000,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    const orJson = await orResp.json().catch(() => ({}));
    if (!orResp.ok) {
      return res.status(502).json({ error: "OpenRouter " + orResp.status + ": " + (orJson?.error?.message || "gagal") });
    }
    const content = orJson?.choices?.[0]?.message?.content ?? "";
    const { value: mapped, error: parseError } = extractJson(content);
    res.json({
      spreadsheetId: sid, tab: tab || null, model: usedModel,
      headers, rowCount: rows.length, mapped,
      ...(mapped ? {} : { raw: content, parseError }),
    });
  } catch (e) {
    const msg = e?.errors?.[0]?.message || e?.message || String(e);
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Greenpark Sheets API -> http://localhost:${PORT}`);
  console.log(`  spreadsheet: ${SPREADSHEET_ID}`);
  console.log(`  AI map: POST /api/ai/map (dynamic link + key + schema)`);
});
