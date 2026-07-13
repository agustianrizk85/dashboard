import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AutoSyncStatus, ImportPreview, ImportRecord, ImportSummary } from "../types";
import { Kpi } from "../components/ui";

/* ----------------------------------------------------------------------- *
 * Async spreadsheet sync — pull the GREENPARK_CSO_MASTER_DATA Google Sheet,*
 * preview the validated summary, then approve (replace, with rollback).    *
 * ----------------------------------------------------------------------- */

const num = (n: number) => n.toLocaleString("id-ID");
type Tone = "ok" | "warn" | "bad" | undefined;

function SummaryCards({ s }: { s: ImportSummary }) {
  const cards: [string, string | number, Tone?][] = [
    ["Komplain Thn Ini", s.totalIni],
    ["Selesai", s.selesaiIni, "ok"],
    ["Belum Selesai", s.belumIni, s.belumIni > 3 ? "bad" : undefined],
    ["SLA Thn Ini", `${s.slaIni.toFixed(1)}%`, s.slaIni < 90 ? "warn" : "ok"],
    ["Komplain Thn Lalu", s.totalLalu],
    ["SLA Thn Lalu", `${s.slaLalu.toFixed(1)}%`],
    ["Kategori", s.kategori],
    ["Proyek", s.proyek],
    ["Vendor", s.vendor],
    ["Minggu Kurva", s.minggu],
  ];
  return (
    <div className="kpi-row" style={{ flexWrap: "wrap" }}>
      {cards.map(([label, value, tone]) => (
        <Kpi key={label} label={label} value={value} tone={tone} />
      ))}
    </div>
  );
}

const URL_KEY = "gp_cso_sheet_url";
const DEFAULT_URL =
  "https://docs.google.com/spreadsheets/d/1unSl-JqYmajsK-S0d6hwPN_g33B1b1sUoLv_U1RlxbE/edit";

const INTERVALS = [
  { sec: 60, label: "1 menit" },
  { sec: 300, label: "5 menit" },
  { sec: 900, label: "15 menit" },
  { sec: 1800, label: "30 menit" },
  { sec: 3600, label: "60 menit" },
];
const fmtInterval = (sec: number) => (sec < 60 ? `${sec} detik` : `${Math.round(sec / 60)} menit`);

function AutoSyncControl() {
  const [st, setSt] = useState<AutoSyncStatus | null>(null);
  const [interval, setIntervalSec] = useState(900);
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
    <div className={`autosync ${on ? "on" : ""}`}>
      <div className="as-info">
        <strong>🔄 Auto-sync Google Sheets</strong>
        <span className="md-count">
          {!st?.configured
            ? "Belum dikonfigurasi (server butuh kredensial / link publik)."
            : on
              ? `Aktif — tarik & update otomatis tiap ${fmtInterval(st?.intervalSec ?? 0)} (dashboard ikut berubah tanpa refresh).`
              : "Nonaktif — dashboard hanya update saat tarik manual."}
          {st?.lastSync && ` · Terakhir: ${new Date(st.lastSync).toLocaleString("id-ID")}`}
          {st?.lastError && <span style={{ color: "var(--bad,#c0392b)" }}> · Error: {st.lastError}</span>}
        </span>
      </div>
      <label className="md-count as-pick">
        tiap
        <select
          value={interval}
          disabled={busy || !st?.configured}
          onChange={(e) => {
            const s = Number(e.target.value);
            setIntervalSec(s);
            if (on) void apply(true, s);
          }}
        >
          {INTERVALS.map((iv) => (
            <option key={iv.sec} value={iv.sec}>{iv.label}</option>
          ))}
        </select>
      </label>
      <button className={"md-btn" + (on ? " primary" : "")} disabled={busy || !st?.configured} onClick={() => void apply(!on, interval)}>
        {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export function SyncSpreadsheet() {
  const [url, setUrl] = useState<string>(() => localStorage.getItem(URL_KEY) ?? DEFAULT_URL);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadHistory = () => api.importHistory().then(setHistory).catch(() => setHistory([]));
  useEffect(() => void loadHistory(), []);

  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : String(e));
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
    if (!window.confirm("Terapkan data spreadsheet? Ini MENGGANTI seluruh angka dashboard komplain saat ini (bisa di-rollback).")) return;
    setBusy("approve");
    setErr("");
    rememberUrl();
    try {
      const rec = await api.importSyncApprove(url.trim());
      setMsg(`✓ Diterapkan: ${num(rec.summary.totalIni)} komplain thn ini, SLA ${rec.summary.slaIni.toFixed(1)}% — ${rec.updated}.`);
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
    if (!window.confirm("Kosongkan seluruh angka dashboard komplain? (bisa di-rollback dari riwayat)")) return;
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
            Tempel URL Google Sheets komplain, tarik datanya, lalu terapkan (mengganti angka dashboard — bisa di-rollback).
          </span>
        </div>
        <button className="md-btn" onClick={() => void doReset()} disabled={!!busy}>
          {busy === "reset" ? "…" : "Kosongkan"}
        </button>
      </header>

      <div className="sync-input">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          spellCheck={false}
        />
        <button className="md-btn primary" onClick={() => void doPreview()} disabled={!!busy || !url.trim()}>
          {busy === "preview" ? "Menarik…" : "⭯ Tarik & Preview"}
        </button>
      </div>
      <div className="md-count" style={{ fontSize: 11.5, marginBottom: 6 }}>
        Spreadsheet harus dapat diakses server (service account / link "Siapa saja dengan link → Pelihat").
      </div>

      <AutoSyncControl />

      {err && <div className="md-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}
      {msg && <div className="okline">{msg}</div>}

      {preview && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="prev-head">
            <strong>Preview (belum diterapkan)</strong>
            <span className="md-count">sumber: {preview.source || "Google Sheets"}</span>
            <span style={{ flex: 1 }} />
            <button className="md-btn primary" onClick={() => void doApprove()} disabled={!!busy}>
              {busy === "approve" ? "Menerapkan…" : "✓ Terapkan (replace)"}
            </button>
          </div>

          <SummaryCards s={preview.summary} />

          {preview.issues && preview.issues.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", color: "var(--warn,#b7791f)", fontWeight: 600 }}>
                {preview.issues.length} catatan
              </summary>
              <ul className="issue-list">
                {preview.issues.map((it, i) => (
                  <li key={i}>{it.sheet ? `[${it.sheet}] ` : ""}{it.message}</li>
                ))}
              </ul>
            </details>
          )}
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
                <tr><th>Waktu</th><th>Sumber</th><th>Oleh</th><th className="num">Komplain</th><th className="num">SLA</th><th></th></tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{r.updated}</td>
                    <td>{r.source}</td>
                    <td>{r.by}</td>
                    <td className="num">{num(r.summary.totalIni)}</td>
                    <td className="num">{r.summary.slaIni.toFixed(1)}%</td>
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
