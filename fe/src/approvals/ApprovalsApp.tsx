import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Division } from "@/auth/AuthContext";
import { DivisionTabs } from "@/components/DivisionTabs";
import { useRealtimeSocket } from "@/lib/realtime";
import { loadAllApprovals, realtimeURLs } from "./adapters";
import type { ApprovalItem, DivisionLoad } from "./adapters";
import "./approvals.css";

type Filter = "all" | Division;

/**
 * Cross-division approval inbox for all-access directors. Aggregates the items
 * each division flags as awaiting approval and lets the director approve/reject
 * (Dirops) or review them (CEO — read-only). Routed at /approvals, gated to
 * all-access users in App.tsx.
 */
export default function ApprovalsApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
  const errors = useMemo(() => loads.filter((l) => l.error), [loads]);
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
    <div className="apr-stage">
      <header className="apr-hdr">
        <div className="apr-hdr-logo"><img src="/brand/logo-mark.png" alt="Greenpark Group" /></div>
        <div className="apr-hdr-titles">
          <h1>Pusat Persetujuan</h1>
          <div className="apr-sub">Greenpark Group · Review &amp; approval lintas divisi</div>
        </div>
        <div className="apr-hdr-spacer" />
        <div className="apr-hdr-meta">
          <div className="apr-badge-total">
            {allItems.length}
            <small>MENUNGGU</small>
          </div>
          <div className="apr-hdr-user">
            <div className="hu-name">{user?.name}</div>
            <div className="hu-role">{canApprove ? "Dapat menyetujui" : "Tinjau saja"}</div>
          </div>
          <button className="apr-logout" onClick={logout} title="Keluar">✕</button>
        </div>
      </header>

      <nav className="apr-nav">
        <DivisionTabs />
      </nav>

      <main className="apr-content">
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
              <ApprovalCard key={item.uid} item={item} canApprove={canApprove} onSettled={settle} onOpen={() => navigate(`/${item.division}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ApprovalCard({
  item,
  canApprove,
  onSettled,
  onOpen,
}: {
  item: ApprovalItem;
  canApprove: boolean;
  onSettled: (uid: string) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");
  const [err, setErr] = useState("");

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
          </>
        ) : (
          <span className="apr-readonly">Tinjau saja</span>
        )}
        <button className="apr-btn ghost" onClick={onOpen}>Buka modul ↗</button>
      </div>
    </article>
  );
}
