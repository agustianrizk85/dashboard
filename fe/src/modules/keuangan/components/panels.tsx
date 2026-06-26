import type {
  AIInsight,
  Alert,
  BankFin,
  Decision,
  MonthPoint,
  PayMethod,
  PipelineRow,
  ProjectFin,
  Purchasing,
  SalesRank,
  Summary,
} from "../types";
import { rp, toneClass } from "../lib/status";
import { Kpi, Panel, Pill, Stat } from "./ui";
import type { CardInfo } from "./ui";
import { MonthlyChart } from "./CashflowChart";
import { ChartLegend, CHART_PALETTE, DonutChart, RadialGauge } from "./Charts";

const num = (n: number) => (Number(n) || 0).toLocaleString("id-ID");

/* ---- Card tooltips: where each card's data comes from + the business
 *      process it represents (shown via the ⓘ marker on every card). ------ */
const INFO: Record<string, CardInfo> = {
  nilaiAkad: {
    source: "Total plafon KPR dari semua transaksi berstatus AKAD pada sheet 'Rekap Penjualan & Akad', ditarik backend keuangan (:8084).",
    process: "Akad = penandatanganan kredit/serah terima unit. Plafon = total pembiayaan yang sudah resmi akad.",
  },
  cashIn: {
    source: "Akumulasi kolom DP (uang muka) dari data booking/akad di sheet.",
    process: "DP dibayar konsumen saat booking → kas masuk perusahaan sebelum pencairan KPR.",
  },
  akad: {
    source: "Jumlah unit berstatus AKAD vs target akad tahun fokus (config backend).",
    process: "Pencapaian penjualan final (akad) terhadap target tahun berjalan.",
  },
  booking: {
    source: "Jumlah booking yang masih berjalan (belum akad & belum batal); nilainya ≈ potensi pipeline.",
    process: "Booking = konsumen pesan unit + bayar DP, menunggu proses KPR hingga akad.",
  },
  cancel: {
    source: "Persentase booking berstatus batal terhadap total booking.",
    process: "Mengukur kebocoran funnel — booking yang gagal lanjut ke akad.",
  },
  kprShare: {
    source: "Porsi akad berskema KPR (vs cash) + jumlah bank penyalur, dari kolom cara bayar.",
    process: "Seberapa besar penjualan dibiayai bank KPR.",
  },
  monthly: {
    source: "Data akad diagregasi per bulan akad (nilai plafon & cash-in DP) dari sheet.",
    process: "Memantau laju akad dan DP bulanan untuk melihat tren & musiman.",
  },
  project: {
    source: "Transaksi akad/booking dikelompokkan per proyek (kode GP) dari sheet.",
    process: "Membandingkan performa penjualan & akad antar proyek perumahan.",
  },
  bank: {
    source: "Akad berskema KPR dikelompokkan per bank penyalur (kolom bank).",
    process: "Melihat konsentrasi pembiayaan & ketergantungan pada tiap bank mitra.",
  },
  sales: {
    source: "Nilai & jumlah akad dikelompokkan per sales/agent dari kolom sales pada sheet.",
    process: "Ranking kontribusi tiap sales/agent terhadap akad.",
  },
  payMix: {
    source: "Komposisi cara bayar (KPR / Cash Keras / Cash Bertahap) dari data akad.",
    process: "Bauran metode pembayaran konsumen — dasar proyeksi kas & risiko.",
  },
  pipeline: {
    source: "Booking aktif beserta tahap & kendala (berkas, proses bank, dll.) dari sheet; SLA dihitung backend.",
    process: "Deteksi dini booking yang macet menuju akad agar bisa segera ditindak.",
  },
  alert: {
    source: "Peringatan otomatis dari ambang/threshold yang dihitung backend atas data dashboard.",
    process: "Notifikasi kondisi keuangan yang perlu tindakan (mis. rasio batal tinggi).",
  },
  ai: {
    source: "Insight & rekomendasi yang dihasilkan backend dari ringkasan data keuangan.",
    process: "Ringkasan war-room sebagai bahan pengambilan keputusan per peran.",
  },
  achievement: {
    source: "Dihitung backend dari data akad di sheet: jumlah akad vs target tahun fokus, serta porsi akad berskema KPR.",
    process: "Ukuran pencapaian penjualan final (akad) terhadap target & seberapa besar penjualan dibiayai KPR.",
  },
  purchasing: {
    source: "Spreadsheet 'Pembelian (PR)' — tab Pesanan Pembelian (PO), Faktur Pembelian, & Pembayaran Pembelian — ditarik backend keuangan (:8084) saat sync.",
    process: "Pengadaan material/jasa: PO dipesan → faktur diterima → dibayar. Hutang = sisa terutang faktur yang belum lunas.",
  },
};

