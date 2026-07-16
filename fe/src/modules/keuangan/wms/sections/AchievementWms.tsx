/* WMS-native achievement & composition card — mirrors AchievementPanel from
 * components/panels.tsx. Two radial gauges (akad vs target, porsi KPR) plus a
 * three-tile summary strip. */
import type { Summary } from "../../types";
import { KGauge } from "../kchart";

const num = (n: number) => (Number(n) || 0).toLocaleString("id-ID");

export function AchievementWms({ s }: { s: Summary }) {
  return (
    <div className="wms-card wms-col-4">
      <div className="wms-card-h">
        <h3>Pencapaian &amp; Komposisi</h3>
        <span className="kwms-cap">akad vs target</span>
      </div>
      <div className="kwms-gauges">
        <KGauge
          value={s.achievement}
          color="var(--wms-green)"
          label="Pencapaian Akad"
          sub={s.targetAkad ? `${num(s.akadCount)} / ${num(s.targetAkad)}` : `${num(s.akadCount)} akad`}
        />
        <KGauge value={s.kprShare} color="#1d4373" label="Porsi KPR" sub={`${s.bankCount} bank`} />
      </div>
      <div className="kwms-tiles" style={{ marginTop: 14 }}>
        <div className="kwms-tile ok">
          <div className="t-label">Akad</div>
          <div className="t-val">{num(s.akadCount)}</div>
        </div>
        <div className="kwms-tile warn">
          <div className="t-label">Booking</div>
          <div className="t-val">{num(s.bookingCount)}</div>
        </div>
        <div className={"kwms-tile " + (s.batalCount > 0 ? "bad" : "ok")}>
          <div className="t-label">Batal</div>
          <div className="t-val">{num(s.batalCount)}</div>
        </div>
      </div>
    </div>
  );
}
