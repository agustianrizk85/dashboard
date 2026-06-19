import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { MonthPoint, StatusKey } from "../types";
import { STATUS } from "../lib/format";

/* ---------- status dot ---------- */
export function StatusDot({ s, size = 10 }: { s: StatusKey; size?: number }) {
  return <span className="dot" style={{ width: size, height: size, background: STATUS[s].c }} />;
}

/* ---------- Card shell ---------- */
export function Card({
  title,
  tag,
  icon,
  accent,
  onExpand,
  children,
  className = "",
  style,
}: {
  title: string;
  tag?: string;
  icon?: ReactNode;
  accent?: string;
  onExpand?: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={"card " + className} style={style}>
      <header className="card-h">
        <div className="card-h-l">
          {icon && (
            <span className="card-ic" style={{ color: accent || "#0E5C34" }}>
              {icon}
            </span>
          )}
          <div>
            <h3>{title}</h3>
            {tag && <span className="card-tag">{tag}</span>}
          </div>
        </div>
        {onExpand && (
          <button className="expand-btn" onClick={onExpand} title="Buka detail">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        )}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

/* ---------- Progress ring / gauge ---------- */
export function Ring({
  value,
  max,
  size = 132,
  stroke = 13,
  color = "#1F9D54",
  track = "#E7EDE8",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, value / max));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="ring-c">{children}</div>
    </div>
  );
}

/* ---------- Donut (multi segment) ---------- */
export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}
export function Donut({ data, size = 132, stroke = 22, colors }: { data: DonutDatum[]; size?: number; stroke?: number; colors: string[] }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} className="donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2EE" strokeWidth={stroke} />
      {data.map((d, i) => {
        const frac = d.value / total;
        const seg = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={d.color || colors[i % colors.length]}
            strokeWidth={stroke}
            strokeDasharray={`${c * frac} ${c * (1 - frac)}`}
            strokeDashoffset={-c * acc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>
              {d.label}: {d.value}
            </title>
          </circle>
        );
        acc += frac;
        return seg;
      })}
    </svg>
  );
}

/* ---------- Vertical mini bars (akad vs booking trend) ---------- */
export function MiniBars({ data, max, color = "#1F9D54", height = 64 }: { data: MonthPoint[]; max?: number; color?: string; height?: number }) {
  const m = max || Math.max(...data.map((d) => d.booking)) || 1;
  return (
    <div className="minibars" style={{ height }}>
      {data.map((d, i) => (
        <div className="mb-col" key={i} title={`${d.m}: ${d.akad} akad`}>
          <div className="mb-bars">
            <div className="mb-bar" style={{ height: (d.booking / m) * 100 + "%", background: "#CFE6D6" }} />
            <div className="mb-bar mb-bar-fg" style={{ height: (d.akad / m) * 100 + "%", background: color }} />
          </div>
          <span className="mb-x">{d.m}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Pill ---------- */
export function Pill({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return (
    <span className="pill" style={{ color, background: bg }}>
      {children}
    </span>
  );
}

/* ---------- Modal / drill-down ---------- */
export function Modal({
  open,
  title,
  tag,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  tag?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onClick={(e) => e.stopPropagation()}>
        <header className="modal-h">
          <div>
            <h2>{title}</h2>
            {tag && <p>{tag}</p>}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Tutup">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
