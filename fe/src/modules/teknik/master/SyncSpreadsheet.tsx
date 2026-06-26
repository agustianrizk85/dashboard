import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AutoSyncStatus, ImportPreview, ImportRecord, ImportSummary } from "../api/client";
import { Kpi } from "../components/ui";

/* ----------------------------------------------------------------------- *
 * Async spreadsheet sync — pull the construction monitoring Google Sheet,  *
 * preview the validated/mapped data, then approve (replace, with rollback).*
 * Mirrors the sales ingest flow.                                           *
 * ----------------------------------------------------------------------- */

const num = (n: number) => n.toLocaleString("id-ID");

type Tone = "ok" | "warn" | "bad" | undefined;

function SummaryCards({ s }: { s: ImportSummary }) {
  const cards: [string, string | number, Tone?][] = [
    ["Proyek", s.proyek],
    ["Unit", s.units],
    ["Kontraktor", s.kontraktor],
    ["SPK", s.spk],
    ["SOLD", s.sold],
    ["Ready Stock", s.readyStock],
    ["Available", s.available],
    ["Sudah BAST", s.sudahBast, "ok"],
    ["Belum BAST", s.belumBast],
    ["Terlambat", s.terlambat, s.terlambat > 0 ? "bad" : undefined],
    ["Avg Progres", `${s.avgProgres.toFixed(1)}%`],
    ["Catatan", s.issues, s.issues > 0 ? "warn" : undefined],
  ];
  return (
    <div className="kpi-row" style={{ flexWrap: "wrap" }}>
      {cards.map(([label, value, tone]) => (
        <Kpi key={label} label={label} value={value} tone={tone} />
      ))}
    </div>
  );
}

const URL_KEY = "gp_teknik_sheet_url";
const DEFAULT_URL =
  "https://docs.google.com/spreadsheets/d/1boqtWfBDiy9jcuvT1TzcZgWXRsc0JzYDj-nyu73LCT4/edit";

const INTERVALS: { sec: number; label: string }[] = [
  { sec: 30, label: "30 detik" },
  { sec: 60, label: "1 menit" },
  { sec: 300, label: "5 menit" },
  { sec: 900, label: "15 menit" },
  { sec: 1800, label: "30 menit" },
  { sec: 3600, label: "60 menit" },
];
const fmtInterval = (sec: number) => (sec < 60 ? `${sec} detik` : `${Math.round(sec / 60)} menit`);

/**
 * Auto-sync control — toggle on/off + pick the interval (30 detik … 60 menit).
 * When on, the backend pulls the sheet on that schedule and pushes to dashboards
 * over WebSocket, so they update live without any manual action or refresh.
 */
