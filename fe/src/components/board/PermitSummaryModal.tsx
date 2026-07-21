import { useMemo } from "react";
import type { PermitLahanSummary, PermitStep } from "./permitBoard";
import { permitLahanHref } from "./permitBoard";
import { fmtDayMonth } from "./boardFmt";

/* Read-only drill-down for one lahan's Legal Permit checklist. Opened from a
 * "🏛 Legal Permit" summary card on the shared board. The board never writes
 * permit steps — editing happens in the Legal Permit module (deep link below),
 * so this is a pure viewer: steps grouped by macro phase A..I with status,
 * due-date and output markers. */

/** Macro-phase labels (mirror service.CategoryLabels; static so non-legal users
 *  don't need the gated /meta endpoint). Unmapped codes fall back gracefully. */
const CATEGORY_LABELS: Record<string, string> = {
  A: "A · Pra-Akad Lahan (Simultan)",
  B: "B · Akad Lahan (Kesinambungan)",
  C: "C · Permit Pasca Akad Lahan",
  D: "D · Legal Pasca Akad Lahan",
  E: "E · Master Data PT",
  F: "F · Master Data PKS Bank",
  G: "G · Proses PKS Bank",
  H: "H · Flow Bisnis PKS Bank",
  I: "I · Vendor / Pihak Ketiga",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  todo: { label: "Belum", cls: "todo" },
  progress: { label: "Berjalan", cls: "progress" },
  done: { label: "Selesai", cls: "done" },
};

function StepRow({ s }: { s: PermitStep }) {
  const st = STATUS_META[s.boardStatus] ?? STATUS_META.todo;
  return (
    <div className="cyb-pm-row">
      <span className="cyb-pm-code">{s.code}</span>
      <span className="cyb-pm-name">{s.name}</span>
      <span className="cyb-pm-marks">
        {s.confidential && (
          <span className="cyb-pm-mark conf" title="Output rahasia (watermark untuk Sales)">
            🔒
          </span>
        )}
        {s.notify && (
          <span className="cyb-pm-mark notify" title="Memberi tahu Perencanaan &amp; Teknik">
            📢
          </span>
        )}
        {s.due && (
          <span className={"cyb-pm-due" + (s.overdue ? " late" : "")} title={s.overdue ? "Jatuh tempo terlewat" : "Jatuh tempo"}>
            🕐 {fmtDayMonth(s.due)}
          </span>
        )}
        <span className={"cyb-pm-badge " + st.cls}>{st.label}</span>
      </span>
    </div>
  );
}

export function PermitSummaryModal({
  summary,
  onClose,
}: {
  summary: PermitLahanSummary;
  onClose: () => void;
}) {
  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  // Group steps by macro phase, preserving A..I order and the A1..n order within.
  const groups = useMemo(() => {
    const map = new Map<string, PermitStep[]>();
    for (const s of summary.steps) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [summary.steps]);

  return (
    <div
      className="cyb-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cyb-modal cyb-pm-modal">
        <button className="cyb-x" onClick={onClose} aria-label="Tutup">
          ×
        </button>

        <div className="cyb-pm-head">
          <div className="cyb-pm-pill">🏛 Legal Permit</div>
          <h3 className="cyb-pm-title">{summary.projectName}</h3>
          <div className="cyb-pm-stats">
            <span className="cyb-pm-progress">
              <span className="cyb-pm-bar">
                <span className="cyb-pm-bar-fill" style={{ width: pct + "%" }} />
              </span>
              <b>
                {summary.done}/{summary.total}
              </b>{" "}
              selesai ({pct}%)
            </span>
            {summary.progress > 0 && <span className="cyb-pm-chip">{summary.progress} berjalan</span>}
            {summary.overdue > 0 && (
              <span className="cyb-pm-chip late">⚠ {summary.overdue} jatuh tempo</span>
            )}
          </div>
        </div>

        <div className="cyb-pm-note">
          Tampilan baca-saja — sinkron dari modul Legal Permit. Ubah status &amp; unggah berkas di sana.
        </div>

        <div className="cyb-pm-body">
          {groups.map(([cat, steps]) => (
            <section className="cyb-pm-group" key={cat}>
              <div className="cyb-pm-group-hd">
                <span>{CATEGORY_LABELS[cat] ?? `Kategori ${cat}`}</span>
                <span className="cyb-pm-group-count">
                  {steps.filter((s) => s.boardStatus === "done").length}/{steps.length}
                </span>
              </div>
              {steps.map((s) => (
                <StepRow key={s.stepId} s={s} />
              ))}
            </section>
          ))}
          {groups.length === 0 && <div className="cyb-col-empty">Belum ada langkah.</div>}
        </div>

        <div className="cyb-pm-foot">
          <a className="cyb-btn-primary" href={permitLahanHref(summary.projectId)}>
            Buka di Legal Permit →
          </a>
        </div>
      </div>
    </div>
  );
}
