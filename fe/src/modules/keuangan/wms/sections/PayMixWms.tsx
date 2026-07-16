import type { PayMethod } from "../../types";
import { KDonut, KLegend } from "../kchart";

const num = (n: number) => (Number(n) || 0).toLocaleString("id-ID");

/** Segment colour for each payment scheme, matching the war-room legend. */
const PAYMIX_COLOR = (t: string) =>
  t === "KPR" ? "#138a59" : t === "Cash Keras" ? "#d99008" : t === "Cash Bertahap" ? "#e0701a" : "#1d4373";

/** WMS-native payment-scheme mix (KPR / Cash Keras / Cash Bertahap). */
export function PayMixWms({ payMix }: { payMix: PayMethod[] }) {
  const slices = payMix.map((p) => ({ label: p.type, value: p.count, color: PAYMIX_COLOR(p.type) }));
  const total = payMix.reduce((a, p) => a + p.count, 0) || 1;
  return (
    <div className="wms-card wms-col-3">
      <div className="wms-card-h">
        <h3>Skema Pembayaran</h3>
        <span className="kwms-cap">{num(total)} akad</span>
      </div>
      {payMix.length === 0 ? (
        <div className="wms-empty">Belum ada data.</div>
      ) : (
        <div className="kwms-chartrow">
          <KDonut data={slices} size={140} thickness={22} center={num(total)} centerSub="Akad" />
          <KLegend data={slices} total={total} fmt={(v) => num(v)} />
        </div>
      )}
    </div>
  );
}
