/* WMS-native, library-free chart primitives for the Keuangan overview. Pure SVG,
 * styled by keuanganWms.css (.kwms-* classes) — no dependency on the war-room
 * keuangan.css. Section components import these. */
import type { ReactNode } from "react";

/** Distinct segment colours (brand palette) for donuts/legends. */
export const KPALETTE = [
  "#138a59", // green
  "#1d4373", // navy
  "#d99008", // amber
  "#e0701a", // orange
  "#1aa56c", // green-light
  "#46566e", // slate
  "#9a1f2b", // crisis
  "#7a899f", // slate-light
];

export interface KSlice {
  label: string;
  value: number;
  color: string;
}

/** SVG donut with an optional centre label. Track uses the WMS line colour. */
export function KDonut({
  data,
  size = 150,
  thickness = 22,
  center,
  centerSub,
}: {
  data: KSlice[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
  centerSub?: ReactNode;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  let acc = 0;
  return (
    <div className="kwms-donut-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--wms-line)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const seg = (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${cx} ${cx})`}
            >
              <title>{`${d.label}: ${Math.round((d.value / total) * 100)}%`}</title>
            </circle>
          );
          acc += len;
          return seg;
        })}
      </svg>
      {(center != null || centerSub != null) && (
        <div className="kwms-donut-c">
          <span className="dc-main">{center}</span>
          {centerSub != null && <span className="dc-sub">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

/** Coloured-dot legend with value + percentage per row. */
export function KLegend({ data, total, fmt }: { data: KSlice[]; total: number; fmt?: (v: number) => string }) {
  const t = total || 1;
  return (
    <div className="kwms-legend">
      {data.map((d, i) => (
        <div className="kwms-lg" key={i}>
          <span className="kwms-lg-dot" style={{ background: d.color }} />
          <span className="kwms-lg-name">{d.label}</span>
          <span className="kwms-lg-val">{fmt ? fmt(d.value) : d.value}</span>
          <span className="kwms-lg-pct">{Math.round((d.value / t) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/** 270° radial gauge (0–100%) with the figure in the centre and a label below. */
export function KGauge({
  value,
  size = 128,
  thickness = 12,
  color = "var(--wms-green)",
  label,
  sub,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: ReactNode;
  sub?: ReactNode;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(100, safe));
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const arc = (270 / 360) * circ;
  const filled = (pct / 100) * arc;
  return (
    <div className="kwms-gauge">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--wms-line)" strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${arc} ${circ}`} transform={`rotate(135 ${cx} ${cx})`} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} transform={`rotate(135 ${cx} ${cx})`} />
        <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central" className="g-val">{Math.round(safe)}%</text>
        {sub != null && <text x={cx} y={cx + 18} textAnchor="middle" className="g-cap">{sub}</text>}
      </svg>
      {label != null && <span className="g-label">{label}</span>}
    </div>
  );
}

export interface KLinePoint {
  label: string;
  a: number; // primary series (solid)
  b: number; // secondary series (dashed)
}

/** Dual-series responsive line chart (a = solid green, b = dashed red). */
export function KDualLine({ points, height = 160 }: { points: KLinePoint[]; height?: number }) {
  const W = 320;
  const H = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 20;
  const pts = points.length ? points : [{ label: "", a: 0, b: 0 }];
  const max = Math.max(...pts.map((p) => Math.max(p.a, p.b)), 1);
  const stepX = pts.length > 1 ? (W - padX * 2) / (pts.length - 1) : 0;
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - v / max);
  const path = (key: "a" | "b") => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const gridYs = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg className="kwms-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" style={{ height }}>
      {gridYs.map((g, i) => {
        const yy = padTop + (H - padTop - padBottom) * g;
        return <line key={i} className="grid-l" x1={padX} y1={yy} x2={W - padX} y2={yy} />;
      })}
      <path className="ln-b" d={path("b")} vectorEffect="non-scaling-stroke" />
      <path className="ln-a" d={path("a")} vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => <circle key={i} className="dot-a" cx={x(i)} cy={y(p.a)} r={2.5} />)}
      {pts.map((p, i) => (
        <text key={i} className="axis-t" x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}>
          {p.label}
        </text>
      ))}
    </svg>
  );
}
