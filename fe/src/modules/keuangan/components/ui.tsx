import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Status, Tone } from "../types";
import { STATUS_LABEL, STATUS_TONE } from "../lib/status";
import { Icon } from "./Icon";

/* ---- Info tooltip (data source + business process) -------------------- */
export interface CardInfo {
  /** Where this card's numbers come from (data source). */
  source: string;
  /** The business process the card reflects. */
  process: string;
}

/** Small ⓘ marker that reveals, on hover/focus, where a card's data comes from
 *  and which business process it represents. The bubble is rendered in a
 *  `document.body` portal with fixed positioning so it is NEVER clipped by a
 *  card's `overflow: hidden`; it flips above the icon when near the viewport
 *  bottom and is clamped to stay on screen. */
export function InfoTip({ source, process: proc }: CardInfo) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ax: number; flip: boolean } | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 260;
    const M = 8;
    const left = Math.max(M, Math.min(r.left + r.width / 2 - W / 2, window.innerWidth - W - M));
    const flip = r.bottom + 10 + 150 > window.innerHeight - M;
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
      aria-label={`Sumber data: ${source}. Proses bisnis: ${proc}.`}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={hide}
      onBlur={hide}
    >
      <Icon name="info" size={13} />
      {pos &&
        createPortal(
          <span
            className={`kfin-tip${pos.flip ? " flip" : ""}`}
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
          >
            <span className="kfin-tip-arrow" style={{ left: pos.ax }} />
            <span className="kfin-tip-row">
              <b>Sumber data</b>
              {source}
            </span>
            <span className="kfin-tip-row">
              <b>Proses bisnis</b>
              {proc}
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
  info?: CardInfo;
}

export function Kpi({ label, value, unit, tone, delta, deltaDir, info }: KpiProps) {
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <span className="label">
        {label}
        {info && <InfoTip {...info} />}
      </span>
      <span className="val">
        {value}
        {unit && <span className="u"> {unit}</span>}
      </span>
      {delta && <span className={`delta ${deltaDir ?? ""}`}>{delta}</span>}
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
