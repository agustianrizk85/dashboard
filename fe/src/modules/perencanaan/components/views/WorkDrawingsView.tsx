import { useEffect, useMemo, useState } from "react";
import type { AlertItem, ProjectRollup, WorkDrawing } from "../../types";
import { api } from "../../api/client";
import type { CreateWorkDrawingInput, WorkDrawingAction } from "../../api/client";
import { fmtDate, fmtDaysLeft, picName, ragTone } from "../../lib/format";
import {
  getAttachments,
  setAttachments,
  type Attachment,
} from "../../lib/localStore";
import { RagDot } from "../ui";
import { Modal } from "../Modal";
import { PdfViewerModal } from "../PdfViewerModal";

const AUTHORS = ["agus", "rio", "randi", "ananto"];
const CUSTOM_PIC = "__custom__";

const STAGE_LABELS: Record<string, string> = {
  info: "Info masuk",
  konsumen: "Gambar konsumen",
  ttd: "Menunggu TTD",
  kontraktor: "Gambar kontraktor",
  done: "Selesai",
};

/** Ordered flow stages, used by the detail stepper. */
const STAGE_ORDER: WorkDrawing["status"][] = ["info", "konsumen", "ttd", "kontraktor", "done"];

/**
 * Gambar Kerja view — the per-consumer working-drawing flow with its two SLA
 * gates (konsumen 15 hari kerja sejak info masuk, kontraktor 5 hari kerja sejak
 * TTD konsumen), the live alert board, and the AI-assisted revision. Cards are
 * grouped per project so flows from different projects never mix.
 */
