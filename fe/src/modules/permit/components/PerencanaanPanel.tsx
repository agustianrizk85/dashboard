import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/modules/permit/models";
import { projectService } from "@/modules/permit/services/project.service";
import {
  NoSsoTokenError,
  perencanaanService,
  type XdivDeliverable,
  type XdivProject,
} from "@/modules/permit/services/perencanaan.service";
import { SearchableSelect } from "@/modules/permit/components/SearchableSelect";

// Perencanaan task statuses → Indonesian labels + badge classes.
const statusMeta: Record<string, { label: string; cls: string }> = {
  todo: { label: "Belum", cls: "pr-st-todo" },
  progress: { label: "Proses", cls: "pr-st-progress" },
  review: { label: "Review", cls: "pr-st-review" },
  done: { label: "Selesai", cls: "pr-st-done" },
};

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta[status] ?? { label: status || "—", cls: "pr-st-todo" };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

/**
 * Linker + "Dari Perencanaan" panel. Lets Legal Permit tie a lahan to a
 * Perencanaan project and pull the Siteplan / IMB deliverables (Output=
 * legalpermit) routed to it — read-only, cross-module. Degrades to a hint when
 * the dashboard SSO token or perencanaan backend is unavailable (never crashes).
 */
export function PerencanaanPanel({
  project,
  onProjectChange,
}: {
  project: Project;
  onProjectChange: (p: Project) => void;
}) {
  const linkedId = project.perencanaan_project_id ?? "";
  const hasSso = perencanaanService.hasSsoToken();

  const [projects, setProjects] = useState<XdivProject[]>([]);
  const [hint, setHint] = useState("");
  const [linking, setLinking] = useState(false);

  const [deliverables, setDeliverables] = useState<XdivDeliverable[]>([]);
  const [delivLoading, setDelivLoading] = useState(false);
  const [delivError, setDelivError] = useState("");

  // Load the perencanaan project list for the linker dropdown.
  useEffect(() => {
    if (!hasSso) {
      setHint("Masuk lewat dashboard untuk menautkan & menarik data Perencanaan.");
      return;
    }
    let alive = true;
    perencanaanService
      .projects()
      .then((items) => {
        if (alive) setProjects(items);
      })
      .catch((e) => {
        if (!alive) return;
        setHint(
          e instanceof NoSsoTokenError ? e.message : "Tidak dapat memuat daftar proyek Perencanaan.",
        );
      });
    return () => {
      alive = false;
    };
  }, [hasSso]);

  // Load deliverables whenever the linked project changes.
  useEffect(() => {
    if (!linkedId || !hasSso) {
      setDeliverables([]);
      return;
    }
    let alive = true;
    setDelivLoading(true);
    setDelivError("");
    perencanaanService
      .deliverables(linkedId)
      .then((items) => {
        if (alive) setDeliverables(items);
      })
      .catch((e) => {
        if (alive) setDelivError((e as Error).message || "Gagal memuat data Perencanaan.");
      })
      .finally(() => {
        if (alive) setDelivLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [linkedId, hasSso]);

  const linkedProject = useMemo(
    () => projects.find((p) => p.id === linkedId) ?? null,
    [projects, linkedId],
  );

  const onPick = async (gpId: string) => {
    setLinking(true);
    setDelivError("");
    try {
      await projectService.setLink(project.id, gpId);
      // Refetch the full project (with steps) so the checklist is preserved —
      // the link response may not embed the process steps.
      const fresh = await projectService.get(project.id);
      onProjectChange(fresh);
    } catch (e) {
      setDelivError((e as Error).message || "Gagal menautkan proyek.");
    } finally {
      setLinking(false);
    }
  };

  // Group deliverables by category, preserving the order they arrive in (the
  // backend already returns them in template order) — no hardcoded category
  // priority, so ANY routed category renders generically.
  const grouped = useMemo(() => {
    const map = new Map<string, XdivDeliverable[]>();
    for (const d of deliverables) {
      const cat = d.category || "Lainnya";
      const list = map.get(cat) ?? [];
      list.push(d);
      map.set(cat, list);
    }
    return Array.from(map.entries());
  }, [deliverables]);

  return (
    <div className="pr-link card">
      <div className="pr-link-head">
        <div>
          <h3>🔗 Tautkan ke Proyek Perencanaan</h3>
          <p className="muted small">
            Tarik deliverable Perencanaan yang Output-nya dirutekan ke Legal Permit ke proyek ini.
          </p>
        </div>
        {linkedId && (
          <span className="badge pr-chip">
            {linkedProject ? `${linkedProject.gp} · ${linkedProject.name}` : linkedId}
          </span>
        )}
      </div>

      {!hasSso ? (
        <div className="alert pr-hint">
          {hint || "Masuk lewat dashboard untuk menautkan & menarik data Perencanaan."}
        </div>
      ) : (
        <div className="pr-picker">
          <div className="pr-select-wrap">
            <SearchableSelect<string>
              options={projects.map((p) => ({ value: p.id, label: `${p.gp} · ${p.name}` }))}
              value={linkedId}
              onChange={(v) => onPick(v)}
              placeholder="Cari & pilih proyek Perencanaan…"
              emptyText="Proyek tidak ditemukan"
            />
          </div>
          {linking && <span className="muted small">Menyimpan…</span>}
          {hint && projects.length === 0 && <span className="muted small">{hint}</span>}
        </div>
      )}

      {/* Panel "Dari Perencanaan" — shown once a project is linked. */}
      {linkedId && hasSso && (
        <div className="pr-deliverables">
          <div className="pr-cap muted small">
            Deliverable ini milik Departemen Perencanaan — ditarik otomatis mengikuti Output divisi ke
            Legal Permit.
          </div>

          {delivLoading ? (
            <div className="muted">Memuat data Perencanaan…</div>
          ) : delivError ? (
            <div className="alert alert-error">{delivError}</div>
          ) : deliverables.length === 0 ? (
            <div className="muted small">Belum ada deliverable yang dirutekan ke Legal Permit.</div>
          ) : (
            grouped.map(([cat, list]) => {
              return (
                <section key={cat} className="pr-group">
                  <div className="pr-group-title">
                    <span>📁 {cat}</span>
                    <span className="pr-group-count">{list.length}</span>
                  </div>
                  <div className="pr-rows">
                    {list.map((d) => (
                      <div key={d.taskId} className="pr-row">
                        <div className="pr-row-main">
                          <span className="pr-row-name">{d.deliverable}</span>
                          <div className="pr-row-meta">
                            <StatusBadge status={d.status} />
                            <span className="muted small">PIC: {d.pic || "—"}</span>
                          </div>
                        </div>
                        {d.hasDoc ? (
                          <a
                            className="btn btn-sm btn-primary"
                            href={perencanaanService.docUrl(d.projectId, d.taskId)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Lihat / Unduh
                          </a>
                        ) : (
                          <span className="muted small pr-nodoc">Belum ada dokumen</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
