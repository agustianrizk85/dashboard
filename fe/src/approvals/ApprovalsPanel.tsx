import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import type { Division } from "@/auth/AuthContext";
import { useRealtimeSocket } from "@/lib/realtime";
import { loadAllApprovals, realtimeURLs } from "./adapters";
import type { ApprovalItem, DivisionLoad } from "./adapters";
import "./approvals.css";

type Filter = "all" | Division;

/**
 * Cross-division approval inbox CONTENT — a compact panel-header, the division
 * filter toolbar, and the grid of approval cards, with its own data loading +
 * realtime. Chrome-less on purpose so it drops straight into a host shell: the
 * director Console's WMS frame (left sidebar) hosts it as the "Persetujuan"
 * view. Dirops can approve/reject; the CEO reviews (read-only via canApprove).
 */
export function ApprovalsPanel() {
  const { user } = useAuth();
  const canApprove = !!user?.canApprove;

  const [loads, setLoads] = useState<DivisionLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(() => {
    setLoading(true);
    loadAllApprovals()
      .then(setLoads)
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  // Realtime: one socket per division backend; any push re-aggregates the inbox
  // so the director's cross-division queue stays live without a refresh.
  const wsUrls = realtimeURLs();
  useRealtimeSocket(wsUrls.perencanaan, refresh);
  useRealtimeSocket(wsUrls.permit, refresh);
  useRealtimeSocket(wsUrls.marketing, refresh);

  const allItems = useMemo(() => loads.flatMap((l) => l.items), [loads]);
  const errors = useMemo(() => loads.filter((l) => l.error && !l.inactive), [loads]);
  const inactive = useMemo(() => loads.filter((l) => l.inactive), [loads]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allItems.length };
    for (const l of loads) c[l.division] = l.items.length;
    return c;
  }, [loads, allItems]);

  const shown = filter === "all" ? allItems : allItems.filter((i) => i.division === filter);

  /** Drop an item from the list once its decision succeeds. */
  const settle = useCallback((uid: string) => {
    setLoads((prev) => prev.map((l) => ({ ...l, items: l.items.filter((i) => i.uid !== uid) })));
  }, []);

  const TABS: { key: Filter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "perencanaan", label: "Perencanaan" },
    { key: "permit", label: "Legal & Perizinan" },
    { key: "marketing", label: "Marketing" },
  ];

  return (
    <>
      <div className="apr-panel-head">
        <div>
          <h2>Pusat Persetujuan</h2>
          <p>Review &amp; approval lintas divisi{canApprove ? "" : " · tinjau saja"}.</p>
        </div>
        <span className="apr-panel-total">
          {allItems.length}
          <small>menunggu</small>
        </span>
      </div>

      <div className="apr-toolbar">
        <div className="apr-filters">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`apr-chip ${filter === t.key ? "on" : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              <span className="apr-chip-count">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <button className="apr-refresh" onClick={refresh} disabled={loading}>
          {loading ? "Memuat…" : "↻ Muat ulang"}
        </button>
      </div>

      {errors.map((e) => (
        <div key={e.division} className="apr-error">
          <b>{e.label}</b> — gagal memuat: {e.error}
        </div>
      ))}

      {inactive.map((e) => (
        <div key={e.division} className="apr-inactive">
          <b>{e.label}</b> — modul belum aktif di server (backend belum di-deploy). Datanya menyusul saat backend online.
        </div>
      ))}

      {loading && allItems.length === 0 ? (
        <div className="apr-empty">Memuat antrian persetujuan…</div>
      ) : shown.length === 0 ? (
        <div className="apr-empty">
          {errors.length && allItems.length === 0
            ? "Tidak ada data — periksa koneksi backend divisi di atas."
            : "🎉 Tidak ada item yang menunggu persetujuan."}
        </div>
      ) : (
        <div className="apr-grid">
          {shown.map((item) => (
            <ApprovalCard key={item.uid} item={item} canApprove={canApprove} onSettled={settle} />
          ))}
        </div>
      )}
    </>
  );
}

function ApprovalCard({
  item,
  canApprove,
  onSettled,
}: {
  item: ApprovalItem;
  canApprove: boolean;
  onSettled: (uid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject" | "revise">("");
  const [err, setErr] = useState("");
  const [viewing, setViewing] = useState(false);
  const [revising, setRevising] = useState(false);
  const [instruction, setInstruction] = useState("");

  const decide = async (kind: "approve" | "reject") => {
    if (busy) return;
    if (kind === "reject" && item.acceptsNote && !note.trim()) {
      setErr("Beri alasan penolakan dulu.");
      return;
    }
    setBusy(kind);
    setErr("");
    try {
      await (kind === "approve" ? item.approve(note.trim()) : item.reject(note.trim()));
      onSettled(item.uid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  };

  const sendRevisi = async () => {
    if (busy || !item.revise) return;
    if (!instruction.trim()) {
      setErr("Tulis instruksi revisi dulu.");
      return;
    }
    setBusy("revise");
    setErr("");
    try {
      await item.revise(instruction.trim());
      onSettled(item.uid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  };

  return (
    <article className={`apr-card div-${item.division}`}>
      <div className="apr-card-top">
        <span className={`apr-tag div-${item.division}`}>{item.badge}</span>
        {item.meta && <span className="apr-meta">{item.meta}</span>}
      </div>
      <h3 className="apr-title">{item.title}</h3>
      <p className="apr-subtitle">{item.subtitle}</p>

      <button className="apr-detail-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "▾ Sembunyikan detail" : "▸ Lihat detail"}
      </button>
      {open && (
        <dl className="apr-detail">
          {item.detail.map((d, i) => (
            <div key={i} className="apr-detail-row">
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {canApprove && item.acceptsNote && (
        <input
          className="apr-note"
          placeholder="Catatan (opsional untuk setuju, wajib untuk tolak)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {err && <div className="apr-card-err">{err}</div>}

      <div className="apr-actions">
        {canApprove ? (
          <>
            <button className="apr-btn approve" disabled={!!busy} onClick={() => decide("approve")}>
              {busy === "approve" ? "…" : "Setujui"}
            </button>
            <button className="apr-btn reject" disabled={!!busy} onClick={() => decide("reject")}>
              {busy === "reject" ? "…" : "Tolak"}
            </button>
            {item.revise && (
              <button
                className={`apr-btn revise ${revising ? "on" : ""}`}
                disabled={!!busy}
                onClick={() => setRevising((v) => !v)}
              >
                Revisi
              </button>
            )}
          </>
        ) : (
          <span className="apr-readonly">Tinjau saja</span>
        )}
        {item.doc && (
          <button className="apr-btn ghost" onClick={() => setViewing(true)}>
            👁 Lihat gambar
          </button>
        )}
      </div>

      {canApprove && item.revise && revising && (
        <div className="apr-revise">
          <textarea
            className="apr-revise-input"
            placeholder="Instruksi revisi untuk pengaju — apa yang perlu diperbaiki…"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
          />
          <div className="apr-revise-actions">
            <button
              className="apr-btn ghost sm"
              disabled={!!busy}
              onClick={() => {
                setRevising(false);
                setInstruction("");
              }}
            >
              Batal
            </button>
            <button className="apr-btn revise sm" disabled={!!busy || !instruction.trim()} onClick={sendRevisi}>
              {busy === "revise" ? "Mengirim…" : "Kirim Revisi"}
            </button>
          </div>
        </div>
      )}

      {viewing && item.doc && <DocViewer doc={item.doc} onClose={() => setViewing(false)} />}
    </article>
  );
}

/**
 * Full-screen inline preview of an approval's attached document. Fetches the
 * file (with auth) as an object URL; renders a PDF in an iframe. Formats the
 * browser can't display natively (e.g. DWG) fall back to an open/download link.
 */
function DocViewer({ doc, onClose }: { doc: NonNullable<ApprovalItem["doc"]>; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    let objUrl = "";
    doc
      .open()
      .then((u) => {
        if (alive) {
          objUrl = u;
          setUrl(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [doc, onClose]);

  const renderable = doc.ext === "pdf";
  return (
    <div className="apr-doc-overlay" onClick={onClose}>
      <div className="apr-doc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="apr-doc-hd">
          <span className="apr-doc-ic">{doc.ext ? doc.ext.toUpperCase() : "DOK"}</span>
          <span className="apr-doc-name">{doc.name}</span>
          <span className="apr-doc-sp" />
          {url && (
            <a className="apr-doc-link" href={url} target="_blank" rel="noopener noreferrer" download={doc.name}>
              Unduh / tab baru
            </a>
          )}
          <button className="apr-doc-close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>
        {err ? (
          <div className="apr-doc-msg">Gagal memuat dokumen: {err}</div>
        ) : !url ? (
          <div className="apr-doc-msg">Memuat dokumen…</div>
        ) : renderable ? (
          <iframe className="apr-doc-frame" src={url} title={doc.name} />
        ) : (
          <div className="apr-doc-msg">
            Format <b>.{doc.ext || "?"}</b> tidak bisa ditampilkan langsung di browser (mis. DWG). Gunakan{" "}
            <b>Unduh / tab baru</b> untuk membukanya di aplikasi CAD.
          </div>
        )}
      </div>
    </div>
  );
}
