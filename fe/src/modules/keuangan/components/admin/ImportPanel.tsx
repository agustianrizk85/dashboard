import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { AutoSyncStatus, ImportRecord, ImportResult } from "../../types";
import { rp } from "../../lib/status";

const num = (n: number) => n.toLocaleString("id-ID");

/**
 * Async ingest flow for the Finance dashboard:
 *   Upload XLSX / Sync Google Sheets → Validasi & Mapping → Preview → Approve.
 * Plus scheduled auto-sync, import history and rollback.
 */
export function ImportPanel({ reload }: { reload: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "approve" | "reset" | "sync">("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [source, setSource] = useState<"file" | "sync">("file");
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = () => api.importHistory().then(setHistory).catch(() => {});
  useEffect(() => {
    loadHistory();
  }, []);

  function pick(f: File | null) {
    setFile(f);
    setResult(null);
    setError("");
    setOk("");
  }

  async function preview() {
    if (!file) return;
    setBusy("preview");
    setError("");
    setOk("");
    setSource("file");
    try {
      setResult(await api.importPreview(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function syncPreview() {
    setBusy("sync");
    setError("");
    setOk("");
    setSource("sync");
    try {
      setResult(await api.syncPreview());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function approve() {
    setBusy("approve");
    setError("");
    try {
      const rec = source === "sync" ? await api.syncApprove() : file ? await api.importApprove(file) : null;
      if (!rec) return;
      setOk(`Dashboard keuangan diperbarui dari "${rec.filename}".`);
      setResult(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      reload();
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function rollback(id: string) {
    setError("");
    setOk("");
    try {
      await api.importRollback(id);
      setOk("Import berhasil di-rollback. Dashboard dikembalikan.");
      reload();
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function resetAll() {
    if (!window.confirm("Hapus SEMUA data dashboard keuangan? Dashboard akan kembali kosong. Aksi ini bisa di-rollback dari Import History.")) return;
    setError("");
    setOk("");
    setBusy("reset");
    try {
      await api.importReset();
      setOk("Semua data dashboard dihapus. Dashboard sekarang kosong.");
      setResult(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      reload();
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  const h = result?.headline;

  return (
    <div className="imp">
      <div className="adm-section-h">
        <div>
          <h2 className="imp-title">Sinkronisasi Data Keuangan</h2>
          <p className="imp-sub">
            Alur: <b>Sync Google Sheets / Upload XLSX → Validasi → Mapping → Preview → Approve</b>. Nilai akad,
            cash-in DP, pendanaan per bank, dan pipeline KPR dihitung otomatis dari workbook akad/KPR.
          </p>
        </div>
      </div>

      <div className="imp-drop">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <button className="adm-btn primary" disabled={!file || busy !== ""} onClick={preview}>
          {busy === "preview" ? "Memproses…" : "Preview"}
        </button>
        <button className="adm-btn ghost imp-sync" disabled={busy !== ""} onClick={syncPreview} title="Tarik langsung dari Google Sheets master">
          {busy === "sync" ? "Menarik dari Sheets…" : "🔄 Sync Google Sheets"}
        </button>
        <button className="adm-btn danger imp-reset" disabled={busy !== ""} onClick={resetAll}>
          {busy === "reset" ? "Menghapus…" : "🗑 Hapus Semua Data"}
        </button>
      </div>

      <AutoSyncControl onApplied={reload} />

      <ARSheetsControl onSynced={reload} />

      {error && <div className="adm-error">{error}</div>}
      {ok && <div className="adm-ok">{ok}</div>}

      {result && h && (
        <>
          <div className="imp-grid">
            <ImpCard title="Akad (tahun fokus)">
              <Metric label="Jumlah Akad" value={num(h.akadCount)} />
              <Metric label="Nilai Akad (Plafon)" value={rp(h.nilaiAkad)} strong />
              <Metric label="Cash-in DP" value={rp(h.cashIn)} strong />
              <Metric label="KPR Share" value={`${h.kprShare}%`} />
            </ImpCard>
            <ImpCard title="Pipeline & Pembatalan">
              <Metric label="Booking Aktif" value={num(h.bookingCount)} />
              <Metric label="Dalam Proses Bank" value={num(h.prosesCount)} />
              <Metric label="Batal" value={num(h.batalCount)} />
              <Metric label="Issue Data" value={num(h.issues)} />
            </ImpCard>
          </div>

          <div className="imp-rows">
            {(result.sheets ?? []).map((s) => (
              <span key={s.name} className={"imp-chip imp-chip-" + s.kind}>
                {s.name}: <b>{s.kind}</b>{s.rows ? ` · ${num(s.rows)} baris` : ""}
              </span>
            ))}
          </div>

          <Issues issues={result.issues ?? []} />

          <div className="imp-actions">
            <button className="adm-btn primary" disabled={busy !== ""} onClick={approve}>
              {busy === "approve" ? "Mengupdate…" : "Approve & Update Dashboard"}
            </button>
          </div>
        </>
      )}

      <History rows={history} onRollback={rollback} />
    </div>
  );
}

function ImpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="imp-panel">
      <div className="imp-panel-h">{title}</div>
      <div className="imp-panel-b">{children}</div>
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="imp-metric">
      <span className="imp-metric-l">{label}</span>
      <span className={"imp-metric-v" + (strong ? " strong" : "")}>{value}</span>
    </div>
  );
}

function Issues({ issues }: { issues: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="imp-valid">
      <button className="imp-valid-h" onClick={() => setOpen((o) => !o)}>
        <span>Catatan Data</span>
        <span className="imp-badges">
          <span className={"imp-badge" + (issues.length ? " warn" : " zero")}>{issues.length} catatan</span>
        </span>
        <span className="imp-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="imp-issues">
          {issues.length === 0 && <div className="imp-issue-empty">Tidak ada masalah. ✓</div>}
          {issues.slice(0, 200).map((m, idx) => (
            <div key={idx} className="imp-issue warning">
              <span className="imp-issue-msg">{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const INTERVALS: { sec: number; label: string }[] = [
  { sec: 30, label: "30 detik" },
  { sec: 60, label: "1 menit" },
  { sec: 120, label: "2 menit" },
  { sec: 300, label: "5 menit" },
  { sec: 900, label: "15 menit" },
  { sec: 1800, label: "30 menit" },
  { sec: 3600, label: "60 menit" },
];

const fmtInterval = (sec: number) => (sec < 60 ? `${sec} detik` : `${Math.round(sec / 60)} menit`);

function AutoSyncControl({ onApplied }: { onApplied: () => void }) {
  const [st, setSt] = useState<AutoSyncStatus | null>(null);
  const [interval, setInterval] = useState(60);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .autoStatus()
      .then((s) => {
        setSt(s);
        if (s.intervalSec) setInterval(s.intervalSec);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, []);

  async function set(enabled: boolean, sec: number) {
    setBusy(true);
    try {
      const s = await api.autoSet(enabled, sec);
      setSt(s);
      if (enabled) onApplied();
    } catch {
      /* ignored */
    } finally {
      setBusy(false);
    }
  }

  const on = st?.enabled ?? false;
  return (
    <div className={"imp-auto" + (on ? " on" : "")}>
      <div className="imp-auto-l">
        <span className="imp-auto-title">🤖 Auto-sync Google Sheets</span>
        <span className="imp-auto-sub">
          {!st?.configured
            ? "Belum dikonfigurasi (set FINANCE_GOOGLE_CREDENTIALS dulu)."
            : on
              ? `Aktif — otomatis tarik & update tiap ${fmtInterval(st?.intervalSec ?? 0)} (dashboard ikut berubah tanpa refresh).`
              : "Nonaktif — dashboard hanya update saat Anda klik Sync/Approve."}
          {st?.lastSync && ` · Terakhir: ${new Date(st.lastSync).toLocaleString("id-ID")}`}
          {st?.lastError && <span className="imp-auto-err"> · Error: {st.lastError}</span>}
        </span>
      </div>
      <div className="imp-auto-ctl">
        <label className="imp-auto-sel">
          tiap
          <select
            value={interval}
            disabled={busy || !st?.configured}
            onChange={(e) => {
              const s = Number(e.target.value);
              setInterval(s);
              if (on) set(true, s);
            }}
          >
            {INTERVALS.map((iv) => (
              <option key={iv.sec} value={iv.sec}>
                {iv.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={"imp-toggle" + (on ? " on" : "")}
          disabled={busy || !st?.configured}
          onClick={() => set(!on, interval)}
          role="switch"
          aria-checked={on}
        >
          <span className="imp-toggle-dot" />
          <span className="imp-toggle-txt">{on ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
}

type ARRow = { code: string; url: string };

/**
 * Manage the per-project AR (piutang) input spreadsheets from the UI: paste a
 * Google Sheets URL (or ID) per project code, save, and optionally sync the AR
 * dashboard immediately. Replaces the old env-only FINANCE_AR_GSHEETS config.
 */
function ARSheetsControl({ onSynced }: { onSynced: () => void }) {
  const [rows, setRows] = useState<ARRow[]>([]);
  const [busy, setBusy] = useState<"" | "save" | "sync">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .arSheets()
      .then((r) => setRows(r.sheets.length ? r.sheets.map((s) => ({ code: s.code, url: s.id })) : [{ code: "", url: "" }]))
      .catch(() => setRows([{ code: "", url: "" }]));
  }, []);

  const update = (i: number, k: keyof ARRow, v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => setRows((rs) => [...rs, { code: "", url: "" }]);
  const remove = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  async function save(sync: boolean) {
    setBusy(sync ? "sync" : "save");
    setMsg("");
    setErr("");
    try {
      const clean = rows.filter((r) => r.code.trim() && r.url.trim());
      const res = await api.arSetSheets(clean);
      setRows(res.sheets.length ? res.sheets.map((s) => ({ code: s.code, url: s.id })) : [{ code: "", url: "" }]);
      if (sync) {
        const ar = await api.arSyncApprove();
        setMsg(`Tersimpan & disinkronkan — ${clean.length} sheet. ${ar.updated ? "· " + ar.updated : ""}`);
        onSynced();
      } else {
        setMsg(`Daftar sheet AR tersimpan (${clean.length} proyek).`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="imp-auto" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <div className="imp-auto-l">
        <span className="imp-auto-title">📒 Spreadsheet AR / Piutang per Proyek</span>
        <span className="imp-auto-sub">
          Tempel URL Google Sheets (atau ID) tiap proyek + kode proyek. Share tiap sheet ke email service account agar
          bisa ditarik. Dipakai oleh tombol <b>Sync Sheet AR</b> di tab AR / Piutang.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="imp-ar-code"
              style={{ width: 90, padding: "6px 8px", border: "1px solid var(--line,#cdd7d0)", borderRadius: 6, font: "inherit" }}
              placeholder="KODE"
              value={r.code}
              onChange={(e) => update(i, "code", e.target.value)}
            />
            <input
              style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line,#cdd7d0)", borderRadius: 6, font: "inherit" }}
              placeholder="https://docs.google.com/spreadsheets/d/…  atau  ID spreadsheet"
              value={r.url}
              onChange={(e) => update(i, "url", e.target.value)}
            />
            <button className="adm-btn ghost" onClick={() => remove(i)} title="Hapus baris" disabled={rows.length <= 1}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="adm-btn ghost" onClick={add} disabled={busy !== ""}>
          + Tambah Proyek
        </button>
        <span style={{ flex: 1 }} />
        <button className="adm-btn" onClick={() => save(false)} disabled={busy !== ""}>
          {busy === "save" ? "Menyimpan…" : "Simpan"}
        </button>
        <button className="adm-btn primary" onClick={() => save(true)} disabled={busy !== ""}>
          {busy === "sync" ? "Menyinkronkan…" : "Simpan & Sync AR"}
        </button>
      </div>

      {msg && <div className="adm-ok" style={{ margin: 0 }}>{msg}</div>}
      {err && <div className="adm-error" style={{ margin: 0 }}>{err}</div>}
    </div>
  );
}

function History({ rows, onRollback }: { rows: ImportRecord[]; onRollback: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="imp-history">
      <div className="imp-history-h">Riwayat Import</div>
      {rows.map((r) => (
        <div key={r.id} className="imp-hrow">
          <div className="imp-hmain">
            <span className="imp-hfile">{r.filename}</span>
            <span className="imp-hmeta">
              {new Date(r.time).toLocaleString("id-ID")} · {r.by}
            </span>
          </div>
          <div className="imp-hsum">
            Akad {num(r.summary.akadCount)} · {rp(r.summary.nilaiAkad)} · DP {rp(r.summary.cashIn)} · Batal{" "}
            {num(r.summary.batalCount)}
          </div>
          <button className="adm-btn ghost imp-roll" onClick={() => onRollback(r.id)}>
            Rollback
          </button>
        </div>
      ))}
    </div>
  );
}
