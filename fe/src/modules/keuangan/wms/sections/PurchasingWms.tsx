import type { Purchasing } from "../../types";
import { rp } from "../../lib/status";

/** WMS-native "Pengadaan & Hutang Pemasok" card. Mirrors PurchasingPanel. */
export function PurchasingWms({ pur }: { pur: Purchasing }) {
  const s = pur.summary;
  const empty = !s.poCount && !s.invoiceCount && !s.paymentCount;
  const suppliers = pur.bySupplier.slice(0, 6);
  return (
    <div className="wms-card wms-col-4">
      <div className="wms-card-h">
        <h3>Pengadaan &amp; Hutang Pemasok</h3>
        <span className="kwms-cap">{empty ? "belum ada data" : `${s.poCount} PO · ${s.supplierCount} pemasok`}</span>
      </div>
      {empty ? (
        <div className="wms-empty">Belum ada data pembelian — sync sheet 'Pembelian (PR)'.</div>
      ) : (
        <>
          <div className="kwms-tiles" style={{ marginBottom: 12 }}>
            <div className="kwms-tile"><div className="t-label">Nilai PO</div><div className="t-val">{rp(s.poValue)}</div></div>
            <div className="kwms-tile"><div className="t-label">Faktur</div><div className="t-val">{rp(s.invoiceValue)}</div></div>
            <div className="kwms-tile ok"><div className="t-label">Dibayar</div><div className="t-val">{rp(s.paidValue)}</div></div>
            <div className={"kwms-tile " + (s.outstanding > 0 ? "bad" : "ok")}><div className="t-label">Hutang</div><div className="t-val">{rp(s.outstanding)}</div></div>
          </div>
          {suppliers.length > 0 && (
            <div className="kwms-list">
              {suppliers.map((sup, i) => (
                <div className="kwms-li" key={sup.name + i}>
                  <span className="kwms-li-rank">{i + 1}</span>
                  <div className="kwms-li-main">
                    <span className="kwms-li-name">{sup.name}</span>
                    <span className="kwms-li-sub">
                      {sup.outstanding > 0 ? (
                        <span className="wms-badge warn">Hutang {rp(sup.outstanding)}</span>
                      ) : (
                        <span className="wms-badge grey">Lunas</span>
                      )}
                    </span>
                  </div>
                  <span className="kwms-li-val">{rp(sup.poValue)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
