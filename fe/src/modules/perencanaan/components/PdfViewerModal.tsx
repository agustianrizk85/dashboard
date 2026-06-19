import { useEffect } from "react";

/**
 * PdfViewerModal renders an uploaded review PDF inline (in an iframe) inside the
 * dashboard, with a "Ganti PDF" action that re-uploads — which sends the task
 * back to Review for re-approval.
 */
export function PdfViewerModal({
  name,
  url,
  canReplace,
  busy,
  onReplace,
  onClose,
}: {
  name: string;
  url: string;
  canReplace: boolean;
  busy: boolean;
  onReplace: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pdf-hd">
          <span className="pdf-hd-ic">PDF</span>
          <span className="pdf-hd-name">{name}</span>
          <span className="pdf-hd-sp" />
          {canReplace && (
            <button className="btn-ghost sm" disabled={busy} onClick={onReplace}>
              {busy ? "Mengunggah…" : "Ganti PDF"}
            </button>
          )}
          <a className="btn-ghost sm" href={url} target="_blank" rel="noopener noreferrer">
            Buka tab
          </a>
          <button className="pdf-close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>
        <iframe className="pdf-frame" src={url} title={name} />
        {canReplace && (
          <div className="pdf-foot">
            Mengganti PDF akan mengembalikan tugas ke status <b>Review</b> untuk persetujuan ulang Kadep.
          </div>
        )}
      </div>
    </div>
  );
}
