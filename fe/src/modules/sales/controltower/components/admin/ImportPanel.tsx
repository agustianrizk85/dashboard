import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { AutoSyncStatus, DroppedRow, ImportHeadline, ImportRecord, ImportResult } from "../../types";
import { num, rpShort } from "../../lib/format";

/**
 * Upload-driven import flow:
 *   Upload XLSX → Preview (validasi + cleaning + mapping) → Approve → Dashboard.
 * Approval is blocked while the validation report contains any error.
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
      setOk(`Dashboard diperbarui dari "${rec.filename}".`);
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
    if (
      !window.confirm(
        "Hapus SEMUA data dashboard (funnel, penjualan, project, sales, stock, dst.)?\n\nDashboard akan kembali kosong. Aksi ini bisa di-rollback dari Import History.",
      )
    )
      return;
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
  const errors = result?.issues.filter((i) => i.severity === "error").length ?? 0;
  const warnings = result?.issues.filter((i) => i.severity === "warning").length ?? 0;

  return (
    <div className="imp">
      <div className="adm-section-h">
        <div>
          <h2 className="imp-title">Upload Data Excel</h2>
          <p className="imp-sub">
            Alur: <b>Upload XLSX → Validasi → Cleaning → Mapping → Preview → Approve</b>. Angka utama
            dashboard otomatis dihitung dari workbook. Menu manual hanya untuk setting/target/override.
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
      <p className="imp-sub" style={{ marginTop: -6 }}>
        Atau klik <b>🔄 Sync Google Sheets</b> untuk tarik data langsung dari spreadsheet master (tanpa download/upload manual).
      </p>

      <AutoSyncControl onApplied={reload} />

      {error && <div className="adm-error">{error}</div>}
      {ok && <div className="adm-ok">{ok}</div>}

      {result && h && (
        <>
          <div className="imp-grid">
            <Panel title="Main Funnel — sumber: MASTER DATA_LEADS">
              <Metric label="Leads (bersih)" value={num(h.leads)} />
              <Metric label="Valid Leads" value={num(h.validLeads)} />
              <Metric label="Confirmed Visit" value={num(h.cv)} />
              <Metric label="Project Visitor" value={num(h.pv)} />
              <div className="imp-clean">
                Semua {num(h.leadsRaw)} baris dimasukkan (tanpa cleaning) · ditandai: wrong{" "}
                {num(h.droppedWrong)}, duplikat {num(h.droppedDup)}, luar periode {num(h.droppedPeriod)} — tetap dihitung
              </div>
            </Panel>
            <Panel title="Penjualan — sumber: DATA PENJUALAN">
              <Metric label="Purchaser (Sumber=LEADS, non-Batal)" value={num(h.purchaser)} />
              <Metric label="Booking (termasuk Batal)" value={num(h.booking)} />
              <Metric label="Akad" value={num(h.akad)} />
              <Metric label="Proses / KPR" value={num(h.proses)} />
              <Metric label="Batal" value={num(h.batal)} />
              <Metric label="Cash-In" value={rpShort(h.cashIn)} strong />
              <div className="imp-clean">
                Walk-in/Undangan: {num(h.visitorWalkIns)} (panel Event, di luar funnel)
              </div>
            </Panel>
          </div>

          <DroppedDetail rows={result.dropped} h={h} />

          <div className="imp-rows">
            {Object.entries(result.rowsRead).map(([sheet, n]) => (
              <span key={sheet} className="imp-chip">
                {sheet}: <b>{num(n)}</b> baris
              </span>
            ))}
          </div>

          <Validation issues={result.issues} errors={errors} warnings={warnings} />

          <div className="imp-actions">
            <button
              className="adm-btn primary"
              disabled={errors > 0 || busy !== ""}
              onClick={approve}
              title={errors > 0 ? "Perbaiki error validasi dulu" : ""}
            >
              {busy === "approve" ? "Mengupdate…" : "Approve & Update Dashboard"}
            </button>
            {errors > 0 && <span className="imp-block">Ada {errors} error — approve diblokir.</span>}
          </div>
        </>
      )}

      <History rows={history} onRollback={rollback} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
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

function Validation({
  issues,
  errors,
  warnings,
}: {
  issues: ImportResult["issues"];
  errors: number;
  warnings: number;
}) {
  const [open, setOpen] = useState(false);
  const shown = issues.filter((i) => i.severity !== "info");
  return (
    <div className="imp-valid">
      <button className="imp-valid-h" onClick={() => setOpen((o) => !o)}>
        <span>Validasi</span>
        <span className="imp-badges">
          <span className={"imp-badge" + (errors ? " err" : " zero")}>{errors} error</span>
          <span className={"imp-badge" + (warnings ? " warn" : " zero")}>{warnings} warning</span>
        </span>
        <span className="imp-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="imp-issues">
          {shown.length === 0 && <div className="imp-issue-empty">Tidak ada masalah. ✓</div>}
          {shown.slice(0, 200).map((i, idx) => (
            <div key={idx} className={"imp-issue " + i.severity}>
              <span className="imp-issue-tag">{i.check}</span>
              <span className="imp-issue-loc">
                {i.sheet}
                {i.row ? ` · baris ${i.row}` : ""}
              </span>
              <span className="imp-issue-msg">{i.message}</span>
            </div>
          ))}
          {shown.length > 200 && <div className="imp-issue-empty">… {shown.length - 200} lainnya</div>}
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
    const t = window.setInterval(load, 30000); // refresh status + last-sync time
    return () => window.clearInterval(t);
  }, []);

  async function set(enabled: boolean, sec: number) {
    setBusy(true);
    try {
      const s = await api.autoSet(enabled, sec);
      setSt(s);
      if (enabled) onApplied(); // first run fires shortly; refresh dashboard soon after
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
            ? "Belum dikonfigurasi (set kredensial Google dulu)."
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

const DROP_LABEL: Record<DroppedRow["reason"], string> = {
  wrong: "Wrong Number",
  duplikat: "Duplikat HP",
  periode: "Luar Periode",
};

function DroppedDetail({ rows, h }: { rows: DroppedRow[]; h: ImportHeadline }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | DroppedRow["reason"]>("all");
  const total = h.droppedWrong + h.droppedDup + h.droppedPeriod;
  if (total === 0) return null;

  const totals: Record<DroppedRow["reason"], number> = {
    wrong: h.droppedWrong,
    duplikat: h.droppedDup,
    periode: h.droppedPeriod,
  };
  const shown = filter === "all" ? rows : rows.filter((r) => r.reason === filter);
  const capped = filter !== "all" && shown.length < totals[filter];

  const tabs: ("all" | DroppedRow["reason"])[] = ["all", "wrong", "duplikat", "periode"];

  return (
    <div className="imp-valid">
      <button className="imp-valid-h" onClick={() => setOpen((o) => !o)}>
        <span>Detail Data Ditandai (tetap dihitung)</span>
        <span className="imp-badges">
          <span className="imp-badge warn">{num(total)} baris</span>
        </span>
        <span className="imp-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div>
          <div className="imp-drop-tabs">
            {tabs.map((t) => (
              <button
                key={t}
                className={"imp-dtab" + (filter === t ? " active" : "")}
                onClick={() => setFilter(t)}
              >
                {t === "all" ? "Semua" : DROP_LABEL[t]} ·{" "}
                {num(t === "all" ? total : totals[t])}
              </button>
            ))}
          </div>
          {capped && (
            <div className="imp-drop-note">
              Menampilkan {num(shown.length)} dari {num(totals[filter as DroppedRow["reason"]])} baris (sampel).
            </div>
          )}
          <div className="imp-drop-tablewrap">
            <table className="imp-drop-table">
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Nama</th>
                  <th>Project</th>
                  <th>Tanggal</th>
                  <th>No HP</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((r, i) => (
                  <tr key={i}>
                    <td className="num">{r.row}</td>
                    <td>{r.name || "—"}</td>
                    <td>{r.project || "—"}</td>
                    <td>{r.date || "—"}</td>
                    <td className="mono">{r.phone || "—"}</td>
                    <td>
                      <span className={"imp-dtag imp-dtag-" + r.reason}>{DROP_LABEL[r.reason]}</span>{" "}
                      <span className="muted">{r.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 500 && <div className="imp-drop-note">… {num(shown.length - 500)} baris lainnya disembunyikan.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function History({ rows, onRollback }: { rows: ImportRecord[]; onRollback: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="imp-history">
      <div className="imp-history-h">Import History</div>
      {rows.map((r) => (
        <div key={r.id} className={"imp-hrow" + (r.rolledBack ? " rolled" : "")}>
          <div className="imp-hmain">
            <span className="imp-hfile">{r.filename}</span>
            <span className="imp-hmeta">
              {new Date(r.time).toLocaleString("id-ID")} · {r.by}
              {r.rolledBack ? " · (rolled back)" : ""}
            </span>
          </div>
          <div className="imp-hsum">
            Akad {num(r.summary.akad)} · Booking {num(r.summary.booking)} · Batal {num(r.summary.batal)} ·{" "}
            {rpShort(r.summary.cashIn)}
          </div>
          {r.canRollback && (
            <button className="adm-btn ghost imp-roll" onClick={() => onRollback(r.id)}>
              Rollback
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
