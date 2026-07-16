import type { BankFin } from "../../types";
import { rp } from "../../lib/status";
import { KDonut, KLegend, KPALETTE } from "../kchart";

/** WMS-native plafond KPR breakdown per bank (top 7). */
export function BankWms({ banks }: { banks: BankFin[] }) {
  const top = banks.slice(0, 7);
  const slices = top.map((b, i) => ({ label: b.name, value: b.plafon, color: KPALETTE[i % KPALETTE.length] }));
  const total = top.reduce((a, b) => a + b.plafon, 0);
  return (
    <div className="wms-card wms-col-4">
      <div className="wms-card-h">
        <h3>Plafond KPR per Bank</h3>
        <span className="kwms-cap">{banks.length} bank</span>
      </div>
      {banks.length === 0 ? (
        <div className="wms-empty">Belum ada akad KPR.</div>
      ) : (
        <div className="kwms-chartrow">
          <KDonut data={slices} size={148} thickness={22} center={rp(total)} centerSub="Plafon" />
          <KLegend data={slices} total={total} fmt={(v) => rp(v)} />
        </div>
      )}
    </div>
  );
}
