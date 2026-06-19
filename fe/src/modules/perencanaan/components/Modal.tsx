import { useEffect } from "react";
import type { ReactNode } from "react";

/** Generic overlay modal — closes on Esc or scrim click. */
export function Modal({
  title,
  sub,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
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
      <div className="modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <header className="modal-hd">
          <h2>{title}</h2>
          {sub && <span className="mh-sub">{sub}</span>}
          <span className="mh-sp" />
          <button className="mclose" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>
        <div className="modal-bd">{children}</div>
      </div>
    </div>
  );
}
