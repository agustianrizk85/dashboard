import type { SalesRank } from "../../types";
import { rp } from "../../lib/status";

/** WMS-native "Kontribusi Akad — Sales" ranking card. Mirrors SalesPanel. */
export function SalesWms({ sales }: { sales: SalesRank[] }) {
  return (
    <div className="wms-card wms-col-5">
      <div className="wms-card-h">
        <h3>Kontribusi Akad — Sales</h3>
        <span className="kwms-cap">{sales.length} kontributor</span>
      </div>
      {sales.length === 0 ? (
        <div className="wms-empty">Belum ada data sales.</div>
      ) : (
        <div className="kwms-list">
          {sales.slice(0, 7).map((s, i) => (
            <div className="kwms-li" key={s.name + i}>
              <span className="kwms-li-rank">{i + 1}</span>
              <div className="kwms-li-main">
                <span className="kwms-li-name">
                  {s.name} {s.isAgent && <span className="wms-badge grey">Agent</span>}
                </span>
                <span className="kwms-li-sub">{s.akad} akad</span>
              </div>
              <span className="kwms-li-val">{rp(s.nilai)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
