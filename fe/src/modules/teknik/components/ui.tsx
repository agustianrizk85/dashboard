import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Status, Tone } from "../types";
import { STATUS_LABEL, STATUS_TONE } from "../lib/status";
import { Icon } from "./Icon";

/* ---- Info tooltip (data source tab/column + business logic) ------------ */
export interface CardInfo {
  /** Which spreadsheet tab + column(s) the number is read from. */
  source: string;
  /** How the figure is derived / what it means (business logic). */
  logic: string;
}

/** Small ⓘ marker that, on hover/focus, reveals where a card's data comes from
 *  (spreadsheet tab + column) and the business logic behind it. Rendered in a
 *  document.body portal with fixed positioning so it is never clipped by a card's
 *  overflow; flips above when near the viewport bottom. */
export function InfoTip({ source, logic }: CardInfo) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ax: number; flip: boolean } | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 280;
    const M = 8;
    const left = Math.max(M, Math.min(r.left + r.width / 2 - W / 2, window.innerWidth - W - M));
    const flip = r.bottom + 10 + 160 > window.innerHeight - M;
    const top = flip ? r.top - 10 : r.bottom + 10;
    const ax = Math.max(14, Math.min(r.left + r.width / 2 - left, W - 14));
    setPos({ top, left, ax, flip });
  }, []);
  const hide = useCallback(() => setPos(null), []);

  return (
    <span
      ref={ref}
      className="infotip"
      tabIndex={0}
      aria-label={`Sumber data: ${source}. Logika bisnis: ${logic}.`}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={hide}
      onBlur={hide}
    >
      i
      {pos &&
        createPortal(
          <span className={`tk-tip${pos.flip ? " flip" : ""}`} role="tooltip" style={{ top: pos.top, left: pos.left }}>
            <span className="tk-tip-arrow" style={{ left: pos.ax }} />
            <span className="tk-tip-row">
              <b>Sumber (tab · kolom)</b>
              {source}
            </span>
            <span className="tk-tip-row">
              <b>Logika bisnis</b>
              {logic}
            </span>
          </span>,
          document.body,
        )}
    </span>
  );
}

/* ---- Panel shell ------------------------------------------------------ */
export interface PanelProps {
  tag?: string;
  title: string;
  sub?: string;
  accent?: string;
  info?: CardInfo;
  onExpand?: () => void;
  children: ReactNode;
}

export function Panel({ tag, title, sub, accent, info, onExpand, children }: PanelProps) {
  return (
    <div className="panel">
      <header className="panel-hd">
        {tag && (
          <span className="ptag" style={accent ? { background: accent } : undefined}>
            {tag}
          </span>
        )}
        <span className="ptitle">{title}</span>
        {sub && <span className="psub">· {sub}</span>}
        {info && <InfoTip {...info} />}
        <span className="pspacer" />
        {onExpand && (
          <button className="expand" onClick={onExpand} title="Perbesar">
            <Icon name="expand" size={14} />
          </button>
        )}
      </header>
      <div className="panel-bd">{children}</div>
    </div>
  );
}

/* ---- KPI tile --------------------------------------------------------- */
export interface KpiProps {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "ok" | "warn" | "bad";
  delta?: string;
  deltaDir?: "up" | "down";
  onClick?: () => void;
  hint?: string;
  info?: CardInfo;
}

export function Kpi({ label, value, unit, tone, delta, deltaDir, onClick, hint, info }: KpiProps) {
  return (
    <div
      className={`kpi ${tone ?? ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={hint}
    >
      <span className="label">
        {label}
        {info && <InfoTip {...info} />}
      </span>
      <span className="val">
        {value}
        {unit && <span className="u"> {unit}</span>}
      </span>
      {delta && <span className={`delta ${deltaDir ?? ""}`}>{delta}</span>}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

/* ---- Small metric block ----------------------------------------------- */
export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  tone?: "ok" | "warn" | "bad";
  style?: React.CSSProperties;
  className?: string;
  valueStyle?: React.CSSProperties;
}

export function Stat({ label, value, tone, style, className, valueStyle }: StatProps) {
  return (
    <div className={`stat ${className ?? ""}`} style={style}>
      <span className="s-label">{label}</span>
      <span className={`s-val ${tone ?? ""}`} style={valueStyle}>
        {value}
      </span>
    </div>
  );
}

/* ---- Mini progress bar ------------------------------------------------ */
export interface BarProps {
  value: number;
  max?: number;
  tick?: number;
  tone?: Status;
}

export function Bar({ value, max = 100, tick, tone = "green" }: BarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${tone}`}>
      <i style={{ width: pct + "%" }} />
      {tick != null && (
        <span className="tick" style={{ left: Math.max(0, Math.min(100, (tick / max) * 100)) + "%" }} />
      )}
    </div>
  );
}

/* ---- Pill / chip ------------------------------------------------------ */
export interface PillProps {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}

export function Pill({ tone = "neutral", dot = true, children }: PillProps) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="pdot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}
