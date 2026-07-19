import { useRef, useState } from "react";
import { api } from "../api/client";
import type { TaskDoc, TaskStatus } from "../types";
import { picName } from "../lib/format";
import { PdfViewerModal } from "./PdfViewerModal";
import { TaskDeepAnalisisModal } from "./TaskDeepAnalisisModal";

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
  approvedBy?: string;
  revisiNote?: string;
  canUpload: boolean;
  canApprove: boolean;
  aiRunning?: boolean;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [view, setView] = useState<{ url: string; name: string } | null>(null);
  const [analisis, setAnalisis] = useState(false);

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

  // Nothing to show (e.g. a todo task for a non-uploader).
  if (!doc && !showUpload) return null;

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