/** Segment colour for each payment scheme, matching the war-room legend. */
const PAYMIX_COLOR = (t: string) =>
  t === "KPR" ? "#138a59" : t === "Cash Keras" ? "#d99008" : t === "Cash Bertahap" ? "#e0701a" : "#1d4373";

/** Compact empty placeholder for a panel with no data yet. */
function Empty({ label }: { label: string }) {
  return <div className="empty-mini">{label}</div>;
}

/* ---- Top scorecard ---------------------------------------------------- */
export function KpiRow({ s }: { s: Summary }) {
  const cancelTone = s.cancelRate > 20 ? "bad" : s.cancelRate > 10 ? "warn" : "ok";
  const achTone = s.achievement >= 95 ? "ok" : s.achievement >= 80 ? "warn" : "bad";
  return (
    <div className="kpi-row">
      <Kpi label="Nilai Akad (Plafon)" value={rp(s.nilaiAkad)} tone="ok" info={INFO.nilaiAkad} />
      <Kpi label="Cash-in DP" value={rp(s.cashIn)} info={INFO.cashIn} />
      <Kpi label="Akad" value={num(s.akadCount)} unit={s.targetAkad ? `/ ${num(s.targetAkad)}` : ""} tone={achTone} delta={s.targetAkad ? `${s.achievement}%` : undefined} info={INFO.akad} />
      <Kpi label="Booking Aktif" value={num(s.bookingCount)} unit={`≈ ${rp(s.pipelineValue)}`} tone="warn" info={INFO.booking} />
      <Kpi label="Rasio Batal" value={`${s.cancelRate}%`} tone={cancelTone} info={INFO.cancel} />
      <Kpi label="KPR Share" value={`${s.kprShare}%`} unit={`${s.bankCount} bank`} info={INFO.kprShare} />
    </div>
  );
}

/* ---- Achievement & composition (radial gauges) ------------------------ */
export function AchievementPanel({ s, onExpand }: { s: Summary; onExpand?: () => void }) {
  return (
    <Panel tag="PENCAPAIAN" title="Pencapaian & Komposisi" sub="akad vs target" info={INFO.achievement} onExpand={onExpand}>
      <div className="ach-body">
        <div className="gauge-grid">
          <RadialGauge
            value={s.achievement}
            color="var(--green-600)"
            label="Pencapaian Akad"
            sub={s.targetAkad ? `${num(s.akadCount)} / ${num(s.targetAkad)}` : `${num(s.akadCount)} akad`}
          />
          <RadialGauge value={s.kprShare} color="var(--navy-600)" label="Porsi KPR" sub={`${s.bankCount} bank`} />
        </div>
        <div className="ach-stats">
          <Stat label="Akad" value={num(s.akadCount)} tone="ok" />
          <Stat label="Booking" value={num(s.bookingCount)} tone="warn" />
          <Stat label="Batal" value={num(s.batalCount)} tone={s.batalCount > 0 ? "bad" : "ok"} />
        </div>
      </div>
    </Panel>
  );
}

/* ---- Monthly akad trend ---------------------------------------------- */
export function MonthlyPanel({ monthly, onExpand }: { monthly: MonthPoint[]; onExpand?: () => void }) {
  return (
    <Panel tag="TREN" title="Akad per Bulan" sub="nilai (—) vs DP (- -), Rp miliar" info={INFO.monthly} onExpand={onExpand}>
      <MonthlyChart monthly={monthly} />
    </Panel>
  );
}

