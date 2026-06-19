import type { ReactNode } from "react";
import type { Status, Tone } from "../types";
import { STATUS_LABEL, STATUS_TONE } from "../lib/status";
import { Icon } from "./Icon";

/* ---- Panel shell ------------------------------------------------------ */
export interface PanelProps {
  tag?: string;
  title: string;
  sub?: string;
  accent?: string;
  onExpand?: () => void;
  children: ReactNode;
}

export function Panel({ tag, title, sub, accent, onExpand, children }: PanelProps) {
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
}

export function Kpi({ label, value, unit, tone, delta, deltaDir }: KpiProps) {
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <span className="label">{label}</span>
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
