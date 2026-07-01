import { useEffect, useMemo, useState } from "react";
import { metaApi, META_RANGES, waRealtimeURL, igRealtimeURL } from "./metaApi";
import type { MetaAds, MetaWa, MetaIg, MetaAdsDetail, MetaBreakdownRow, MetaDailyRow, MetaRange, MetaCampaign, MetaCampaignDetail, MetaCreative, IGConversation, IGMessage, WAConversation, WAMessage } from "./metaApi";
import "./meta.css";

/* ---------- helpers ---------- */
const nf = new Intl.NumberFormat("id-ID");
const num = (n: unknown) => nf.format(Math.round(Number(n) || 0));
function rp(n: unknown): string {
  const v = Number(n) || 0;
  if (v >= 1e9) return "Rp " + (v / 1e9).toFixed(2).replace(".", ",") + " M";
  if (v >= 1e6) return "Rp " + (v / 1e6).toFixed(1).replace(".", ",") + " jt";
  if (v >= 1e3) return "Rp " + Math.round(v / 1e3) + " rb";
  return "Rp " + num(v);
}
const s = (v: unknown) => (v == null ? "" : String(v));

function useMeta<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    setErr("");
    fn().then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false));
  };
  useEffect(reload, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, loading, reload };
}

function Shell({ loading, err, reload, notConfigured, children }: { loading: boolean; err: string; reload: () => void; notConfigured?: boolean; children: React.ReactNode }) {
  if (loading) return <div className="meta-state">Memuat data Meta…</div>;
  if (err) return <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>;
  if (notConfigured)
    return (
      <div className="meta-state">
        Belum ada akun Meta yang terhubung. Buka tab <b>Akun Meta</b> lalu klik <b>“Hubungkan Akun”</b> untuk login lewat
        Facebook (OAuth, mendukung banyak akun).
      </div>
    );
  return <>{children}</>;
}

function Head({ title, tag, right }: { title: string; tag: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="meta-head">
      <h3>{title}</h3>
      <span className="meta-tag">{tag}</span>
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
    </div>
  );
}

/* ===================== ADS ===================== */
const ACC_STATUS: Record<string, string> = { "1": "Aktif", "2": "Dinonaktifkan", "3": "Tidak terbayar", "7": "Review", "9": "Grace period", "101": "Tutup" };
const stripAct = (id: string) => (id || "").replace(/^act_/, "");
// Link ke Ads Manager sengaja dihapus — semua interaksi tetap di dalam dashboard.

type StatusFilter = "all" | "active" | "inactive";
type SortKey = "spend" | "results" | "cpr" | "ctr" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Spend tertinggi" },
  { key: "results", label: "Hasil terbanyak" },
  { key: "cpr", label: "CPR termurah" },
  { key: "ctr", label: "CTR tertinggi" },
  { key: "name", label: "Nama (A–Z)" },
];
const effStatus = (c: MetaCampaign) => c.effectiveStatus || c.status;
const isActive = (c: MetaCampaign) => effStatus(c) === "ACTIVE";

/* Guardrail thresholds (Greenpark: KPI utama CPR chat WA). */
const CPR_LIMIT = 60_000; // CPR boros di atas Rp60rb
const FREQ_LIMIT = 3; // fatigue: 1 orang lihat ≥3x
const CTR_FLOOR = 0.7; // CTR rendah < 0,7%
const CTR_MIN_IMPR = 500; // hanya nilai CTR rendah bila tayang cukup

// projectOf menebak kode proyek dari nama campaign (Verua, ZHL, THC, …) dengan
// membuang token noise (HS, Sales, WA, Broad, tanggal, angka). Maintenance-free.
const NOISE = new Set([
  "hs", "sales", "traffic", "traffick", "trafick", "wa", "only", "broad", "behavior",
  "behaviour", "pns", "dm", "re", "swasta", "try", "new", "test", "cbo", "abo", "ads",
]);
function projectOf(name: string): string {
  for (const tk of name.split(/[\s\-_|/]+/).filter(Boolean)) {
    const low = tk.toLowerCase();
    if (NOISE.has(low) || /^\d/.test(tk)) continue;
    const clean = tk.replace(/\d+$/, ""); // ZHL2 → ZHL
    if (clean.length >= 2) return clean.toUpperCase();
  }
  return "LAINNYA";
}

