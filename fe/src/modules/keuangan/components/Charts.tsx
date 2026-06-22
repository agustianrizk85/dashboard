import type { ReactNode } from "react";

/** Distinct segment colours for donut/pie charts, drawn from the brand palette. */
export const CHART_PALETTE = [
  "#138a59", // green
  "#1d4373", // navy
  "#d99008", // amber
  "#e0701a", // orange
  "#1aa56c", // green-light
  "#46566e", // slate
  "#9a1f2b", // crisis
  "#7a899f", // ink-3
];

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * SVG donut (or full pie) chart. Each slice is a stroked arc on a single circle
 * via stroke-dasharray, so it stays crisp at any size and needs no library.
 * In `pie` mode the stroke spans the full radius, removing the centre hole.
 */
export function DonutChart({
  data,
  size = 150,
  thickness = 24,
  pie = false,
  center,
  centerSub,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  pie?: boolean;
  center?: ReactNode;
  centerSub?: ReactNode;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const stroke = pie ? size / 2 : thickness;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  let acc = 0;

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="donut">
        {!pie && <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />}
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
              strokeWidth={stroke}
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
      {!pie && (center != null || centerSub != null) && (
        <div className="donut-center">
          <span className="dc-main">{center}</span>
          {centerSub != null && <span className="dc-sub">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

/** Coloured-dot legend for a donut/pie, with value + percentage per row. */
export function ChartLegend({
  data,
  total,
  fmt,
}: {
  data: DonutSlice[];
  total: number;
  fmt?: (v: number) => string;
}) {
  const t = total || 1;
  return (
    <div className="cl">
      {data.map((d, i) => (
        <div className="cl-item" key={i}>
          <span className="cl-dot" style={{ background: d.color }} />
          <span className="cl-name">{d.label}</span>
          {fmt && <span className="cl-val">{fmt(d.value)}</span>}
          <span className="cl-pct">{Math.round((d.value / t) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Radial gauge — a 270° arc (opening at the bottom) showing a 0–100% value with
 * the figure in the centre. Fill is clamped to the arc; the printed value is not.
 */
export function RadialGauge({
  value,
  size = 124,
  thickness = 11,
  color = "var(--green-600)",
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
  const sweep = 270;
  const arc = (sweep / 360) * circ;
  const filled = (pct / 100) * arc;

  return (
    <div className="gauge">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          transform={`rotate(135 ${cx} ${cx})`}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform={`rotate(135 ${cx} ${cx})`}
        />
        <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central" className="gauge-val">
          {Math.round(safe)}%
        </text>
        {sub != null && (
          <text x={cx} y={cx + 18} textAnchor="middle" className="gauge-cap">
            {sub}
          </text>
        )}
      </svg>
      {label != null && <span className="gauge-label">{label}</span>}
    </div>
  );
}