/* ---- Projects --------------------------------------------------------- */
export function ProjectPanel({
  projects,
  onExpand,
  onRow,
}: {
  projects: ProjectFin[];
  onExpand?: () => void;
  onRow?: (p: ProjectFin) => void;
}) {
  return (
    <Panel tag="PROYEK" title="Akad per Proyek" sub={`${projects.length} proyek`} info={INFO.project} onExpand={onExpand}>
      {projects.length === 0 ? (
        <Empty label="Belum ada data proyek." />
      ) : (
        <div className="rows">
          {projects.slice(0, 7).map((p) => (
            <button className="row click" key={p.code} onClick={() => onRow?.(p)}>
              <span className="row-name">{p.name}</span>
              <span className="row-sub">{p.akad} akad · {p.kprPct}% KPR</span>
              <span className="row-val">{rp(p.nilai)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Banks (Pendanaan) ------------------------------------------------ */
export function BankPanel({ banks, onExpand }: { banks: BankFin[]; onExpand?: () => void }) {
  const top = banks.slice(0, 7);
  const slices = top.map((b, i) => ({ label: b.name, value: b.plafon, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  const totalPlafon = top.reduce((a, b) => a + b.plafon, 0);
  return (
    <Panel tag="PENDANAAN" title="Plafond KPR per Bank" sub={`${banks.length} bank`} info={INFO.bank} onExpand={onExpand}>
      {banks.length === 0 ? (
        <Empty label="Belum ada akad KPR." />
      ) : (
        <div className="chart-row">
          <DonutChart data={slices} size={148} thickness={24} center={rp(totalPlafon)} centerSub="Plafon" />
          <ChartLegend data={slices} total={totalPlafon} fmt={(v) => rp(v)} />
        </div>
      )}
    </Panel>
  );
}

/* ---- Sales ranking ---------------------------------------------------- */
export function SalesPanel({ sales, onExpand }: { sales: SalesRank[]; onExpand?: () => void }) {
  return (
    <Panel tag="SALES" title="Kontribusi Akad — Sales" sub={`${sales.length} kontributor`} info={INFO.sales} onExpand={onExpand}>
      {sales.length === 0 ? (
        <Empty label="Belum ada data sales." />
      ) : (
        <div className="rows">
          {sales.slice(0, 7).map((s, i) => (
            <div className="row" key={s.name + i}>
              <span className="row-rank">{i + 1}</span>
              <span className="row-name">
                {s.name} {s.isAgent && <Pill tone="orange" dot={false}>Agent</Pill>}
              </span>
              <span className="row-sub">{s.akad} akad</span>
              <span className="row-val">{rp(s.nilai)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Payment mix ------------------------------------------------------ */
export function PayMixPanel({ payMix, onExpand }: { payMix: PayMethod[]; onExpand?: () => void }) {
  const total = payMix.reduce((a, p) => a + p.count, 0) || 1;
  const slices = payMix.map((p) => ({ label: p.type, value: p.count, color: PAYMIX_COLOR(p.type) }));
  return (
    <Panel tag="CARA BAYAR" title="Skema Pembayaran" sub={`${num(total)} akad`} info={INFO.payMix} onExpand={onExpand}>
      {payMix.length === 0 ? (
        <Empty label="Belum ada data." />
      ) : (
        <div className="chart-row">
          <DonutChart data={slices} size={148} thickness={24} center={num(total)} centerSub="Akad" />
          <ChartLegend data={slices} total={total} fmt={(v) => num(v)} />
        </div>
      )}
    </Panel>
  );
}

/* ---- Pipeline early-warning ------------------------------------------ */
const SLA_TONE = { overdue: "red", due: "yellow", ok: "green" } as const;

export function PipelinePanel({ pipeline, onExpand }: { pipeline: PipelineRow[]; onExpand?: () => void }) {
  pipeline = pipeline ?? [];
  const flagged = pipeline.filter((r) => r.kendala).length;
  return (
    <Panel tag="EARLY WARNING" title="Pipeline Tertahan" sub={`${flagged} berkendala`} accent="var(--bad)" info={INFO.pipeline} onExpand={onExpand}>
      {pipeline.length === 0 ? (
        <Empty label="Tidak ada booking aktif tertahan." />
      ) : (
        <div className="rows">
          {pipeline.slice(0, 7).map((r, i) => (
            <div className="row" key={r.customer + i}>
              <Pill tone={SLA_TONE[r.sla]} dot>{r.stage}</Pill>
              <span className="row-name">{r.customer}</span>
              <span className="row-sub">{r.project} · {r.bank || r.caraBayar}</span>
              <span className="row-note">{r.kendala || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- AI + decisions --------------------------------------------------- */
export function AiDecisionPanel({
  insights,
  decisions,
  onExpand,
}: {
  insights: AIInsight[];
  decisions: Decision[];
  onExpand?: () => void;
}) {
  return (
    <Panel tag="AI" title="AI Insight & Keputusan" sub="war-room" info={INFO.ai} onExpand={onExpand}>
      <div className="ai-list">
        {insights.slice(0, 4).map((a, i) => (
          <div className="ai-item" key={i}>
            <Pill tone={toneClass(a.tone)} dot>{a.type}</Pill>
            <span className="ai-text">{a.text}</span>
          </div>
        ))}
      </div>
      {decisions.length > 0 && (
        <div className="dec-list">
          {decisions.slice(0, 4).map((d, i) => (
            <div className="dec-item" key={i}>
              <span className="dec-role">{d.role}</span>
              <span className="dec-text">{d.text}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---- Alerts ----------------------------------------------------------- */
export function AlertPanel({ alerts, onExpand }: { alerts: Alert[]; onExpand?: () => void }) {
  return (
    <Panel tag="ALERT" title="Alarm Keuangan" sub={`${alerts.length}`} accent="var(--bad)" info={INFO.alert} onExpand={onExpand}>
      <div className="alert-list">
        {alerts.map((a, i) => (
          <div className={`alert-item ${a.tone}`} key={i}>
            <div className="alert-h">
              <Pill tone={toneClass(a.tone)} dot>{a.title}</Pill>
            </div>
            <div className="alert-detail">{a.detail}</div>
            <div className="alert-action">→ {a.action}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---- Procurement (PR / Pembelian) ------------------------------------- */
export function PurchasingPanel({ pur, onExpand }: { pur: Purchasing; onExpand?: () => void }) {
  const s = pur.summary;
  const empty = !s.poCount && !s.invoiceCount && !s.paymentCount;
  const suppliers = pur.bySupplier.slice(0, 6);
  return (
    <Panel
      tag="PEMBELIAN (PR)"
      title="Pengadaan & Hutang Pemasok"
      sub={empty ? "belum ada data" : `${s.poCount} PO · ${s.supplierCount} pemasok`}
      accent="var(--navy-600)"
      info={INFO.purchasing}
      onExpand={onExpand}
    >
      {empty ? (
        <Empty label="Belum ada data pembelian — sync sheet 'Pembelian (PR)'." />
      ) : (
        <>
          <div className="ach-stats" style={{ marginBottom: 10 }}>
            <Stat label="Nilai PO" value={rp(s.poValue)} />
            <Stat label="Faktur" value={rp(s.invoiceValue)} />
            <Stat label="Dibayar" value={rp(s.paidValue)} tone="ok" />
            <Stat label="Hutang" value={rp(s.outstanding)} tone={s.outstanding > 0 ? "bad" : "ok"} />
          </div>
          {suppliers.length > 0 && (
            <div className="rows">
              {suppliers.map((sup, i) => (
                <div className="row" key={sup.name + i}>
                  <span className="row-rank">{i + 1}</span>
                  <span className="row-name">{sup.name}</span>
                  <span className="row-sub">
                    {sup.outstanding > 0 ? (
                      <Pill tone="orange" dot={false}>Hutang {rp(sup.outstanding)}</Pill>
                    ) : (
                      <Pill tone="green" dot={false}>Lunas</Pill>
                    )}
                  </span>
                  <span className="row-val">{rp(sup.poValue)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* Re-export Stat for focus views. */
export { Stat };
