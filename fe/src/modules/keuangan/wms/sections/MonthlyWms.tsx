import type { MonthPoint } from "../../types";
import { KDualLine } from "../kchart";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-01" → "Jan" (mirrors the month labelling used by CashflowChart). */
function monthLabel(period: string): string {
  const m = Number(period.split("-")[1]);
  return MONTHS[m] || period;
}

/** WMS-native monthly akad trend: nilai (solid) vs DP (dashed), Rp miliar. */
export function MonthlyWms({ monthly }: { monthly: MonthPoint[] }) {
  return (
    <div className="wms-card wms-col-5">
      <div className="wms-card-h">
        <h3>Akad per Bulan</h3>
        <span className="kwms-cap">nilai (—) vs DP (- -), Rp miliar</span>
      </div>
      {monthly.length === 0 ? (
        <div className="wms-empty">Belum ada data bulanan.</div>
      ) : (
        <KDualLine points={monthly.map((m) => ({ label: monthLabel(m.period), a: m.nilai, b: m.dp }))} />
      )}
    </div>
  );
}