export function WorkDrawingsView({ projects }: { projects: ProjectRollup[] }) {
  const [drawings, setDrawings] = useState<WorkDrawing[] | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [revising, setRevising] = useState<WorkDrawing | null>(null);
  const [deepRevising, setDeepRevising] = useState<WorkDrawing | null>(null);
  const [detail, setDetail] = useState<WorkDrawing | null>(null);

  const load = () => {
    setErr("");
    Promise.all([api.workDrawings(), api.alerts()])
      .then(([d, a]) => {
        setDrawings(d);
        setAlerts(a);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };

  useEffect(load, []);

  // Group flows by project, preserving the portfolio order of `projects` and
  // appending any project not present in the rollup at the end.
  const groups = useMemo(() => {
    const byId = new Map<string, { name: string; items: WorkDrawing[] }>();
    (drawings ?? []).forEach((d) => {
      const g = byId.get(d.projectId) ?? { name: d.projectName, items: [] };
      g.items.push(d);
      byId.set(d.projectId, g);
    });
    const order = projects.map((p) => p.id);
    return Array.from(byId.entries()).sort(
      (a, b) => orderIndex(order, a[0]) - orderIndex(order, b[0]),
    );
  }, [drawings, projects]);

  const advance = async (id: string, action: WorkDrawingAction) => {
    try {
      await api.advanceWorkDrawing(id, action);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // Keep the open detail modal in sync after a reload.
  useEffect(() => {
    if (detail && drawings) {
      const fresh = drawings.find((d) => d.id === detail.id);
      if (fresh && fresh !== detail) setDetail(fresh);
    }
  }, [drawings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="view view-wd">
      <div className="wd-main">
        <div className="tasks-hd">
          <h2 className="panel-title">Flow Gambar Kerja Konsumen</h2>
          <button className="btn-primary sm" onClick={() => setCreating(true)}>
            + Info Konsumen
          </button>
        </div>

        {err && <div className="empty-note error">{err}</div>}
        {!drawings ? (
          <div className="empty-note">Memuat…</div>
        ) : drawings.length === 0 ? (
          <div className="empty-note">
            Belum ada flow. Tambahkan info konsumen untuk memulai SLA 15 hari kerja.
          </div>
        ) : (
          <div className="wd-groups">
            {groups.map(([projectId, g]) => (
              <section className="wd-group" key={projectId}>
                <div className="wd-group-hd">
                  <span className="wd-group-name">{g.name}</span>
                  <span className="wd-group-count">{g.items.length} unit</span>
                </div>
                <div className="wd-cards">
                  {g.items.map((d) => (
                    <WorkDrawingCard
                      key={d.id}
                      d={d}
                      onOpen={() => setDetail(d)}
                      onAdvance={advance}
                      onRevise={() => setRevising(d)}
                      onDeepRevise={() => setDeepRevising(d)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <aside className="wd-alerts">
        <h2 className="panel-title">Alert SLA</h2>
        {alerts.length === 0 ? (
          <div className="empty-note">Tidak ada alert aktif.</div>
        ) : (
          <div className="alert-list">
            {alerts.map((a) => (
              <div key={a.id + a.leg} className={`alert-item ${ragTone(a.sev)}`}>
                <div className="alert-top">
                  <RagDot rag={a.sev} />
                  <span className="alert-proj">{a.projectName}</span>
                  <span className="alert-days">{fmtDaysLeft(a.daysLeft)}</span>
                </div>
                <div className="alert-msg">{a.message}</div>
                <div className="alert-meta">
                  {a.konsumen} · {a.unit} · PIC {picName(a.pic)} · jatuh tempo {fmtDate(a.due)}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {creating && (
        <CreateFlowModal
          projects={projects}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {revising && (
        <ReviseModal
          drawing={revising}
          onClose={() => setRevising(null)}
          onDone={() => {
            setRevising(null);
            load();
          }}
        />
      )}
      {deepRevising && (
        <DeepReviseModal
          drawing={deepRevising}
          onClose={() => {
            setDeepRevising(null);
            load();
          }}
        />
      )}
      {detail && (
        <DetailModal
          drawing={detail}
          onClose={() => setDetail(null)}
          onAdvance={async (id, action) => {
            await advance(id, action);
          }}
        />
      )}
    </div>
  );
}

function orderIndex(order: string[], id: string): number {
  const i = order.indexOf(id);
  return i === -1 ? order.length : i;
}

function WorkDrawingCard({
  d,
  onOpen,
  onAdvance,
  onRevise,
  onDeepRevise,
}: {
  d: WorkDrawing;
  onOpen: () => void;
  onAdvance: (id: string, action: WorkDrawingAction) => void;
  onRevise: () => void;
  onDeepRevise: () => void;
}) {
  const attachCount = getAttachments(d.id).length;

  // The card body opens the detail; action buttons stop propagation so they
  // don't also trigger the detail modal.
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={`wd-card clickable ${ragTone(d.sev)}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="wd-card-hd">
        <span className="wd-konsumen">{d.konsumen}</span>
        <span className="wd-unit">{d.unit}</span>
        <span className={`pill ${ragTone(d.sev)}`}>{STAGE_LABELS[d.status]}</span>
      </div>
      <div className="wd-proj">{d.projectName}</div>

      {d.attachments && d.attachments.length > 0 && (
        <div className="wd-files">
          <span className="wd-files-label">📎 {d.attachments.length} file</span>
          {d.attachments.slice(0, 6).map((f, i) => (
            <a
              key={i}
              className="wd-file"
              href={f.url}
              target="_blank"
              rel="noreferrer"
              title={f.name}
              onClick={(e) => e.stopPropagation()}
            >
              {f.name || `file ${i + 1}`}
            </a>
          ))}
          {d.attachments.length > 6 && <span className="wd-file-more">+{d.attachments.length - 6} lagi</span>}
        </div>
      )}

      <div className="wd-timeline">
        <Leg
          label="Konsumen (15 hk)"
          due={d.konsumenDue}
          done={d.konsumenDone}
          daysLeft={d.activeLeg === "konsumen" ? d.konsumenDaysLeft : undefined}
        />
        <Leg
          label="Kontraktor (5 hk)"
          due={d.kontraktorDue}
          done={d.kontraktorDone}
          daysLeft={d.activeLeg === "kontraktor" ? d.kontraktorDaysLeft : undefined}
        />
      </div>

      <div className="wd-meta">
        Info masuk {fmtDate(d.infoMasuk)} · PIC {picName(d.pic)}
        {d.ttdKonsumen && ` · TTD ${fmtDate(d.ttdKonsumen)}`}
        {attachCount > 0 && ` · ${attachCount} lampiran`}
      </div>

      <div className="wd-actions">
        {d.status === "konsumen" && (
          <button className="btn-ghost sm" onClick={stop(() => onAdvance(d.id, "konsumen-selesai"))}>
            Gambar konsumen selesai
          </button>
        )}
        {(d.status === "konsumen" || d.status === "ttd") && (
          <button className="btn-primary sm" onClick={stop(() => onAdvance(d.id, "ttd-konsumen"))}>
            TTD konsumen
          </button>
        )}
        {d.status === "kontraktor" && (
          <button className="btn-primary sm" onClick={stop(() => onAdvance(d.id, "kontraktor-selesai"))}>
            Kontraktor selesai → Teknik
          </button>
        )}
        <button className="btn-ai sm" onClick={stop(onRevise)}>
          ✦ Revisi AI
        </button>
        <button className="btn-ai sm" onClick={stop(onDeepRevise)}>
          🔬 Deep Revisi AI
        </button>
      </div>

      {d.revisiNote && <pre className="wd-revisi">{d.revisiNote}</pre>}
    </div>
  );
}

function Leg({
  label,
  due,
  done,
  daysLeft,
}: {
  label: string;
  due: string;
  done: string;
  daysLeft?: number;
}) {
  const state = done ? "done" : due ? "active" : "pending";
  return (
    <div className={`leg ${state}`}>
      <div className="leg-label">{label}</div>
      <div className="leg-val">
        {done ? `Selesai ${fmtDate(done)}` : due ? `Due ${fmtDate(due)}` : "—"}
      </div>
      {daysLeft !== undefined && <div className="leg-days">{fmtDaysLeft(daysLeft)}</div>}
    </div>
  );
}

/**
 * DetailModal — opened by clicking a card. Shows how far the unit's flow has
 * progressed (stepper), every relevant date, and image attachments. Attachments
 * are stored client-side (lib/localStore) until the backend supports uploads.
 */
function DetailModal({
  drawing,
  onClose,
  onAdvance,
}: {
  drawing: WorkDrawing;
  onClose: () => void;
  onAdvance: (id: string, action: WorkDrawingAction) => Promise<void>;
}) {
  const [files, setFiles] = useState<Attachment[]>(() => getAttachments(drawing.id));
  const [err, setErr] = useState("");
  const currentIdx = STAGE_ORDER.indexOf(drawing.status);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    setErr("");
    try {
      const added = await Promise.all(picked.map(readAsAttachment));
      const next = [...files, ...added];
      setFiles(next);
      setAttachments(drawing.id, next);
    } catch {
      setErr("Gagal membaca berkas — pastikan ukuran gambar wajar.");
    }
  };

  const removeAt = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setAttachments(drawing.id, next);
  };

  const rows: { label: string; value: string }[] = [
    { label: "Info masuk", value: fmtDate(drawing.infoMasuk) },
    { label: "Due gambar konsumen", value: fmtDate(drawing.konsumenDue) },
    { label: "Gambar konsumen selesai", value: fmtDate(drawing.konsumenDone) },
    { label: "TTD konsumen", value: fmtDate(drawing.ttdKonsumen) },
    { label: "Due gambar kontraktor", value: fmtDate(drawing.kontraktorDue) },
    { label: "Gambar kontraktor selesai", value: fmtDate(drawing.kontraktorDone) },
  ];

  return (
    <Modal
      title={`${drawing.konsumen} · ${drawing.unit}`}
      sub={drawing.projectName}
      onClose={onClose}
      width={640}
    >
      <div className="wd-detail">
        <div className="wd-stepper">
          {STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className={`wd-step ${i < currentIdx ? "past" : i === currentIdx ? "now" : "next"}`}
            >
              <span className="wd-step-dot">{i < currentIdx ? "✓" : i + 1}</span>
              <span className="wd-step-label">{STAGE_LABELS[s]}</span>
            </div>
          ))}
        </div>

        <div className="wd-detail-meta">
          PIC {picName(drawing.pic)}
          {drawing.activeLeg === "konsumen" && ` · ${fmtDaysLeft(drawing.konsumenDaysLeft)} (konsumen)`}
          {drawing.activeLeg === "kontraktor" && ` · ${fmtDaysLeft(drawing.kontraktorDaysLeft)} (kontraktor)`}
        </div>

        <div className="wd-detail-dates">
          {rows.map((r) => (
            <div className="wd-date-row" key={r.label}>
              <span className="wd-date-label">{r.label}</span>
              <span className="wd-date-val">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="wd-attach">
          <div className="wd-attach-hd">
            <span>Lampiran gambar</span>
            <label className="btn-ghost sm wd-attach-add">
              + Tambah gambar
              <input type="file" accept="image/*" multiple hidden onChange={onPick} />
            </label>
          </div>
          {err && <div className="login-error">{err}</div>}
          {files.length === 0 ? (
            <div className="wd-attach-empty">Belum ada lampiran.</div>
          ) : (
            <div className="wd-attach-grid">
              {files.map((f, i) => (
                <figure className="wd-thumb" key={f.name + i}>
                  <img src={f.dataUrl} alt={f.name} />
                  <button
                    className="wd-thumb-del"
                    onClick={() => removeAt(i)}
                    aria-label={`Hapus ${f.name}`}
                  >
                    ×
                  </button>
                  <figcaption>{f.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          {drawing.status === "konsumen" && (
            <button
              className="btn-ghost"
              onClick={() => onAdvance(drawing.id, "konsumen-selesai")}
            >
              Gambar konsumen selesai
            </button>
          )}
          {(drawing.status === "konsumen" || drawing.status === "ttd") && (
            <button className="btn-primary" onClick={() => onAdvance(drawing.id, "ttd-konsumen")}>
              TTD konsumen
            </button>
          )}
          {drawing.status === "kontraktor" && (
            <button
              className="btn-primary"
              onClick={() => onAdvance(drawing.id, "kontraktor-selesai")}
            >
              Kontraktor selesai → Teknik
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Read an image File into a stored attachment (data URL). */
function readAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        dataUrl: String(reader.result),
        uploadedAt: new Date().toISOString(),
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function CreateFlowModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: ProjectRollup[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateWorkDrawingInput>({
    projectId: projects[0]?.id ?? "",
    konsumen: "",
    unit: "",
    pic: "agus",
    infoMasuk: "",
  });
  // When the user picks "PIC custom" the select switches to a free-text field.
  const [picMode, setPicMode] = useState<"list" | "custom">("list");
  const [customPic, setCustomPic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof CreateWorkDrawingInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pic = picMode === "custom" ? customPic.trim() : form.pic;
    if (busy || !form.konsumen.trim() || !form.projectId) return;
    if (picMode === "custom" && !pic) {
      setErr("Isi nama PIC custom terlebih dahulu.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api.createWorkDrawing({ ...form, pic });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Info Konsumen Baru" sub="SLA gambar kerja 15 hari kerja dimulai dari info masuk" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Proyek</span>
          <select value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.gp} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>Nama konsumen</span>
            <input autoFocus value={form.konsumen} onChange={(e) => set("konsumen", e.target.value)} placeholder="Bpk. Andi" />
          </label>
          <label className="form-field">
            <span>Unit</span>
            <input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="A-12" />
          </label>
        </div>
        <div className="form-row">
          <label className="form-field">
            <span>PIC gambar kerja</span>
            {picMode === "list" ? (
              <select
                value={form.pic}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_PIC) {
                    setPicMode("custom");
                  } else {
                    set("pic", e.target.value);
                  }
                }}
              >
                {AUTHORS.map((a) => (
                  <option key={a} value={a}>
                    {picName(a)}
                  </option>
                ))}
                <option value={CUSTOM_PIC}>+ PIC custom…</option>
              </select>
            ) : (
              <div className="pic-custom">
                <input
                  autoFocus
                  value={customPic}
                  onChange={(e) => setCustomPic(e.target.value)}
                  placeholder="Nama PIC custom"
                />
                <button
                  type="button"
                  className="btn-ghost sm"
                  onClick={() => {
                    setPicMode("list");
                    setCustomPic("");
                  }}
                >
                  Daftar
                </button>
              </div>
            )}
          </label>
          <label className="form-field">
            <span>Tanggal info masuk</span>
            <input type="date" value={form.infoMasuk} onChange={(e) => set("infoMasuk", e.target.value)} />
          </label>
        </div>
        {err && <div className="login-error">{err}</div>}
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !form.konsumen.trim()}>
            {busy ? "Menyimpan…" : "Mulai Flow"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReviseModal({
  drawing,
  onClose,
  onDone,
}: {
  drawing: WorkDrawing;
  onClose: () => void;
  onDone: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(drawing.revisiNote);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const updated = await api.reviseWorkDrawing(drawing.id, instruction);
      setResult(updated.revisiNote);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Revisi Gambar Kerja (AI)"
      sub={`${drawing.konsumen} · ${drawing.unit} — aktif setelah clearance finance & legal`}
      onClose={onClose}
      width={620}
    >
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Permintaan revisi konsumen</span>
          <textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Mis. geser posisi dapur, tambah kamar, ubah fasad…"
          />
        </label>
        {err && <div className="login-error">{err}</div>}
        {result && <pre className="wd-revisi big">{result}</pre>}
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onDone}>
            Tutup
          </button>
          <button type="submit" className="btn-ai" disabled={busy}>
            {busy ? "Menganalisis…" : "✦ Analisis AI"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * DeepReviseModal — upload GK Kontraktor + GK TTD, run the vision-based
 * comparison (Ollama, server-side in greenparkperencanaanbe), poll while it
 * runs, then show findings + the annotated correction PDF.
 */
function DeepReviseModal({ drawing, onClose }: { drawing: WorkDrawing; onClose: () => void }) {
  const [wd, setWd] = useState<WorkDrawing>(drawing);
  const [uploading, setUploading] = useState<"" | "kontraktor" | "ttd">("");
  const [err, setErr] = useState("");
  const [viewing, setViewing] = useState<{ name: string; url: string } | null>(null);

  // Poll status while a check is running.
  useEffect(() => {
    if (wd.gkStatus !== "running") return;
    const t = setInterval(() => {
      api
        .deepRevisiStatus(wd.id)
        .then(setWd)
        .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    }, 4000);
    return () => clearInterval(t);
  }, [wd.gkStatus, wd.id]);

  const upload = async (kind: "kontraktor" | "ttd", file: File) => {
    setUploading(kind);
    setErr("");
    try {
      setWd(await api.uploadGK(wd.id, kind, file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading("");
    }
  };

  const start = async () => {
    setErr("");
    try {
      await api.startDeepRevisi(wd.id);
      setWd(await api.deepRevisiStatus(wd.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const openDoc = async (kind: "kontraktor" | "ttd" | "annotated", name: string) => {
    try {
      setViewing({ name, url: await api.gkDocUrl(wd.id, kind) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const ready = !!wd.gkKontraktor && !!wd.gkTTD;
  const status = wd.gkStatus || "idle";

  return (
    <Modal
      title="🔬 Deep Revisi AI — Cek Gambar Kerja"
      sub={`${wd.konsumen} · ${wd.unit} — GK Kontraktor vs GK TTD (vision AI, Ollama)`}
      onClose={onClose}
      width={680}
    >
      <div className="form">
        <div className="gk-upload-row">
          <GKUploadSlot
            label="GK Kontraktor"
            doc={wd.gkKontraktor}
            busy={uploading === "kontraktor"}
            onUpload={(f) => upload("kontraktor", f)}
            onView={() => wd.gkKontraktor && openDoc("kontraktor", wd.gkKontraktor.name)}
          />
          <GKUploadSlot
            label="GK TTD"
            doc={wd.gkTTD}
            busy={uploading === "ttd"}
            onUpload={(f) => upload("ttd", f)}
            onView={() => wd.gkTTD && openDoc("ttd", wd.gkTTD.name)}
          />
        </div>

        {err && <div className="login-error">{err}</div>}

        {status === "idle" ? (
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Tutup
            </button>
            <button type="button" className="btn-ai" disabled={!ready} onClick={start}>
              🔬 Mulai Cek
            </button>
          </div>
        ) : status === "running" ? (
          <div className="empty-note">
            ⏳ Menganalisis tiap halaman dengan AI — bisa beberapa menit untuk gambar kerja
            panjang.
          </div>
        ) : status === "failed" ? (
          <>
            <div className="login-error">Gagal: {wd.gkError}</div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Tutup
              </button>
              <button type="button" className="btn-ai" onClick={start}>
                🔬 Coba Lagi
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="wd-revisi big">
              {wd.gkFindings && wd.gkFindings.length > 0 ? (
                <ul className="gk-findings">
                  {wd.gkFindings.map((f, i) => (
                    <li key={i}>
                      <b>Hal. {f.page}</b>
                      {f.wrong && (
                        <>
                          {" "}
                          — SALAH: <code>{f.wrong}</code> → SEHARUSNYA: <code>{f.correct}</code>
                        </>
                      )}
                      <div className="gk-explain">
                        {f.explain} {f.confidence && `(${f.confidence})`}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                "Tidak ada ketidaksesuaian ditemukan — GK Kontraktor konsisten dengan GK TTD."
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Tutup
              </button>
              {wd.gkAnnotated && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => openDoc("annotated", wd.gkAnnotated!.name)}
                >
                  Lihat PDF Beranotasi
                </button>
              )}
              <button type="button" className="btn-ai" onClick={start}>
                🔬 Cek Ulang
              </button>
            </div>
          </>
        )}
      </div>

      {viewing && (
        <PdfViewerModal
          name={viewing.name}
          url={viewing.url}
          canReplace={false}
          busy={false}
          onReplace={() => {}}
          onClose={() => setViewing(null)}
        />
      )}
    </Modal>
  );
}

function GKUploadSlot({
  label,
  doc,
  busy,
  onUpload,
  onView,
}: {
  label: string;
  doc?: { name: string; size: number };
  busy: boolean;
  onUpload: (file: File) => void;
  onView: () => void;
}) {
  return (
    <div className="gk-upload-slot">
      <div className="gk-upload-label">{label}</div>
      {doc ? (
        <button type="button" className="btn-ghost sm" onClick={onView}>
          📄 {doc.name}
        </button>
      ) : (
        <label className="btn-ghost sm gk-upload-btn">
          {busy ? "Mengunggah…" : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
