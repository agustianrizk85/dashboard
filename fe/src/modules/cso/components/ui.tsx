import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Tone } from "../types";

/* ---- Panel shell ------------------------------------------------------- */
export function Panel({
  tag,
  title,
  sub,
  children,
  onExpand,
}: {
  tag?: string;
  title: string;
  sub?: string;
  children: ReactNode;
  onExpand?: () => void;
}) {
  return (
    <div className="panel">
      <header className="panel-hd">
        {tag && <span className="ptag">{tag}</span>}
        <span className="ptitle">{title}</span>
        {sub && <span className="psub">· {sub}</span>}
        <span className="pspacer" />
        {onExpand && (
          <button className="expand" onClick={onExpand} title="Perbesar">
            ⤢
          </button>
        )}
      </header>
      <div className="panel-bd">{children}</div>
    </div>
  );
}

/* ---- KPI tile ---------------------------------------------------------- */
export function Kpi({
  label,
  value,
  unit,
  tone,
  delta,
  hint,
  onClick,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "ok" | "warn" | "bad";
  delta?: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`kpi ${tone ?? ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={hint}
    >
      <span className="label">{label}</span>
      <span className="val">
        {value}
        {unit && <span className="u"> {unit}</span>}
      </span>
      {delta && <span className="delta">{delta}</span>}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

/* ---- Pill / chip ------------------------------------------------------- */
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`pill ${tone}`}>
      <span className="pdot" />
      {children}
    </span>
  );
}

/* ---- Mini progress bar ------------------------------------------------- */
export function Bar({ value, tick, tone = "green" }: { value: number; tick?: number; tone?: "green" | "yellow" | "red" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`bar ${tone}`}>
      <i style={{ width: pct + "%" }} />
      {tick != null && <span className="tick" style={{ left: Math.max(0, Math.min(100, tick)) + "%" }} />}
    </div>
  );
}

/* ---- Clock ------------------------------------------------------------- */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <div className="clk-time">{now.toLocaleTimeString("id-ID")}</div>
      <div className="clk-date">{now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
    </div>
  );
}
