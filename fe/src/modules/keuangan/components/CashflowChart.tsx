import type { MonthPoint } from "../types";

/**
 * Monthly akad trend: closed-akad value (Plafon KPR, solid) vs down payment
 * collected (DP, dashed) per month. Values in Rp juta; gridlines in miliar.
 */
export function MonthlyChart({ monthly }: { monthly: MonthPoint[] }) {
  const W = 560;
  const H = 240;
  const pad = { l: 38, r: 14, t: 14, b: 24 };
  const n = monthly.length;
  const nilai = monthly.map((p) => p.nilai);
  const dp = monthly.map((p) => p.dp);
  const maxY = Math.max(1, ...nilai, ...dp);

  const x = (i: number) => pad.l + (n > 1 ? i / (n - 1) : 0) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const poly = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxY));

  if (n === 0) return <div className="empty-mini">Belum ada data akad bulanan.</div>;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-mono)">
            {(t / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}
          </text>
        </g>
      ))}
      {monthly.map((p, i) => (
        <text key={p.period + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-mono)">
          {p.period}
        </text>
      ))}
      <polyline points={poly(dp)} fill="none" stroke="var(--bad)" strokeWidth={2} strokeDasharray="4 4" />
      <polyline points={poly(nilai)} fill="none" stroke="var(--green-600)" strokeWidth={2.5} />
      {nilai.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--green-600)" />
      ))}
    </svg>
  );
}
