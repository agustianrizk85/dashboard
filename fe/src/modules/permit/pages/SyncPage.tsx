import { useEffect, useState } from "react";
import {
  importService,
  type AutoStatus,
  type ImportSummary,
} from "@/modules/permit/services/import.service";

const INTERVALS = [
  { sec: 30, label: "30 detik" },
  { sec: 60, label: "1 menit" },
  { sec: 300, label: "5 menit" },
  { sec: 900, label: "15 menit" },
  { sec: 1800, label: "30 menit" },
  { sec: 3600, label: "1 jam" },
];

export function SyncPage() {
  const [auto, setAuto] = useState<AutoStatus | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "approve">("");
  const [error, setError] = useState("");

  const loadAuto = () => importService.autoStatus().then(setAuto).catch(() => {});
  useEffect(() => {
    loadAuto();
    const i = setInterval(loadAuto, 30000); // keep last-sync fresh
    return () => clearInterval(i);
  }, []);

  const run = async (mode: "preview" | "approve") => {
    setBusy(mode);
    setError("");
    setResult(null);
    try {
      const r = mode === "preview" ? await importService.preview() : await importService.approve();
      setResult(r);
      loadAuto();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy("");
    }
  };

  const setAutoSync = async (enabled: boolean, intervalSec: number) => {
    try {
      setAuto(await importService.autoSet(enabled, intervalSec));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sync Spreadsheet</h1>
          <p className="muted">
            Tarik data Proyek &amp; Process Steps dari Google Sheets. Data yang sudah ada
            di-<strong>update</strong> (dokumen ter-upload tetap aman), data baru ditambahkan.
          </p>
        </div>
        <div className="sync-actions">
          <button className="btn" onClick={() => run("preview")} disabled={!!busy}>
            {busy === "preview" ? "Memeriksa…" : "Preview"}
          </button>
          <button className="btn btn-primary" onClick={() => run("approve")} disabled={!!busy}>
            {busy === "approve" ? "Menyinkron…" : "🔄 Sync Sekarang"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {auto && !auto.configured && (
        <div className="alert alert-error">
          Spreadsheet belum dikonfigurasi / belum di-share ke service account. Sync tidak bisa berjalan.
        </div>
      )}

      {result && (
        <div className="card">
          <h2>{result.applied ? "Hasil Sync" : "Pratinjau"}</h2>
          <div className="sync-stats">
            <Stat label="Proyek" total={result.projectsTotal} created={result.projectsCreated} updated={result.projectsUpdated} />
            <Stat label="Process Steps" total={result.stepsTotal} created={result.stepsCreated} updated={result.stepsUpdated} />
          </div>
          {result.issues?.length > 0 && (
            <div className="sync-issues">
              <strong>{result.issues.length} catatan:</strong>
              <ul>
                {result.issues.map((it, i) => (
                  <li key={i} className="muted small">{it}</li>
                ))}
              </ul>
            </div>
          )}
          {result.applied && (
            <p className="muted small" style={{ marginTop: ".6rem" }}>
              Dashboard ter-refresh otomatis lewat realtime.
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h2>Auto-Sync</h2>
        <p className="muted small">
          Tarik otomatis saat server start &amp; berkala. Dashboard yang terbuka langsung refresh tanpa reload.
        </p>
        <div className="autosync-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={!!auto?.enabled}
              disabled={!auto?.configured}
              onChange={(e) => setAutoSync(e.target.checked, auto?.intervalSec ?? 900)}
            />
            <span>{auto?.enabled ? "Aktif" : "Nonaktif"}</span>
          </label>
          <select
            value={auto?.intervalSec ?? 900}
            disabled={!auto?.enabled}
            onChange={(e) => setAutoSync(true, Number(e.target.value))}
          >
            {INTERVALS.map((iv) => (
              <option key={iv.sec} value={iv.sec}>
                Tiap {iv.label}
              </option>
            ))}
          </select>
        </div>
        {auto && (
          <p className="muted small" style={{ marginTop: ".6rem" }}>
            Sync terakhir: {auto.lastSync ? new Date(auto.lastSync).toLocaleString("id-ID") : "—"}
            {auto.lastError ? ` · ⚠ ${auto.lastError}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, total, created, updated }: { label: string; total: number; created: number; updated: number }) {
  return (
    <div className="sync-stat">
      <div className="sync-stat-num">{total}</div>
      <div className="sync-stat-label">{label}</div>
      <div className="muted small">
        +{created} baru · {updated} update
      </div>
    </div>
  );
}
