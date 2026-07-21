import { useEffect, useState } from "react";
import type { PKSDoc, PKSPackage } from "@/modules/permit/models";
import { projectService } from "@/modules/permit/services/project.service";
import { stepService } from "@/modules/permit/services/step.service";
import { PERMIT_LEGACY_ENABLED } from "@/modules/permit/services/features";

/** Download URL for an acuan document — appends ?watermark=1 for confidential
 *  files, matching the behavior of the step document cards. */
function docHref(d: PKSDoc): string {
  const base = stepService.downloadUrl(d.id);
  return d.confidential ? `${base}?watermark=1` : base;
}

/**
 * "Master PKS Bank — Berkas Acuan (F)" panel. Shows the auto-aggregated F
 * package for a project: the acuan documents pulled from its own steps
 * A6/A7/B4/C10, a readiness badge, and the Google Drive folder link. Read-only,
 * gated behind PERMIT_LEGACY_ENABLED. Never crashes — a fetch error renders an
 * inline message instead.
 */
export function PksBankPanel({ projectId }: { projectId: number }) {
  const [pkg, setPkg] = useState<PKSPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!PERMIT_LEGACY_ENABLED) return;
    if (!Number.isFinite(projectId)) return;
    let alive = true;
    setLoading(true);
    setError("");
    projectService
      .pksPackage(projectId)
      .then((data) => {
        if (alive) setPkg(data);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message || "Gagal memuat paket PKS Bank.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!PERMIT_LEGACY_ENABLED) return null;

  const filled = pkg ? pkg.sources.filter((s) => s.documents.length > 0).length : 0;
  const total = pkg ? pkg.sources.length : 4;

  return (
    <div className="pks-panel card">
      <div className="pks-head">
        <div>
          <h3>🏦 Master PKS Bank — Berkas Acuan (F)</h3>
          <p className="muted small">
            Paket berkas acuan (F) yang dihimpun otomatis dari langkah A6/A7/B4/C10 proyek ini.
          </p>
        </div>
        {pkg && (
          <span className={`badge ${pkg.ready ? "pks-badge-ready" : "pks-badge-partial"}`}>
            {pkg.ready ? "Lengkap" : `Belum lengkap · ${filled}/${total} kelompok terisi`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="muted">Memuat paket PKS Bank…</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : !pkg ? (
        <div className="muted small">Paket PKS Bank tidak tersedia.</div>
      ) : (
        <>
          <div className="pks-groups">
            {pkg.sources.map((src) => (
              <section key={src.code} className="pks-group">
                <div className="pks-group-title">
                  <span>{src.label}</span>
                  <span className="pks-code">{src.code}</span>
                </div>
                {src.documents.length === 0 ? (
                  <div className="muted small pks-empty">
                    Belum ada dokumen — unggah di langkah {src.code}.
                  </div>
                ) : (
                  <div className="pks-rows">
                    {src.documents.map((d) => (
                      <div key={d.id} className="pks-row">
                        <div className="pks-row-main">
                          <span className="pks-row-name">
                            {d.doc_type} · {d.original_name}
                          </span>
                          {d.confidential && <span className="pks-conf">Confidential</span>}
                        </div>
                        <a
                          className="btn btn-sm btn-primary"
                          href={docHref(d)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lihat / Unduh
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className="pks-drive">
            <span className="pks-drive-label">Folder Google Drive:</span>{" "}
            {pkg.gdrive_folder_link ? (
              <a
                className="pks-drive-link"
                href={pkg.gdrive_folder_link}
                target="_blank"
                rel="noreferrer"
              >
                Buka folder
              </a>
            ) : (
              <span className="muted small">Belum diisi (langkah F1).</span>
            )}
          </div>

          <p className="muted small pks-foot">
            Siteplan juga tersedia dari Perencanaan (panel di atas). PT (E) dikelola di modul
            Master PT. Marketing (PL/Brosur) menyusul.
          </p>
        </>
      )}
    </div>
  );
}
