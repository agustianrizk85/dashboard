import { useEffect, useState } from "react";
import { alurLabels } from "../../lib/alurCatalog";
import {
  contentPlanService,
  type ContentPlanPreview,
  type ContentPlanApproveResult,
  type AutoSyncStatus,
} from "../../services/contentplan.service";

/**
 * SyncContentPlan drives the Content Plan → work-item sync, sales-style:
 *   • one-click "🔄 Sync Sekarang" (fetch + apply, idempotent),
 *   • optional "Pratinjau" dry-run,
 *   • Auto-sync toggle + interval — the backend then pulls on a schedule and
 *     pushes a realtime bump so every open dashboard updates without refresh.
 */
export function SyncContentPlan({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "preview" | "sync">("");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<ContentPlanPreview | null>(null);
  const [result, setResult] = useState<ContentPlanApproveResult | null>(null);

  const doPreview = async () => {
    setBusy("preview");
    setErr("");
    setResult(null);
    try {
      setPreview(await contentPlanService.preview(url));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const doSync = async () => {
    setBusy("sync");
    setErr("");
    try {
      const r = await contentPlanService.approve(url);
      setResult(r);
      setPreview(null);
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const s = preview?.summary;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cp-sync" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <h2>Sinkron Content Plan</h2>
          <span className="mh-sp" />
          <button className="mclose" onClick={onClose} title="Tutup">✕</button>
        </div>

        <div className="modal-body cp-body">
          <p className="cp-hint">
            Tarik jadwal konten dari Google Sheet <b>Content Plan GP 2026</b> menjadi item kerja (Alur A–D).
            Kosongkan kolom URL untuk memakai sheet default. Aman diulang — item yang sudah ada dilewati.
          </p>

          <label className="form-field">
            <span>URL Google Sheets (opsional)</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="default: Content Plan GP 2026" />
          </label>

          <div className="cp-actions">
            <button className="btn-primary sm" onClick={doSync} disabled={busy !== ""}>
              {busy === "sync" ? "Menyinkron…" : "🔄 Sync Sekarang"}
            </button>
            <button className="btn-ghost sm" onClick={doPreview} disabled={busy !== ""}>
              {busy === "preview" ? "Memuat…" : "Pratinjau dulu"}
            </button>
          </div>

          {err && <div className="login-error">{err}</div>}

          {result && (
            <div className="cp-result ok">
              ✓ Selesai — <b>{result.created}</b> konten baru, <b>{result.updated}</b> diperbarui (caption/brief), {result.skipped} dilewati, dari {result.total}.
            </div>
          )}

          {s && (
            <div className="cp-summary">
              <div className="cp-stats">
                <Stat label="Total" value={s.total_items} />
                <Stat label="Baru" value={preview!.new_count} tone="ok" />
                <Stat label="Sudah ada" value={preview!.existing} tone="grey" />
                <Stat label="Ada caption" value={s.with_caption} />
                <Stat label="Tab dibaca" value={s.tabs_seen} />
              </div>

              <div className="cp-cols">
                <div>
                  <div className="cp-col-hd">Per Alur</div>
                  {(["A", "B", "C", "D"] as const).map((a) => (
                    <div className="cp-line" key={a}>
                      <span>{alurLabels[a]}</span>
                      <b>{s.by_alur[a] ?? 0}</b>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="cp-col-hd">Per Proyek</div>
                  {Object.entries(s.by_project)
                    .sort((x, y) => y[1] - x[1])
                    .map(([proj, n]) => (
                      <div className="cp-line" key={proj}>
                        <span>{proj}</span>
                        <b>{n}</b>
                      </div>
                    ))}
                </div>
              </div>

              {s.tabs_skipped.length > 0 && <div className="cp-skipped">Tab dilewati: {s.tabs_skipped.join(", ")}</div>}
            </div>
          )}

          <AutoSyncControl onApplied={onApplied} />
        </div>
      </div>
    </div>
  );
}

const INTERVALS: { sec: number; label: string }[] = [
  { sec: 60, label: "1 menit" },
  { sec: 300, label: "5 menit" },
  { sec: 900, label: "15 menit" },
  { sec: 1800, label: "30 menit" },
  { sec: 3600, label: "60 menit" },
];

const fmtInterval = (sec: number) => (sec < 60 ? `${sec} detik` : `${Math.round(sec / 60)} menit`);

/** AutoSyncControl mirrors the Sales auto-sync: a toggle + interval. When ON the
 *  backend pulls the sheet on a schedule and pushes a realtime update (socket),
 *  so the board refreshes itself without anyone clicking Sync. */
function AutoSyncControl({ onApplied }: { onApplied: () => void }) {
  const [st, setSt] = useState<AutoSyncStatus | null>(null);
  const [interval, setIntervalSec] = useState(900);
  const [busy, setBusy] = useState(false);

  const load = () =>
    contentPlanService
      .autoStatus()
      .then((s) => {
        setSt(s);
        if (s.intervalSec) setIntervalSec(s.intervalSec);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, []);

  const set = async (enabled: boolean, sec: number) => {
    setBusy(true);
    try {
      const s = await contentPlanService.autoSet(enabled, sec);
      setSt(s);
      if (enabled) onApplied();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const on = st?.enabled ?? false;
  return (
    <div className={"cp-auto" + (on ? " on" : "")}>
      <div className="cp-auto-l">
        <span className="cp-auto-title">🤖 Auto-sync Google Sheets</span>
        <span className="cp-auto-sub">
          {on
            ? `Aktif — otomatis tarik & update tiap ${fmtInterval(st?.intervalSec ?? 0)} (board berubah tanpa refresh).`
            : "Nonaktif — board hanya update saat klik Sync."}
          {st?.lastSync && ` · Terakhir: ${new Date(st.lastSync).toLocaleString("id-ID")}`}
          {st?.lastError && <span className="cp-auto-err"> · Error: {st.lastError}</span>}
        </span>
      </div>
      <div className="cp-auto-ctl">
        <label className="cp-auto-sel">
          tiap
          <select
            value={interval}
            disabled={busy}
            onChange={(e) => {
              const sec = Number(e.target.value);
              setIntervalSec(sec);
              if (on) set(true, sec);
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
          className={"cp-toggle" + (on ? " on" : "")}
          disabled={busy}
          onClick={() => set(!on, interval)}
          role="switch"
          aria-checked={on}
        >
          <span className="cp-toggle-dot" />
          <span className="cp-toggle-txt">{on ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "grey" }) {
  return (
    <div className={`cp-stat ${tone ?? ""}`}>
      <div className="cp-stat-num">{value}</div>
      <div className="cp-stat-lbl">{label}</div>
    </div>
  );
}
