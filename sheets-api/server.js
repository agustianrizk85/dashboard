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

app.listen(PORT, () => {
  console.log(`Greenpark Sheets API -> http://localhost:${PORT}`);
  console.log(`  spreadsheet: ${SPREADSHEET_ID}`);
});