export function AdsView() {
  const [range, setRange] = useState<MetaRange>("30d");
  const rangeLabel = META_RANGES.find((r) => r.key === range)?.label ?? "";
  const { data, err, loading, reload } = useMeta<MetaAds>(() => metaApi.ads(range), [range]);
  const detail = useMeta<MetaAdsDetail>(() => metaApi.adsDetail(range), [range]);
  const dt = detail.data;

  const [acctFilter, setAcctFilter] = useState<string | null>(null);
  const [projFilter, setProjFilter] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [openId, setOpenId] = useState<string | null>(null); // campaign drill-down

  const t = data?.totals;
  const accounts = data?.accounts ?? [];
  const allCamps = useMemo(() => data?.campaigns ?? [], [data]);
  const accIns = (a: Record<string, unknown>) => (a.insights as Record<string, string> | undefined) ?? {};
  const acctName = (id: string) => {
    const a = accounts.find((x) => stripAct(s(x.id)) === id);
    return a ? s(a.name) || s(a.connLabel) || s(a.id) : id;
  };
  const toggleAcct = (id: string) => setAcctFilter((cur) => (cur === id ? null : id));
  const toggleProj = (p: string) => setProjFilter((cur) => (cur === p ? null : p));

  const activeCount = useMemo(() => allCamps.filter(isActive).length, [allCamps]);

  // Pivot per proyek (Verua / ZHL / THC …) dari semua campaign.
  const projects = useMemo(() => {
    const m = new Map<string, { key: string; spend: number; results: number; total: number; active: number }>();
    for (const c of allCamps) {
      const k = projectOf(c.name);
      const e = m.get(k) ?? { key: k, spend: 0, results: 0, total: 0, active: 0 };
      e.spend += c.spend; e.results += c.results; e.total += 1; if (isActive(c)) e.active += 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.spend - a.spend);
  }, [allCamps]);

  // Sinyal kesehatan / guardrail (rule-based, dari data sendiri).
  const signals = useMemo(() => {
    const activeZero = allCamps.filter((c) => isActive(c) && c.spend === 0);
    const issues = allCamps.filter((c) => c.issues > 0 || ["WITH_ISSUES", "DISAPPROVED", "PENDING_REVIEW"].includes(c.effectiveStatus));
    const highCpr = allCamps.filter((c) => c.results > 0 && c.costPerResult > CPR_LIMIT).sort((a, b) => b.costPerResult - a.costPerResult);
    const fatigue = allCamps.filter((c) => c.frequency >= FREQ_LIMIT && c.spend > 0).sort((a, b) => b.frequency - a.frequency);
    const lowCtr = allCamps.filter((c) => c.impressions >= CTR_MIN_IMPR && c.ctr > 0 && c.ctr < CTR_FLOOR).sort((a, b) => a.ctr - b.ctr);
    return { activeZero, issues, highCpr, fatigue, lowCtr };
  }, [allCamps]);

  const camps = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = allCamps.filter((c) => {
      if (acctFilter && c.accountId !== acctFilter) return false;
      if (projFilter && projectOf(c.name) !== projFilter) return false;
      if (status === "active" && !isActive(c)) return false;
      if (status === "inactive" && isActive(c)) return false;
      if (needle && !(`${c.name} ${c.account} ${c.objective}`.toLowerCase().includes(needle))) return false;
      return true;
    });
    out.sort((a, b) => {
      switch (sort) {
        case "results": return b.results - a.results;
        case "ctr": return b.ctr - a.ctr;
        case "name": return a.name.localeCompare(b.name);
        case "cpr": {
          const av = a.results > 0 ? a.costPerResult : Infinity;
          const bv = b.results > 0 ? b.costPerResult : Infinity;
          return av - bv;
        }
        default: return b.spend - a.spend;
      }
    });
    return out;
  }, [allCamps, acctFilter, projFilter, status, q, sort]);

  const filtersOn = !!acctFilter || !!projFilter || status !== "all" || q.trim() !== "";
  const openCamp = (id: string) => () => setOpenId(id);

  return (
    <div className="meta-wrap">
      <Shell loading={loading} err={err} reload={reload} notConfigured={data ? !data.configured : false}>
        {/* ===== Rentang waktu (semua tahun didukung) ===== */}
        <div className="meta-rangebar">
          <span className="meta-rangebar-lbl">Rentang</span>
          {META_RANGES.map((r) => (
            <button key={r.key} className={"meta-seg" + (range === r.key ? " on" : "")} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>

        {/* ===== KPI super-detail (rentang terpilih, semua akun) ===== */}
        {t && (
          <section className="meta-card">
            <Head title={`KPI Performa Iklan — ${rangeLabel}`} tag={`${num(t.accounts)} akun · ${num(t.activeCampaigns)}/${num(t.campaigns)} campaign aktif`} />
            <div style={{ fontSize: 11, lineHeight: 1.7, color: "#6b7280", margin: "0 2px 12px" }}>
              <div><b>Dari mana:</b> ditarik langsung dari <b>Meta Ads (Graph API — Ads Insights)</b> memakai token akun yang ditempel, digabung semua akun &amp; campaign pada rentang <b>{rangeLabel}</b>.</div>
              <div><b>Alur bisnis (funnel iklan):</b> Budget (<i>Spend</i>) → iklan tampil (<i>Impressions</i>) → dilihat orang unik (<i>Reach</i>) → diklik (<i>Clicks</i> = daya tarik lewat <i>CTR</i>) → jadi aksi (<i>Hasil</i>: chat WA / lead). Efisiensi = <i>Cost/Hasil</i>, <i>CPC</i>, <i>CPM</i>. Arahkan kursor ke tiap kotak (ⓘ) untuk artinya.</div>
            </div>
            <div className="meta-tiles">
              <Tile k="Total Spend" v={rp(t.spend)} hint="Total biaya iklan yang keluar pada rentang ini. Sumber: Ads Insights (field 'spend'), dijumlah semua akun & campaign. Makin besar = budget terpakai makin banyak." />
              <Tile k="Hasil (WA/Lead)" v={num(t.results)} hint="Jumlah hasil/konversi sesuai tujuan campaign (mis. mulai chat WhatsApp atau lead form). Sumber: Ads Insights (actions sesuai objective). Ini 'output' bisnis dari iklan." />
              <Tile k="Cost / Hasil" v={rp(t.costPerResult)} hint="Biaya rata-rata per satu hasil = Total Spend ÷ Hasil (CPR). Makin kecil makin efisien. Ambang boros internal: > Rp 60 rb." />
              <Tile k="Konversi (Hasil/Klik)" v={t.conversionRate ? t.conversionRate.toFixed(2) + "%" : "—"} hint="Persentase klik yang berujung jadi hasil = Hasil ÷ Clicks × 100%. Mengukur seberapa nyambung iklan → aksi. Makin tinggi makin bagus." />
              <Tile k="CTR" v={t.ctr ? t.ctr.toFixed(2) + "%" : "—"} hint="Click-Through Rate = Clicks ÷ Impressions × 100%. Ukur daya tarik materi iklan (thumbnail/copy). Sehat umumnya ± 1–2%+." />
              <Tile k="CPC" v={rp(t.cpc)} hint="Cost per Click = Spend ÷ Clicks. Biaya rata-rata mendatangkan satu klik. Makin murah makin efisien menarik trafik." />
              <Tile k="CPM" v={rp(t.cpm)} hint="Cost per Mille = Spend ÷ Impressions × 1000. Biaya per 1.000 tayangan. Ukur mahal/murahnya menjangkau audiens." />
              <Tile k="Jangkauan (Reach)" v={num(t.reach)} hint="Jumlah ORANG UNIK yang melihat iklan. Sumber: Ads Insights (reach). Beda dari Impressions yang bisa menghitung orang sama berkali-kali." />
              <Tile k="Frekuensi" v={t.frequency ? t.frequency.toFixed(2) + "x" : "—"} hint="Rata-rata berapa kali satu orang melihat iklan = Impressions ÷ Reach. Terlalu tinggi (≥ 3x) = iklan membosankan (fatigue)." />
              <Tile k="Impressions" v={num(t.impressions)} hint="Total berapa kali iklan tampil di layar (bisa berulang ke orang sama). Sumber: Ads Insights (impressions)." />
              <Tile k="Clicks" v={num(t.clicks)} hint="Total klik pada iklan pada rentang ini. Sumber: Ads Insights (clicks)." />
              <Tile k="Campaign Aktif" v={`${num(t.activeCampaigns)} / ${num(t.campaigns)}`} hint="Campaign berstatus aktif (tidak di-pause) dibanding total campaign. Sumber: status campaign di Meta." />
              <Tile k="Aktif & Tayang" v={`${num(t.deliveringCampaigns)} / ${num(t.activeCampaigns)}`} hint="Dari campaign aktif, berapa yang benar-benar TAYANG (delivering). Sisanya belum tayang karena budget/jadwal/review Meta." />
              <Tile k="Campaign Bermasalah" v={num(t.issueCampaigns)} hint="Jumlah campaign dengan isu (ditolak, error, limit) yang perlu ditindak. Sumber: effective_status/issues dari Meta." />
              <Tile k="Akun Iklan" v={num(t.accounts)} hint="Jumlah Ad Account yang datanya digabung di sini. Sumber: koneksi token yang ditempel di tab Akun Meta." />
            </div>
          </section>
        )}

        {/* ===== Sinyal kesehatan & guardrail (rule-based) ===== */}
        <HealthPanel signals={signals} onOpen={openCamp} />

        {/* ===== Pivot per proyek (klik → saring) ===== */}
        {projects.length > 0 && (
          <section className="meta-card">
            <Head title="Performa per Proyek" tag={`${projects.length} proyek · klik untuk saring`} />
            <CardNote>
              Dikelompokkan per <b>PROYEK</b> — diambil dari <b>awalan nama campaign</b> (mis. "ZHL 2 - HS 2 Sales…" → proyek <b>ZHL</b>). Menjumlahkan spend &amp; hasil semua campaign proyek pada rentang terpilih. <b>Klik baris</b> untuk menyaring tabel campaign di bawah. CPR = Spend ÷ Hasil (biaya per hasil proyek).
            </CardNote>
            <table className="meta-table meta-table-click">
              <thead><tr>
                <th title="Nama proyek (awalan nama campaign)">Proyek</th>
                <th className="r" title="Jumlah campaign di proyek ini">Campaign</th>
                <th className="r" title="Campaign yang berstatus aktif">Aktif</th>
                <th className="r" title="Total biaya iklan proyek ini">Spend</th>
                <th className="r" title="Total hasil/konversi (chat WA / lead)">Hasil</th>
                <th className="r" title="Cost per Result = Spend ÷ Hasil. Makin kecil makin efisien">CPR</th>
              </tr></thead>
              <tbody>
                {projects.map((p) => {
                  const cpr = p.results > 0 ? p.spend / p.results : 0;
                  return (
                    <tr key={p.key} className={projFilter === p.key ? "meta-row-on" : ""} onClick={() => toggleProj(p.key)} title="Klik untuk menyaring campaign proyek ini">
                      <td><b className="meta-link">{p.key}</b></td>
                      <td className="r mono">{num(p.total)}</td>
                      <td className="r mono">{num(p.active)}</td>
                      <td className="r mono">{rp(p.spend)}</td>
                      <td className="r mono">{p.results ? num(p.results) : "—"}</td>
                      <td className="r mono">{cpr ? rp(cpr) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* ===== Akun iklan (klik nama → saring campaign) ===== */}
        {accounts.length > 0 && (
          <section className="meta-card">
            <Head title="Akun Iklan" tag="klik nama → saring campaign di bawah" />
            <CardNote>
              Tiap baris = satu <b>Ad Account</b> (sumber data mentahnya). Label kecil <b>Gp1/Gp2/Gp3</b> = nama <b>koneksi token</b> yang menariknya (dari tab Akun Meta); <b>act_…</b> = ID akun iklan di Meta. <b>Klik nama akun</b> untuk menyaring campaign akun itu di tabel bawah.
            </CardNote>
            <table className="meta-table">
              <thead><tr>
                <th title="Nama akun iklan + koneksi & ID di bawahnya">Akun</th>
                <th title="Status akun di Meta (Aktif / Dinonaktifkan / dll)">Status</th>
                <th className="r" title="Total biaya iklan akun ini">Spend</th>
                <th className="r" title="Total tayangan iklan (impressions)">Impr.</th>
                <th className="r" title="Total klik">Klik</th>
                <th className="r" title="Click-Through Rate = Klik ÷ Impr. × 100%">CTR</th>
              </tr></thead>
              <tbody>
                {accounts.map((a, i) => {
                  const ai = accIns(a);
                  const aid = stripAct(s(a.id));
                  return (
                    <tr key={i} className={acctFilter === aid ? "meta-row-on" : ""}>
                      <td>
                        <button className="meta-linkbtn" onClick={() => toggleAcct(aid)} title="Klik untuk menyaring campaign akun ini">
                          <b>{s(a.name) || s(a.connLabel) || s(a.id)}</b>
                        </button>
                        <div className="muted" style={{ fontSize: 9 }}>{s(a.connLabel) ? `${s(a.connLabel)} · ` : ""}{s(a.id)}</div>
                      </td>
                      <td><span className={"meta-pill " + (s(a.account_status) === "1" ? "ok" : "neutral")}>{ACC_STATUS[s(a.account_status)] ?? s(a.account_status)}</span></td>
                      <td className="r mono">{rp(ai.spend)}</td>
                      <td className="r mono">{num(ai.impressions)}</td>
                      <td className="r mono">{num(ai.clicks)}</td>
                      <td className="r mono">{ai.ctr ? Number(ai.ctr).toFixed(2) + "%" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* ===== Breakdown per campaign — filter + klik baris untuk detail ===== */}
        <section className="meta-card">
          <Head
            title="Breakdown per Campaign"
            tag={`${camps.length}${filtersOn ? ` / ${allCamps.length}` : ""} campaign · ${activeCount} aktif`}
          />
          <CardNote>
            Rincian tiap campaign (digabung dari semua akun). Sumber: <b>Meta Ads Insights per campaign</b>. Baris kecil di bawah nama = <b>Objektif · Jenis hasil</b> (mis. <i>SALES · Percakapan WA</i>, <i>TRAFFIC · Klik Link</i>). <b>Klik baris</b> → detail campaign (tren harian, demografi, placement, device, top ads). Filter: status, cari nama/objektif, urutkan. Arahkan kursor ke judul kolom untuk artinya.
          </CardNote>

          {/* control bar: status · cari · urutkan */}
          <div className="meta-controls">
            <div className="meta-segs">
              {([["all", "Semua"], ["active", "Aktif saja"], ["inactive", "Non-aktif"]] as [StatusFilter, string][]).map(([k, lbl]) => (
                <button key={k} className={"meta-seg" + (status === k ? " on" : "")} onClick={() => setStatus(k)}>{lbl}</button>
              ))}
            </div>
            <input
              className="meta-search"
              placeholder="Cari campaign / objektif…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="meta-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((sopt) => <option key={sopt.key} value={sopt.key}>{sopt.label}</option>)}
            </select>
            {acctFilter && (
              <button className="meta-linkbtn" onClick={() => setAcctFilter(null)}>✕ Akun: {acctName(acctFilter)}</button>
            )}
            {projFilter && (
              <button className="meta-linkbtn" onClick={() => setProjFilter(null)}>✕ Proyek: {projFilter}</button>
            )}
          </div>

          {camps.length ? (
            <table className="meta-table meta-table-click">
              <thead><tr>
                <th title="Nama campaign + Objektif · Jenis hasil di bawahnya">Campaign</th>
                <th title="Ad Account pemilik campaign (klik untuk saring)">Akun</th>
                <th title="Status tayang efektif dari Meta: ACTIVE / PAUSED / WITH_ISSUES / PENDING_REVIEW / DISAPPROVED">Status</th>
                <th className="r" title="Biaya iklan campaign ini pada rentang terpilih">Spend</th>
                <th className="r" title="Jumlah hasil/konversi sesuai objektif (chat WA / lead)">Hasil</th>
                <th className="r" title="Cost per Result = Spend ÷ Hasil. Makin kecil makin efisien (ambang boros > Rp 60 rb)">CPR</th>
                <th className="r" title="Click-Through Rate = Clicks ÷ Impressions × 100%. Daya tarik materi iklan">CTR</th>
                <th className="r" title="Cost per Click = Spend ÷ Clicks. Biaya rata-rata per klik">CPC</th>
                <th className="r" title="Frekuensi = Impressions ÷ Reach. Rata-rata orang melihat iklan; ≥ 3x = fatigue">Frek.</th>
                <th className="r" title="Impressions = total tayangan iklan (bisa berulang ke orang sama)">Impr.</th>
              </tr></thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} title="Klik untuk lihat detail campaign">
                    <td>
                      <b className="meta-link">{c.name}</b>
                      <div className="muted" style={{ fontSize: 9 }}>{[c.objective, c.resultLabel].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="muted">
                      <button className="meta-linkbtn" onClick={(e) => { e.stopPropagation(); toggleAcct(c.accountId); }} title="Saring campaign akun ini">
                        {c.account}
                      </button>
                    </td>
                    <td><StatusPill c={c} /></td>
                    <td className="r mono">{rp(c.spend)}</td>
                    <td className="r mono">{c.results ? num(c.results) : "—"}</td>
                    <td className="r mono">{c.costPerResult ? rp(c.costPerResult) : "—"}</td>
                    <td className="r mono">{c.ctr ? c.ctr.toFixed(2) + "%" : "—"}</td>
                    <td className="r mono">{c.cpc ? rp(c.cpc) : "—"}</td>
                    <td className="r mono">{c.frequency ? c.frequency.toFixed(2) + "x" : "—"}</td>
                    <td className="r mono">{num(c.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="meta-empty">
              {allCamps.length ? "Tidak ada campaign yang cocok dengan filter." : `Belum ada campaign dengan data untuk ${rangeLabel}.`}
            </div>
          )}
        </section>

        {/* ===== Breakdown mendalam (tren harian + segmen) ===== */}
        {dt && dt.daily && dt.daily.length > 0 && (
          <section className="meta-card">
            <Head title={`Tren Harian — ${rangeLabel}`} tag={<CprTrendTag rows={dt.daily} />} />
            <DailyChart rows={dt.daily} />
          </section>
        )}
        {dt && (
          <div className="meta-bd-grid">
            <BreakdownCard title="Demografi (Umur · Gender)" rows={dt.demographics} />
            <BreakdownCard title="Placement" rows={dt.placements} />
            <BreakdownCard title="Wilayah" rows={dt.regions} />
            <BreakdownCard title="Device" rows={dt.devices} />
            <BreakdownCard title="Per Jam (zona pengiklan)" rows={dt.hourly} wide />
            <BreakdownCard title="Top Ads (Creative)" rows={dt.topAds} wide />
          </div>
        )}
        {dt && <CreativeWinner items={dt.creatives ?? []} />}
      </Shell>

      {openId && <CampaignModal id={openId} range={range} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ---- status pill (effective_status + delivery issues) ---- */
const STATUS_TONE: Record<string, string> = {
  ACTIVE: "ok", PAUSED: "neutral", CAMPAIGN_PAUSED: "neutral", ADSET_PAUSED: "neutral",
  ARCHIVED: "neutral", DELETED: "neutral", IN_PROCESS: "warn", PENDING_REVIEW: "warn",
  WITH_ISSUES: "bad", DISAPPROVED: "bad",
};
function StatusPill({ c }: { c: MetaCampaign }) {
  const st = c.effectiveStatus || c.status || "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
      <span className={"meta-pill " + (STATUS_TONE[st] ?? "neutral")}>{st}</span>
      {c.issues > 0 && <span className="meta-pill bad" title={c.issueSummary}>⚠ {c.issues} isu</span>}
    </div>
  );
}

/* ---- tren CPR: paruh-awal vs paruh-akhir dari data harian (anomaly sederhana) ---- */
function CprTrendTag({ rows }: { rows: MetaDailyRow[] }) {
  if (rows.length < 4) return <>Spend &amp; Hasil per hari</>;
  const mid = Math.floor(rows.length / 2);
  const cpr = (rs: MetaDailyRow[]) => {
    const sp = rs.reduce((a, r) => a + r.spend, 0);
    const re = rs.reduce((a, r) => a + r.results, 0);
    return re > 0 ? sp / re : 0;
  };
  const a = cpr(rows.slice(0, mid));
  const b = cpr(rows.slice(mid));
  if (!a || !b) return <>Spend &amp; Hasil per hari</>;
  const delta = ((b - a) / a) * 100;
  const worse = delta > 0; // CPR naik = makin boros
  return (
    <span className={worse ? "meta-trend bad" : "meta-trend ok"}>
      CPR {worse ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% {worse ? "(makin boros)" : "(makin efisien)"}
    </span>
  );
}

/* ---- sinyal kesehatan & guardrail ---- */
function HealthPanel({
  signals,
  onOpen,
}: {
  signals: { activeZero: MetaCampaign[]; issues: MetaCampaign[]; highCpr: MetaCampaign[]; fatigue: MetaCampaign[]; lowCtr: MetaCampaign[] };
  onOpen: (id: string) => () => void;
}) {
  const groups = [
    { key: "issues", tone: "bad", title: "Bermasalah / Ditolak", hint: "delivery error, ditolak, atau menunggu review", action: "Tindakan: buka campaign → perbaiki penyebab (materi melanggar, pembayaran, atau tunggu review Meta).", items: signals.issues, fmt: (c: MetaCampaign) => c.issueSummary || c.effectiveStatus },
    { key: "zero", tone: "bad", title: "Aktif tapi Tidak Tayang (Rp0)", hint: "status ACTIVE namun belum ada spend di rentang ini", action: "Tindakan: cek budget / jadwal / ukuran audiens — aktif tapi belum membelanjakan apa pun.", items: signals.activeZero, fmt: () => "Rp0 spend" },
    { key: "cpr", tone: "warn", title: `CPR Boros (> ${rp(CPR_LIMIT)})`, hint: "biaya per hasil di atas ambang", action: "Tindakan: optimalkan audiens/kreatif atau turunkan bid — hasil terlalu mahal.", items: signals.highCpr, fmt: (c: MetaCampaign) => `CPR ${rp(c.costPerResult)} · ${num(c.results)} hasil` },
    { key: "fatigue", tone: "warn", title: `Fatigue (Frekuensi ≥ ${FREQ_LIMIT}x)`, hint: "audiens melihat iklan terlalu sering", action: "Tindakan: ganti kreatif / perluas audiens — orang sama terlalu sering melihat iklan.", items: signals.fatigue, fmt: (c: MetaCampaign) => `${c.frequency.toFixed(2)}x · ${rp(c.spend)}` },
    { key: "ctr", tone: "warn", title: `CTR Rendah (< ${CTR_FLOOR}%)`, hint: "kreatif kurang menarik (tayang cukup)", action: "Tindakan: ganti thumbnail/copy — iklan kurang menarik walau sudah cukup tayang.", items: signals.lowCtr, fmt: (c: MetaCampaign) => `CTR ${c.ctr.toFixed(2)}% · ${num(c.impressions)} tayang` },
  ] as const;
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  return (
    <section className="meta-card">
      <Head title="Kesehatan & Guardrail Iklan" tag={total ? `${total} sinyal` : "semua sehat ✅"} />
      <CardNote>
        Sinyal otomatis <b>berbasis aturan</b> dari campaign aktif (dihitung dari data Ads Insights). Ambang internal: <b>CPR boros &gt; {rp(CPR_LIMIT)}</b>, <b>Frekuensi ≥ {FREQ_LIMIT}x</b>, <b>CTR &lt; {CTR_FLOOR}%</b>. Setiap kartu menampilkan campaign yang kena + saran tindakan. <b>Klik item</b> untuk buka detail campaign.
      </CardNote>
      {total === 0 ? (
        <div className="meta-empty">Tidak ada sinyal masalah pada rentang ini. ✅</div>
      ) : (
        <div className="meta-health">
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.key} className={"meta-health-grp " + g.tone}>
              <div className="meta-health-hd">
                <span className="meta-health-dot" />
                <b>{g.title}</b>
                <span className="meta-health-n">{g.items.length}</span>
              </div>
              <div className="meta-health-hint" title={g.action}>{g.hint}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 6px", lineHeight: 1.5 }}>{g.action}</div>
              <div className="meta-health-list">
                {g.items.slice(0, 6).map((c) => (
                  <button key={c.id} className="meta-health-row" onClick={onOpen(c.id)} title="Klik untuk detail campaign">
                    <span className="meta-health-name">{c.name}</span>
                    <span className="meta-health-val">{g.fmt(c)}</span>
                  </button>
                ))}
                {g.items.length > 6 && <div className="muted" style={{ fontSize: 10 }}>+{g.items.length - 6} lainnya</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---- creative winner: iklan/copy pemenang (real, dari ad creative) ---- */
function CreativeWinner({ items }: { items: MetaCreative[] }) {
  return (
    <section className="meta-card">
      <Head title="Creative Winner — Iklan Pemenang" tag={items.length ? `${items.length} creative · urut hasil terbanyak` : "—"} />
      {items.length === 0 ? (
        <div className="meta-empty">Belum ada creative dengan hasil di rentang ini.</div>
      ) : (
        <div className="meta-cwgrid">
          {items.map((c, i) => (
            <div className="meta-cw" key={i}>
              {c.thumbnail ? (
                <img className="meta-cw-img" src={c.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="meta-cw-img meta-cw-noimg">no img</div>
              )}
              <div className="meta-cw-bd">
                <div className="meta-cw-top">
                  {c.cta && <span className="meta-pill ok">{c.cta.replace(/_/g, " ")}</span>}
                  {c.ads > 1 && <span className="meta-pill neutral">{c.ads} iklan</span>}
                </div>
                <div className="meta-cw-text" title={c.body}>{c.body || c.title || "(tanpa teks)"}</div>
                <div className="meta-cw-metrics">
                  <span><b>{num(c.results)}</b> {c.resultLabel || "hasil"}</span>
                  <span><b>{rp(c.costPerResult)}</b> CPR</span>
                  <span><b>{rp(c.spend)}</b> spend</span>
                  <span><b>{c.ctr ? c.ctr.toFixed(2) + "%" : "—"}</b> CTR</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---- per-campaign drill-down modal ---- */
function CampaignModal({ id, range, onClose }: { id: string; range: MetaRange; onClose: () => void }) {
  const { data, err, loading, reload } = useMeta<MetaCampaignDetail>(() => metaApi.adsCampaign(id, range), [id, range]);
  const c = data?.campaign;
  const t = data?.totals;
  const rangeLabel = META_RANGES.find((r) => r.key === range)?.label ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="meta-modal-bg" onClick={onClose}>
      <div className="meta-modal" onClick={(e) => e.stopPropagation()}>
        <div className="meta-modal-hd">
          <div>
            <h3>{c?.name || "Detail Campaign"}</h3>
            <div className="muted" style={{ fontSize: 11 }}>
              {[c?.objective, c?.status, rangeLabel].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button className="meta-modal-x" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="meta-modal-bd">
          {loading ? (
            <div className="meta-state">Memuat detail campaign…</div>
          ) : err ? (
            <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>
          ) : (
            <>
              {t && (
                <div className="meta-tiles">
                  <Tile k="Spend" v={rp(t.spend)} hint="Total biaya campaign ini pada rentang terpilih. Sumber: Ads Insights (spend)." />
                  <Tile k={t.resultLabel || "Hasil"} v={num(t.results)} hint="Jumlah hasil sesuai tujuan campaign ini (mis. chat WA / lead). Sumber: Ads Insights (actions)." />
                  <Tile k="Cost / Hasil" v={rp(t.costPerResult)} hint="Biaya per satu hasil = Spend ÷ Hasil (CPR). Makin kecil makin efisien." />
                  <Tile k="CTR" v={t.ctr ? t.ctr.toFixed(2) + "%" : "—"} hint="Clicks ÷ Impressions × 100%. Daya tarik materi iklan." />
                  <Tile k="CPC" v={rp(t.cpc)} hint="Spend ÷ Clicks. Biaya rata-rata per klik." />
                  <Tile k="CPM" v={rp(t.cpm)} hint="Spend ÷ Impressions × 1000. Biaya per 1.000 tayangan." />
                  <Tile k="Jangkauan" v={num(t.reach)} hint="Orang unik yang melihat iklan (bukan tayangan)." />
                  <Tile k="Frekuensi" v={t.frequency ? t.frequency.toFixed(2) + "x" : "—"} hint="Impressions ÷ Reach. ≥ 3x = fatigue (iklan terlalu sering muncul)." />
                  <Tile k="Impressions" v={num(t.impressions)} />
                  <Tile k="Clicks" v={num(t.clicks)} />
                </div>
              )}
              {data?.daily && data.daily.length > 0 && (
                <>
                  <div className="meta-sub">Tren Harian</div>
                  <DailyChart rows={data.daily} />
                </>
              )}

              <div className="meta-bd-grid" style={{ marginTop: 14 }}>
                <BreakdownCard title="Adset (Targeting: Broad / Behavior / PNS)" rows={data?.adsets} wide />
                <BreakdownCard title="Iklan (Creative)" rows={data?.ads} wide />
                <BreakdownCard title="Demografi (Umur · Gender)" rows={data?.demographics} />
                <BreakdownCard title="Placement" rows={data?.placements} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- breakdown bar list ---- */
function BreakdownCard({ title, rows, wide }: { title: string; rows?: MetaBreakdownRow[]; wide?: boolean }) {
  const list = (rows ?? []).filter((r) => r.spend > 0);
  const max = Math.max(1, ...list.map((r) => r.spend));
  return (
    <section className={"meta-card" + (wide ? " meta-bd-wide" : "")}>
      <Head title={title} tag={`${list.length}`} />
      {list.length ? (
        <div className="meta-bdlist">
          {list.map((r, i) => (
            <div className="meta-bd-row" key={i}>
              <span className="meta-bd-lbl" title={r.label}>{r.label || "—"}</span>
              <span className="meta-bd-bar"><i style={{ width: (r.spend / max) * 100 + "%" }} /></span>
              <span className="meta-bd-val mono">{rp(r.spend)}</span>
              <span className="meta-bd-res mono">{r.results ? num(r.results) : "—"}</span>
            </div>
          ))}
          <div className="meta-bd-head"><span /><span /><span className="r">Spend</span><span className="r">Hasil</span></div>
        </div>
      ) : (
        <div className="meta-empty">Tidak ada data.</div>
      )}
    </section>
  );
}

/* ---- daily spend/results bar chart (SVG) ---- */
function DailyChart({ rows }: { rows: MetaDailyRow[] }) {
  const maxS = Math.max(1, ...rows.map((r) => r.spend));
  const W = 100, H = 30, bw = W / rows.length;
  return (
    <>
      <svg className="meta-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {rows.map((r, i) => (
          <rect key={i} x={i * bw + bw * 0.15} y={H - (r.spend / maxS) * H} width={bw * 0.7} height={(r.spend / maxS) * H} fill="var(--green-600)" />
        ))}
      </svg>
      <div className="meta-chart-x">
        <span>{rows[0]?.date}</span>
        <span>Total {rp(rows.reduce((s, r) => s + r.spend, 0))} · {num(rows.reduce((s, r) => s + r.results, 0))} hasil</span>
        <span>{rows[rows.length - 1]?.date}</span>
      </div>
    </>
  );
}

/* ===================== WHATSAPP ===================== */
const QUALITY: Record<string, string> = { GREEN: "ok", YELLOW: "warn", RED: "bad" };
export function WhatsAppView() {
  const { data, err, loading, reload } = useMeta<MetaWa>(metaApi.whatsapp);
  const wabas = data?.wabas ?? [];
  return (
    <div className="meta-wrap">
      <Shell loading={loading} err={err} reload={reload} notConfigured={data ? !data.configured : false}>
        {wabas.length === 0 && <div className="meta-empty">Belum ada WhatsApp Business Account.</div>}
        {wabas.map((w) => (
          <section className="meta-card" key={w.id}>
            <Head title={w.name || "WhatsApp Business Account"} tag={`${(w.phones ?? []).length} nomor · ${(w.templates ?? []).length} template`} />
            <div className="meta-wa-phones">
              {(w.phones ?? []).map((p, i) => (
                <div className="meta-wa-phone" key={i}>
                  <div><b>{p.display_phone_number}</b><span>{p.verified_name || "—"}</span></div>
                  <span className={"meta-pill " + (QUALITY[s(p.quality_rating)] ?? "neutral")}>Quality {p.quality_rating || "?"}</span>
                  <span className="meta-pill neutral">{s(p.code_verification_status) || "—"}</span>
                </div>
              ))}
              {(w.phones ?? []).length === 0 && <div className="meta-empty">Nomor tidak terbaca (perlu izin whatsapp_business_management).</div>}
            </div>
            {(w.templates ?? []).length > 0 && (
              <div className="meta-wa-tpl">
                <div className="meta-sub">Template Pesan</div>
                <div className="meta-chips">
                  {(w.templates ?? []).slice(0, 24).map((t, i) => (
                    <span key={i} className={"meta-chip " + (s(t.status) === "APPROVED" ? "ok" : "warn")}>{t.name} <em>{s(t.category)}</em></span>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
        {wabas.length > 0 && <WAInbox wabas={wabas} />}
      </Shell>
    </div>
  );
}

/* ---- WhatsApp inbox (read + reply) — same pattern as the Instagram DM inbox.
   WhatsApp has no history API, so threads are captured by metaapi's Cloud API
   webhook (inbound) + the replies we send (outbound), persisted server-side. ---- */
function WAInbox({ wabas }: { wabas: MetaWa["wabas"] }) {
  const { data, err, loading, reload } = useMeta(() => metaApi.waConversations());
  const convs: WAConversation[] = useMemo(() => data?.conversations ?? [], [data]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // bumped by realtime WS push
  const open = convs.find((c) => `${c.phoneNumberId}:${c.contactWaId}` === openKey) ?? null;

  // Realtime: metaapi pushes a rev bump over WebSocket whenever a new inbound
  // message lands → refetch the thread list (and the open thread refetches via
  // its rev prop). Reconnects with a 10s backoff; no periodic polling, so the
  // UI only refreshes when something actually arrives.
  useEffect(() => {
    if (rev > 0) reload(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const connect = () => {
      const url = waRealtimeURL();
      if (!url) return;
      ws = new WebSocket(url);
      ws.onmessage = () => setRev((r) => r + 1);
      ws.onclose = () => { if (!stopped) timer = setTimeout(connect, 10000); };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };
    connect();
    return () => { stopped = true; if (timer) clearTimeout(timer); ws?.close(); };
  }, []);

  // Map phone_number_id → display number (from the WABA listing) for headers.
  const phoneLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const w of wabas ?? []) for (const p of w.phones ?? []) if (p.id) m[p.id] = p.display_phone_number || p.id;
    return m;
  }, [wabas]);

  return (
    <section className="meta-card">
      <Head
        title="Inbox WhatsApp"
        tag={loading ? "memuat…" : `${convs.length} percakapan`}
      />
      {loading ? (
        <div className="meta-state">Memuat percakapan…</div>
      ) : err ? (
        <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>
      ) : convs.length === 0 ? (
        <div className="meta-empty" style={{ lineHeight: 1.6 }}>
          Belum ada pesan masuk. Pesan WhatsApp masuk muncul di sini setelah <b>webhook</b> Cloud API
          terhubung (subscribe field <code>messages</code> di Meta App, arahkan ke
          <code> /api/meta/whatsapp/webhook</code>).
        </div>
      ) : (
        <div className="ig-inbox">
          <div className="ig-list">
            {convs.map((c) => {
              const key = `${c.phoneNumberId}:${c.contactWaId}`;
              return (
                <button key={key} className={"ig-conv" + (openKey === key ? " on" : "")} onClick={() => { setOpenKey(key); reload(); }}>
                  <div className="ig-conv-top">
                    <b className="ig-conv-name">{c.contactName || c.contactWaId}</b>
                    {c.unread > 0 && <span className="ig-unread">{c.unread}</span>}
                  </div>
                  <div className="ig-conv-snip">{(c.lastDirection === "out" ? "Anda: " : "") + (c.lastSnippet || "—")}</div>
                  <div className="ig-conv-meta">{phoneLabel[c.phoneNumberId] || c.contactWaId} · {igTime(c.lastMessageAt)}</div>
                </button>
              );
            })}
          </div>
          <div className="ig-thread-pane">
            {open ? <WAThread conv={open} phoneLabel={phoneLabel[open.phoneNumberId]} onSent={reload} rev={rev} /> : <div className="meta-empty">Pilih percakapan di kiri.</div>}
          </div>
        </div>
      )}
    </section>
  );
}

function WAThread({ conv, phoneLabel, onSent, rev }: { conv: WAConversation; phoneLabel?: string; onSent: () => void; rev: number }) {
  const { data, err, loading, reload } = useMeta(() => metaApi.waMessages(conv.phoneNumberId, conv.contactWaId), [conv.phoneNumberId, conv.contactWaId]);
  const [text, setText] = useState("");
  // Refetch this thread when a realtime push arrives (new inbound message).
  useEffect(() => {
    if (rev > 0) reload(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const msgs: WAMessage[] = useMemo(() => data?.messages ?? [], [data]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setSendErr("");
    try {
      await metaApi.waSend(conv.phoneNumberId, conv.contactWaId, body);
      setText("");
      reload();
      onSent();
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ig-thread">
      <div className="ig-thread-hd">{conv.contactName || conv.contactWaId} <span className="muted">· {phoneLabel || conv.phoneNumberId}</span></div>
      <div className="ig-msgs">
        {loading ? (
          <div className="meta-state">Memuat pesan…</div>
        ) : err ? (
          <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>
        ) : msgs.length === 0 ? (
          <div className="meta-empty">Belum ada pesan.</div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={"ig-msg" + (m.direction === "out" ? " me" : "")}>
              <div className="ig-bubble">{m.text || <i className="muted">(media / non-teks)</i>}</div>
              <div className="ig-msg-time">{igTime(m.timestamp)}{m.direction === "out" && m.status ? ` · ${m.status}` : ""}</div>
            </div>
          ))
        )}
      </div>
      <div className="ig-reply">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Tulis balasan…"
          disabled={sending}
        />
        <button className="meta-retry" onClick={send} disabled={sending || !text.trim()}>
          {sending ? "Mengirim…" : "Kirim"}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>
        Balasan teks bebas hanya dalam 24 jam sejak pesan terakhir customer. Di luar itu wajib template approved.
      </div>
      {sendErr && <div className="meta-state error" style={{ marginTop: 6 }}>{sendErr}</div>}
    </div>
  );
}

/* ===================== INSTAGRAM ===================== */
export function InstagramView() {
  const { data, err, loading, reload } = useMeta<MetaIg>(metaApi.instagram);
  const igs = data?.instagram ?? [];
  return (
    <div className="meta-wrap">
      <Shell loading={loading} err={err} reload={reload} notConfigured={data ? !data.configured : false}>
        <IGConnect onChanged={reload} hasAccounts={igs.length > 0} />
        {igs.map((ig) => (
          <section className="meta-card" key={ig.id}>
            <Head
              title={"@" + (ig.username ?? ig.id)}
              tag={ig.page ? ig.page : "Instagram"}
              right={ig.connId ? <IGRemove connId={ig.connId} username={ig.username ?? ig.id ?? ""} onDone={reload} /> : undefined}
            />
            <div className="meta-tiles">
              <Tile k="Followers" v={num(ig.followers_count)} />
              <Tile k="Konten" v={num(ig.media_count)} />
            </div>
          </section>
        ))}
        {igs.length > 0 && <IGInbox />}
      </Shell>
    </div>
  );
}

/* ---- Connect an Instagram-login account by pasting its access token ----
   The "Instagram API with Instagram Login" has no System User token; each account
   is authorised with its own long-lived token (App Dashboard → Instagram →
   "Create token"). metaapi stores it and auto-refreshes it so it never expires. */
function IGConnect({ onChanged, hasAccounts }: { onChanged: () => void; hasAccounts: boolean }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [open, setOpen] = useState(!hasAccounts);

  const connect = async () => {
    const t = token.trim();
    if (!t) return;
    setBusy(true);
    setMsg("");
    setErrMsg("");
    try {
      const r = await metaApi.igConnect(t);
      setToken("");
      setMsg(`Akun @${r.account.username} tersambung.`);
      onChanged();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErrMsg(ax?.response?.data?.error || ax?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="meta-card">
      <Head
        title="Tambah Akun Instagram"
        tag={hasAccounts ? "Instagram Login" : "Belum ada akun"}
        right={hasAccounts ? <button className="meta-retry" onClick={() => setOpen((o) => !o)}>{open ? "Tutup" : "Tambah akun"}</button> : undefined}
      />
      {open && (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="meta-empty" style={{ lineHeight: 1.6 }}>
            Buka <b>Meta App → Instagram → API setup with Instagram business login → "Create token"</b> di akun yang diinginkan,
            login, salin token, lalu tempel di sini. Token disimpan aman di server &amp; diperpanjang otomatis (tak perlu ulang).
          </div>
          <div className="ig-reply">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Tempel Instagram access token…"
              disabled={busy}
            />
            <button className="meta-retry" onClick={connect} disabled={busy || !token.trim()}>
              {busy ? "Menyambungkan…" : "Sambungkan"}
            </button>
          </div>
          {msg && <div className="meta-state" style={{ color: "var(--ok, #16a34a)" }}>{msg}</div>}
          {errMsg && <div className="meta-state error">{errMsg}</div>}
        </div>
      )}
    </section>
  );
}

function IGRemove({ connId, username, onDone }: { connId: number; username: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!window.confirm(`Hapus akun @${username} dari dashboard?`)) return;
    setBusy(true);
    try {
      await metaApi.igDisconnect(connId);
      onDone();
    } catch {
      setBusy(false);
    }
  };
  return <button className="meta-retry" onClick={remove} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</button>;
}

/* ---- Instagram DM inbox (read + reply) ---- */
function igTime(t: string): string {
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function IGInbox() {
  const { data, err, loading, reload } = useMeta(() => metaApi.igConversations());
  const convs: IGConversation[] = useMemo(() => data?.conversations ?? [], [data]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // bumped by realtime WS push (IG webhook)
  const open = convs.find((c) => c.id === openId) ?? null;

  // Realtime: metaapi's IG webhook pushes a rev bump over WebSocket whenever a new
  // DM lands → refetch the list (the open thread refetches via its rev prop).
  // Reconnects with a 10s backoff; the browser itself never polls.
  useEffect(() => {
    if (rev > 0) reload(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const connect = () => {
      const url = igRealtimeURL();
      if (!url) return;
      ws = new WebSocket(url);
      ws.onmessage = () => setRev((r) => r + 1);
      ws.onclose = () => { if (!stopped) timer = setTimeout(connect, 10000); };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };
    connect();
    return () => { stopped = true; if (timer) clearTimeout(timer); ws?.close(); };
  }, []);

  return (
    <section className="meta-card">
      <Head
        title="Inbox Instagram (DM)"
        tag={data?.limited ? "akses terbatas" : `${convs.length} percakapan${data && data.accounts ? ` · ${data.accounts} akun` : ""}`}
      />

      {loading ? (
        <div className="meta-state">Memuat percakapan…</div>
      ) : err ? (
        <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>
      ) : data?.limited ? (
        <div className="meta-empty" style={{ lineHeight: 1.6 }}>
          <b>Inbox belum bisa menampilkan DM customer.</b><br />
          Meta memblokir daftar percakapan sampai izin <code>instagram_manage_messages</code> mendapat
          <b> Advanced Access</b>. Pesan dari akun yang punya peran di app tetap bisa diuji.
          <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>Detail Meta: {data.limited}</div>
        </div>
      ) : convs.length === 0 ? (
        <div className="meta-empty">Belum ada percakapan.</div>
      ) : (
        <div className="ig-inbox">
          <div className="ig-list">
            {convs.map((c) => (
              <button
                key={c.id}
                className={"ig-conv" + (openId === c.id ? " on" : "")}
                onClick={() => setOpenId(c.id)}
              >
                <div className="ig-conv-top">
                  <b className="ig-conv-name">{c.customer || c.recipientId || "(tanpa nama)"}</b>
                  {c.unread > 0 && <span className="ig-unread">{c.unread}</span>}
                </div>
                <div className="ig-conv-snip">{c.snippet || "—"}</div>
                <div className="ig-conv-meta">@{c.igUser} · {igTime(c.updatedTime)}</div>
              </button>
            ))}
          </div>
          <div className="ig-thread-pane">
            {open ? <IGThread conv={open} rev={rev} /> : <div className="meta-empty">Pilih percakapan di kiri.</div>}
          </div>
        </div>
      )}
    </section>
  );
}

function IGThread({ conv, rev }: { conv: IGConversation; rev: number }) {
  const { data, err, loading, reload } = useMeta(() => metaApi.igMessages(conv.id, conv.pageId), [conv.id]);
  const [text, setText] = useState("");
  // Refetch this thread when a realtime push arrives (new inbound message).
  useEffect(() => {
    if (rev > 0) reload(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const msgs: IGMessage[] = useMemo(() => data?.messages ?? [], [data]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setSendErr("");
    try {
      await metaApi.igSend(conv.pageId, conv.recipientId, body);
      setText("");
      reload();
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ig-thread">
      <div className="ig-thread-hd">{conv.customer || conv.recipientId} <span className="muted">· @{conv.igUser}</span></div>
      <div className="ig-msgs">
        {loading ? (
          <div className="meta-state">Memuat pesan…</div>
        ) : err ? (
          <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>
        ) : msgs.length === 0 ? (
          <div className="meta-empty">Belum ada pesan.</div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={"ig-msg" + (m.fromMe ? " me" : "")}>
              <div className="ig-bubble">{m.text || <i className="muted">(media / non-teks)</i>}</div>
              <div className="ig-msg-time">{igTime(m.time)}</div>
            </div>
          ))
        )}
      </div>
      <div className="ig-reply">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Tulis balasan…"
          disabled={sending}
        />
        <button className="meta-retry" onClick={send} disabled={sending || !text.trim()}>
          {sending ? "Mengirim…" : "Kirim"}
        </button>
      </div>
      {sendErr && <div className="meta-state error" style={{ marginTop: 6 }}>{sendErr}</div>}
    </div>
  );
}

function Tile({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="meta-tile" title={hint}>
      <b>{v}</b>
      <span>{k}{hint && <i style={{ opacity: 0.4, fontStyle: "normal", marginLeft: 3 }} aria-hidden>ⓘ</i>}</span>
    </div>
  );
}

// CardNote — muted explanatory legend under a card header (source / meaning / how-to).
function CardNote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, lineHeight: 1.7, color: "#6b7280", margin: "0 2px 12px" }}>{children}</div>;
}
