import { useRef, useState } from "react";
import { api } from "../api/client";
import type { TaskAttachment, TaskDoc, TaskStatus } from "../types";
import { picName } from "../lib/format";
import { PdfViewerModal } from "./PdfViewerModal";
import { TaskDeepAnalisisModal } from "./TaskDeepAnalisisModal";

/** "2.4 MB" / "312 KB" / "980 B". */
function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

/**
 * ReviewControls renders the review document workflow for a single task:
 *   - the owning PIC (or a manager) uploads / replaces a PDF when the task is
 *     in Proses or Review (uploading moves it to Review),
 *   - anyone can view the uploaded PDF,
 *   - the head of department (Kadep / CEO) approves it — which automatically
 *     completes the task (Selesai) — or rejects it back to Proses.
 */
export function ReviewControls({
  projectId,
  taskId,
  status,
  doc,
  attachments,
  approvedBy,
  revisiNote,
  canUpload,
  canApprove,
  aiRunning = false,
  onDone,
}: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  doc?: TaskDoc;
  /** Extra files beyond the single review Doc — any type, multiple at once. */
  attachments?: TaskAttachment[];
  approvedBy?: string;
  revisiNote?: string;
  canUpload: boolean;
  canApprove: boolean;
  aiRunning?: boolean;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const multiRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [view, setView] = useState<{ url: string; name: string } | null>(null);
  const [analisis, setAnalisis] = useState(false);
  const [uploadingMulti, setUploadingMulti] = useState(0); // count still in flight, for the button label

  const onPickMulti = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file(s)
    if (files.length === 0) return;
    setErr("");
    setUploadingMulti(files.length);
    for (const f of files) {
      try {
        await api.uploadTaskAttachment(projectId, taskId, f);
        setUploadingMulti((n) => Math.max(0, n - 1));
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : String(e2));
        setUploadingMulti(0);
        break;
      }
    }
    onDone();
  };

  const delAttachment = async (attId: string) => {
    if (!window.confirm("Hapus lampiran ini?")) return;
    setErr("");
    try {
      await api.deleteTaskAttachment(projectId, taskId, attId);
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    }
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setErr("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const openView = () => {
    setErr("");
    api
      .taskDocUrl(projectId, taskId)
      .then((url) => setView({ url, name: doc?.name ?? "dokumen.pdf" }))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };

  const closeView = () => {
    setView((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErr("Hanya file PDF yang diperbolehkan.");
      return;
    }
    setBusy("upload");
    setErr("");
    api
      .uploadTaskDoc(projectId, taskId, file)
      .then(async () => {
        onDone();
        // If the viewer is open (re-upload), refresh it to the new PDF.
        if (view) {
          const url = await api.taskDocUrl(projectId, taskId);
          setView((v) => {
            if (v) URL.revokeObjectURL(v.url);
            return { url, name: file.name };
          });
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(""));
  };

  const showUpload = canUpload && status !== "done" && status !== "todo";
  const showApprove = canApprove && status === "review" && !!doc;
  const hasAttachments = !!attachments && attachments.length > 0;

  // Nothing to show (e.g. a todo task for a non-uploader with no files).
  if (!doc && !showUpload && !hasAttachments) return null;

  return (
    <div className="review">
      {revisiNote && status !== "done" && (
        <span className="review-revisi" title="Instruksi revisi dari reviewer">
          ⚠ Revisi: {revisiNote}
        </span>
      )}
      {doc && (
        <button
          type="button"
          className="review-doc"
          title={`${doc.name} · diunggah ${picName(doc.uploadedBy)}`}
          onClick={openView}
        >
          <span className="review-doc-ic">PDF</span>
          <span className="review-doc-name">{doc.name}</span>
        </button>
      )}

      {status === "done" && approvedBy && (
        <span className="review-approved">✓ disetujui {picName(approvedBy)}</span>
      )}

      {/* Always available to uploaders so re-upload works even from the viewer
          when the task is already Selesai (which re-opens Review). */}
      {canUpload && <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onPick} />}

      {/* Lampiran — any type, multiple files at once, separate from the single
          review Doc above. */}
      {(hasAttachments || canUpload) && (
        <div className="review-attach">
          {hasAttachments && (
            <ul className="review-attach-list">
              {attachments!.map((a) => (
                <li key={a.id}>
                  <a href={api.taskAttachmentUrl(projectId, taskId, a.id)} target="_blank" rel="noreferrer" title={`diunggah ${picName(a.by)}`}>
                    📎 {a.name}
                  </a>
                  <span className="review-attach-size">{fmtSize(a.size)}</span>
                  {canUpload && (
                    <button type="button" className="review-attach-del" title="Hapus lampiran" onClick={() => void delAttachment(a.id)}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canUpload && (
            <>
              <input ref={multiRef} type="file" multiple hidden onChange={onPickMulti} />
              <button type="button" className="rv-btn" disabled={uploadingMulti > 0} onClick={() => multiRef.current?.click()}>
                {uploadingMulti > 0 ? `Mengunggah… (${uploadingMulti} lagi)` : "+ Lampiran"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="review-btns">
        {(canUpload || canApprove) && (
          <button
            type="button"
            className="rv-btn ai"
            disabled={busy !== "" || !doc}
            title={doc ? "Cek dokumen dengan AI vision terhadap checklist skill" : "Unggah PDF dulu untuk analisis AI"}
            onClick={() => setAnalisis(true)}
          >
            {aiRunning ? "🔬 Memproses…" : "🔬 Deep Analisis"}
          </button>
        )}
        {showUpload && (
          <button
            type="button"
            className="rv-btn"
            disabled={busy !== "" || aiRunning}
            onClick={() => fileRef.current?.click()}
          >
            {busy === "upload" ? "Mengunggah…" : doc ? "Ganti PDF" : "Unggah PDF"}
          </button>
        )}
        {showApprove && (
          <>
            <button
              type="button"
              className="rv-btn approve"
              disabled={busy !== "" || aiRunning}
              onClick={() => void run("approve", () => api.approveTask(projectId, taskId))}
            >
              {busy === "approve" ? "…" : "Setujui"}
            </button>
            <button
              type="button"
              className="rv-btn reject"
              disabled={busy !== "" || aiRunning}
              onClick={() => void run("reject", () => api.rejectTask(projectId, taskId))}
            >
              Tolak
            </button>
          </>
        )}
      </div>

      {err && <span className="review-err">{err}</span>}

      {view && (
        <PdfViewerModal
          name={view.name}
          url={view.url}
          canReplace={canUpload}
          busy={busy === "upload"}
          onReplace={() => fileRef.current?.click()}
          onClose={closeView}
        />
      )}

      {analisis && doc && (
        <TaskDeepAnalisisModal
          projectId={projectId}
          taskId={taskId}
          docName={doc.name}
          onClose={() => setAnalisis(false)}
        />
      )}
    </div>
  );
}