function AutoSyncControl() {
  const [st, setSt] = useState<AutoSyncStatus | null>(null);
  const [interval, setIntervalSec] = useState(300);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .autoStatus()
      .then((s) => {
        setSt(s);
        if (s.intervalSec) setIntervalSec(s.intervalSec);
      })
      .catch(() => {});

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, []);

  const apply = async (enabled: boolean, sec: number) => {
    setBusy(true);
    try {
      setSt(await api.autoSet(enabled, sec));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const on = st?.enabled ?? false;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        margin: "4px 0 10px", padding: "10px 12px", borderRadius: 8,
        border: "1px solid var(--line, #d0d7de)", background: on ? "rgba(34,160,90,0.06)" : "transparent",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 240, flex: 1 }}>
        <strong style={{ fontSize: 13 }}>🔄 Auto-sync Google Sheets</strong>
        <span className="md-count" style={{ fontSize: 11.5 }}>
          {!st?.configured
            ? "Belum dikonfigurasi (server butuh kredensial)."
            : on
              ? `Aktif — tarik & update otomatis tiap ${fmtInterval(st?.intervalSec ?? 0)} (dashboard ikut berubah tanpa refresh).`
              : "Nonaktif — dashboard hanya update saat tarik manual."}
          {st?.lastSync && ` · Terakhir: ${new Date(st.lastSync).toLocaleString("id-ID")}`}
          {st?.lastError && <span style={{ color: "var(--bad)" }}> · Error: {st.lastError}</span>}
        </span>
      </div>
      <label className="md-count" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        tiap
        <select
          value={interval}
          disabled={busy || !st?.configured}
          onChange={(e) => {
            const s = Number(e.target.value);
            setIntervalSec(s);
            if (on) void apply(true, s);
          }}
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line, #d0d7de)", fontSize: 13 }}
        >
          {INTERVALS.map((iv) => (
            <option key={iv.sec} value={iv.sec}>{iv.label}</option>
          ))}
        </select>
      </label>
      <button
        className={"md-btn" + (on ? " primary" : "")}
        disabled={busy || !st?.configured}
        onClick={() => void apply(!on, interval)}
        role="switch"
        aria-checked={on}
      >
        {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export function SyncSpreadsheet() {
  const [url, setUrl] = useState<string>(() => localStorage.getItem(URL_KEY) ?? DEFAULT_URL);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [busy, setBusy] = useState<"preview" | "approve" | "reset" | string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadHistory = () => api.importHistory().then(setHistory).catch(() => setHistory([]));
  useEffect(() => void loadHistory(), []);

  const fail = (e: unknown) => {
    setErr(e instanceof Error ? e.message : String(e));
  };

  const rememberUrl = () => localStorage.setItem(URL_KEY, url.trim());

  const doPreview = async () => {
    if (!url.trim()) {
      setErr("Tempel URL Google Sheets dulu.");
      return;
    }
    setBusy("preview");
    setErr("");
    setMsg("");
    rememberUrl();
    try {
      setPreview(await api.importSyncPreview(url.trim()));
    } catch (e) {
      setPreview(null);
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const doApprove = async () => {
    if (!window.confirm("Terapkan data spreadsheet? Ini MENGGANTI seluruh data unit/SPK/kontraktor/progres saat ini (bisa di-rollback).")) return;
    setBusy("approve");
    setErr("");
    rememberUrl();
    try {
      const rec = await api.importSyncApprove(url.trim());
      setMsg(`✓ Diterapkan: ${num(rec.summary.units)} unit, ${num(rec.summary.spk)} SPK — ${rec.updated}.`);
      setPreview(null);
      await loadHistory();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const doRollback = async (id: string) => {
    if (!window.confirm("Rollback ke kondisi sebelum import ini? Import yang lebih baru juga ikut dibatalkan.")) return;
    setBusy(id);
    setErr("");
    try {
      await api.importRollback(id);
      setMsg("✓ Rollback berhasil.");
      await loadHistory();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const doReset = async () => {
    if (!window.confirm("Kosongkan seluruh data unit/SPK/progres hasil import? (bisa di-rollback dari riwayat)")) return;
    setBusy("reset");
    setErr("");
    try {
      await api.importReset();
      setMsg("✓ Data dikosongkan.");
      setPreview(null);
      await loadHistory();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="md-panel">
      <header className="md-head">
        <div>
          <h2>Sync Spreadsheet</h2>
          <span className="md-count">
            Tempel URL Google Sheets, tarik datanya, lalu terapkan (mengganti seluruh data — bisa di-rollback).
          </span>
        </div>
        <button className="md-btn" onClick={() => void doReset()} disabled={!!busy} title="Kosongkan data import">
          {busy === "reset" ? "…" : "Kosongkan"}
        </button>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "stretch", margin: "10px 0 4px", flexWrap: "wrap" }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          spellCheck={false}
          style={{
            flex: "1 1 420px", minWidth: 280, padding: "9px 12px", fontSize: 13,
            border: "1px solid var(--line, #d0d7de)", borderRadius: 8, fontFamily: "var(--font-mono, monospace)",
          }}
        />
        <button className="md-btn primary" onClick={() => void doPreview()} disabled={!!busy || !url.trim()}>
          {busy === "preview" ? "Menarik…" : "⭯ Tarik & Preview"}
        </button>
      </div>
      <div className="md-count" style={{ fontSize: 11.5, marginBottom: 6 }}>
        Spreadsheet harus dapat diakses oleh server (service account / link Pelihat).
      </div>

      <AutoSyncControl />

      {err && <div className="md-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}
      {msg && <div style={{ color: "var(--ok)", fontSize: 13, margin: "8px 0" }}>{msg}</div>}

      {preview && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong>Preview (belum diterapkan)</strong>
            <span className="md-count">{preview.units.length} unit terbaca · sumber: {preview.source || "Google Sheets"}</span>
            <span style={{ flex: 1 }} />
            <button className="md-btn primary" onClick={() => void doApprove()} disabled={!!busy}>
              {busy === "approve" ? "Menerapkan…" : "✓ Terapkan (replace)"}
            </button>
          </div>

          <SummaryCards s={preview.summary} />

          {preview.issues.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", color: "var(--warn)", fontWeight: 600 }}>
                {preview.issues.length} catatan validasi
              </summary>
              <div className="tbl-scroll" style={{ marginTop: 8, maxHeight: 220 }}>
                <table className="tbl">
                  <thead><tr><th>Baris</th><th>Proyek</th><th>Blok</th><th>Catatan</th></tr></thead>
                  <tbody>
                    {preview.issues.slice(0, 200).map((it, i) => (
                      <tr key={i}><td>{it.row}</td><td>{it.proyek}</td><td>{it.blok}</td><td>{it.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <div className="tbl-scroll" style={{ maxHeight: 420 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Proyek</th><th>Blok</th><th>Type</th><th>Status</th><th>Kontraktor</th>
                  <th>Nomor SPK</th><th className="num">Progres</th><th className="num">Target</th><th>BAST</th><th>Jadwal</th>
                </tr>
              </thead>
              <tbody>
                {preview.units.slice(0, 500).map((u, i) => (
                  <tr key={i}>
                    <td><b>{u.proyek}</b></td>
                    <td>{u.blok}</td>
                    <td>{u.type || "—"}</td>
                    <td>{u.status}</td>
                    <td>{u.kontraktor || "—"}</td>
                    <td>{u.nomorSpk || "—"}</td>
                    <td className="num">{u.progres.toFixed(1)}%</td>
                    <td className="num">{u.target.toFixed(1)}%</td>
                    <td>{u.statusBast || "—"}</td>
                    <td style={{ color: u.terlambat ? "var(--bad)" : "var(--ok)" }}>{u.terlambat ? "Terlambat" : "On track"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.units.length > 500 && (
              <div className="md-count" style={{ padding: 8 }}>Menampilkan 500 dari {preview.units.length} unit (semua akan diterapkan).</div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Riwayat Import</h3>
        {history.length === 0 ? (
          <div className="md-count">Belum ada import.</div>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Waktu</th><th>Sumber</th><th>Oleh</th><th className="num">Unit</th><th className="num">SPK</th><th></th></tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td>{r.updated}</td>
                    <td>{r.source}</td>
                    <td>{r.by}</td>
                    <td className="num">{num(r.summary.units)}</td>
                    <td className="num">{num(r.summary.spk)}</td>
                    <td>
                      <button className="md-btn" onClick={() => void doRollback(r.id)} disabled={!!busy}>
                        {busy === r.id ? "…" : "Rollback"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
