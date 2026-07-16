import type { ReactNode } from "react";
import { useId } from "react";

/** Smooth area sparkline in the Greenpark green theme (inline SVG, responsive
 *  via viewBox). `data` is any numeric series; it is auto-scaled. */
export function AreaSpark({ data, height = 96, labels }: { data: number[]; height?: number; labels?: string[] }) {
  const id = useId().replace(/:/g, "");
  const W = 300;
  const H = height;
  const pad = labels ? 16 : 6;
  const pts = data.length ? data : [0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const stepX = pts.length > 1 ? W / (pts.length - 1) : W;
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / span);
  const coords = pts.map((v, i) => [i * stepX, y(v)] as const);

  // Smooth Catmull-Rom-ish path.
  let d = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L ${W},${H} L 0,${H} Z`;

  return (
    <svg className="wms-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#15823f" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#15823f" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${id})`} />
      <path d={d} fill="none" stroke="#15823f" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {labels && (
        <g>
          {labels.map((l, i) => (
            <text key={i} className="axis" x={i * stepX} y={H - 3} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}>
              {l}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

/** KPI + area-chart card (title · chart · big value · delta · subtitle). */
export function StatCard({
  title,
  value,
  data,
  labels,
  delta,
  deltaUp = true,
  subtitle,
  className = "wms-col-4",
}: {
  title: string;
  value: ReactNode;
  data?: number[];
  labels?: string[];
  delta?: string;
  deltaUp?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`wms-card ${className}`}>
      <div className="wms-card-h">
        <h3>{title}</h3>
      </div>
      {data && <AreaSpark data={data} labels={labels} />}
      <div className="wms-stat-val">
        {value}
        {delta && <span className={`wms-delta ${deltaUp ? "up" : "down"}`}>{deltaUp ? "▲" : "▼"} {delta}</span>}
      </div>
      {subtitle && <div className="wms-card-sub">{subtitle}</div>}
    </div>
  );
}

export type WmsNotiTone = "green" | "warn" | "danger";
export function NotificationItem({
  type,
  time,
  message,
  tone = "green",
  onGo,
}: {
  type: string;
  time: string;
  message: string;
  tone?: WmsNotiTone;
  onGo?: () => void;
}) {
  return (
    <div className={`wms-noti ${tone === "green" ? "" : tone}`}>
      <div className="wms-noti-body">
        <div className="wms-noti-top">
          <span className="wms-noti-type">{type}</span>
          <span className="wms-noti-time">{time}</span>
        </div>
        <div className="wms-noti-msg">{message}</div>
      </div>
      <button className="wms-noti-go" onClick={onGo} type="button" aria-label="Buka">
        →
      </button>
    </div>
  );
}

/** Search input + optional filter pills, meant for the WmsShell `toolbar` slot. */
export function WmsSearch({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="wms-search">
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
