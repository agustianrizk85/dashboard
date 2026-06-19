// Small presentational primitives shared across the planning views.

import type { ReactNode } from "react";
import type { Rag, TaskStatus } from "../types";
import { STATUS_LABELS, ragTone, statusRag } from "../lib/format";

/**
 * Tooltip wraps any element and shows a hover bubble (CSS-driven via the
 * `data-tip` attribute). Because the dashboard renders on a scaled canvas, an
 * attribute/`::after` tooltip scales correctly with everything else, unlike the
 * native browser title which renders at viewport scale.
 */
export function Tooltip({
  tip,
  children,
  pos = "top",
}: {
  tip: string;
  children: ReactNode;
  pos?: "top" | "bottom";
}) {
  return (
    <span className="tip" data-tip={tip} data-tip-pos={pos}>
      {children}
    </span>
  );
}

/** A small circled "i" that reveals an explanatory tooltip on hover. */
export function InfoTip({ tip, pos = "top" }: { tip: string; pos?: "top" | "bottom" }) {
  return (
    <span className="info-tip" data-tip={tip} data-tip-pos={pos} aria-label={tip}>
      i
    </span>
  );
}

/** A thin progress bar tinted by completion. */
export function ProgressBar({ value }: { value: number }) {
  const tone = value >= 100 ? "ok" : value > 0 ? "warn" : "grey";
  return (
    <div className="pbar" title={`${value}%`}>
      <div className={`pbar-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** A coloured status pill for a task. */
export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`pill ${ragTone(statusRag(status))}`}>{STATUS_LABELS[status]}</span>;
}

/** A small RAG dot. */
export function RagDot({ rag }: { rag: Rag }) {
  return <span className={`rag-dot ${ragTone(rag)}`} />;
}

/** A labelled metric card. */
export function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
