import { useEffect, useMemo, useState } from "react";
import type { WorkItem, Warning } from "../models";
import { alurShort } from "../lib/alurCatalog";
import { metaApi, type MetaAds, type MetaCampaign, type MetaIgAccount } from "../meta/metaApi";
import type { ChannelRow, ProjectDot, LeadQuality, HandoverItem, AlertsBlock } from "./cloudApi";
import "./performa.css";

/* ---------- formatters ---------- */
const nf = new Intl.NumberFormat("id-ID");
const num = (n: number) => nf.format(Math.round(Number(n) || 0));
function rpShort(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toFixed(2).replace(".", ",") + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toFixed(0) + " jt";
  if (n >= 1e3) return "Rp " + (n / 1e3).toFixed(0) + " rb";
  return "Rp " + num(n);
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const chTone: Record<string, string> = { scale: "ok", optimize: "warn", pause: "bad", test: "neutral" };

/** Bangun isi tooltip: proses bisnis + sumber data (dua bagian, multi-baris). */
const tip = (proses: string, sumber: string) => `📋 Proses bisnis:\n${proses}\n\n🔗 Sumber data:\n${sumber}`;

/** ⓘ tooltip marker — hover menampilkan proses bisnis & sumber data. */
function Info({ text }: { text: string }) {
  return (
    <span className="mkperf-info" title={text} aria-label={text} role="img">
      ⓘ
    </span>
  );
}

const EMPTY_LQ: LeadQuality = { breakdown: [], stats: [], topSource: "—", bottomSource: "—", topProject: "—", bottomProject: "—" };
const EMPTY_ALERTS: AlertsBlock = { red: [], yellow: [], green: [] };

/**
 * Marketing "Ringkasan". Panel Control Tower dipertahankan; data real-only:
 *   - Operasional konten → work-items lokal.
 *   - Iklan Meta (KPI + channel "Meta Ads" + Best/Worst/Winning) → Graph API.
 *   - Instagram (Asset Registry) → Graph API.
 * Panel tanpa sumber (Demand/Readiness, Lead Quality, SAL, Alert) tampil kosong,
 * BUKAN dummy. Tiap panel diberi tooltip ⓘ yang menjelaskan sumber & artinya.
 */
export function PerformaView({ items, warnings }: { items: WorkItem[]; warnings: Warning[] }) {
  const [metaAds, setMetaAds] = useState<MetaAds | null>(null);
  const [ig, setIg] = useState<MetaIgAccount[]>([]);
  const [metaErr, setMetaErr] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);

  const load = () => {
    setMetaLoading(true);
    setMetaErr("");
    metaApi
      .ads()
      .then(setMetaAds)
      .catch((e) => setMetaErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setMetaLoading(false));
    metaApi
      .instagram()
      .then((r) => setIg(r.configured ? r.instagram ?? [] : []))
      .catch(() => setIg([]));
  };
  useEffect(load, []);

  const stats = useMemo(() => {
    const paid = items.filter((i) => i.alur === "A" || i.alur === "B").length;
    const organic = items.filter((i) => i.alur === "C" || i.alur === "D").length;
    const done = items.filter((i) => i.stage === "done").length;
    const byAlur = (["A", "B", "C", "D"] as const).map((a) => ({ alur: a as string, count: items.filter((i) => i.alur === a).length }));
    return { paid, organic, done, byAlur, max: Math.max(1, ...byAlur.map((b) => b.count)) };
  }, [items]);

  const t = metaAds?.configured ? metaAds.totals ?? null : null;
  const channels: ChannelRow[] = t
    ? [{ name: "Meta Ads", group: "Paid", spend: t.spend, leads: Math.round(t.results), mql: 0, cpl: t.results > 0 ? t.spend / t.results : null, roi: null, status: "scale" }]
    : [];

  // Best / Worst / Winning diturunkan dari campaign Meta ASLI (efisiensi CPR).
  const camps = metaAds?.configured ? metaAds.campaigns ?? [] : [];
  const byEff = camps.filter((c) => c.results > 0 && c.costPerResult > 0).sort((a, b) => a.costPerResult - b.costPerResult);
  const spent = camps.filter((c) => c.spend > 0);
  const worstC =
    [...spent].sort((a, b) => (b.results > 0 ? b.costPerResult : Infinity) - (a.results > 0 ? a.costPerResult : Infinity))[0] ?? null;
  const content = {
    winning: byEff.slice(0, 5),
    best: byEff[0] ?? null,
    worst: worstC,
    pauseCount: spent.filter((c) => c.results === 0).length,
  };

  return (
    <div className="mkperf-wrap">
      {/* ── Ringkasan operasional konten (data lokal Marketing) ── */}
      <div className="mkperf-sec-h"><span /> Ringkasan Operasional Konten</div>
      <div className="mkperf-kpis">
        <Kpi label="Total Konten" value={items.length} sub="campaign & konten aktif" info={tip("Setiap campaign/konten dilacak dari brief → produksi → review → publish di papan kerja Marketing.", "Work-items backend Marketing (:8086).")} />
        <Kpi label="Iklan Berbayar" value={stats.paid} sub="Alur A & B" info={tip("Produksi materi iklan berbayar (Meta/Google) — alur A & B.", "Work-items :8086, difilter alur A & B.")} />
        <Kpi label="Konten Organik" value={stats.organic} sub="Alur C & D" info={tip("Konten organik (feed/reels/carousel) tanpa biaya media — alur C & D.", "Work-items :8086, difilter alur C & D.")} />
        <Kpi label="Selesai" value={stats.done} sub="seluruh langkah tuntas" tone={stats.done ? "ok" : ""} info={tip("Konten yang seluruh tahap alur kerjanya sudah tuntas (siap tayang/arsip).", "Work-items :8086, stage = done.")} />
      </div>
      <div className="mkperf">
        <EarlyWarningPanel warnings={warnings} />
        <DistribusiPanel byAlur={stats.byAlur} max={stats.max} />
      </div>

      {/* ── Iklan Meta (live, gabungan SEMUA akun terhubung) ── */}
      <div className="mkperf-sec-h"><span /> Iklan Meta — Live · Gabungan Semua Akun</div>
      <MetaLiveKpis data={metaAds} loading={metaLoading} err={metaErr} reload={load} />

      {/* ── Control Tower (panel tetap; data real-only) ── */}
      <div className="mkperf-sec-h"><span /> Performa Iklan — Control Tower</div>
      <div className="mkperf-note">
        Data real ditarik dari Meta (Graph API): <b>Channel Meta Ads</b>, <b>Instagram</b>, dan <b>Best/Worst/Winning campaign</b>.
        Panel yang butuh CRM/iklan lain (Demand, Lead Quality, SAL, Alert) tampil <b>kosong</b> — bukan dummy. Arahkan ke ⓘ
        tiap panel untuk detail sumbernya.
      </div>
      <div className="qd-grid">
        <ChannelMatrix channels={channels} />
        <DemandReadiness items={[]} />
        <MqlScoring lq={EMPTY_LQ} totalLeads={0} />
        <SalHandover items={[]} />
        <AssetRegistry ig={ig} />
      </div>
      <div className="mkperf">
        <AlertPanel alerts={EMPTY_ALERTS} />
        <ContentPanel winning={content.winning} best={content.best} worst={content.worst} pauseCount={content.pauseCount} />
      </div>
    </div>
  );
}

/* ── KPI cards ── */
function Kpi({ label, value, sub, tone = "", info }: { label: string; value: number; sub: string; tone?: string; info?: string }) {
  return (
    <div className={`mkperf-kpi ${tone}`} title={info}>
      <div className="mkperf-kpi-lbl">{label}{info && <Info text={info} />}</div>
      <div className="mkperf-kpi-val">{value}</div>
      <div className="mkperf-kpi-sub">{sub}</div>
    </div>
  );
}

function KpiStr({ label, value, sub, tone = "", info }: { label: string; value: string; sub: string; tone?: string; info?: string }) {
  return (
    <div className={`mkperf-kpi ${tone}`} title={info}>
      <div className="mkperf-kpi-lbl">{label}{info && <Info text={info} />}</div>
      <div className="mkperf-kpi-val sm">{value}</div>
      <div className="mkperf-kpi-sub">{sub}</div>
    </div>
  );
}

/* Live Meta ad KPIs — aggregated across every connected account. 100% real. */
function MetaLiveKpis({ data, loading, err, reload }: { data: MetaAds | null; loading: boolean; err: string; reload: () => void }) {
  if (loading && !data) return <div className="mkperf-state">Memuat iklan Meta…</div>;
  if (err && !data)
    return (
      <div className="mkperf-state error">
        {err}
        <button className="mkperf-retry" onClick={reload}>Coba lagi</button>
      </div>
    );
  if (!data || !data.configured)
    return <div className="mkperf-state">Belum ada akun Meta terhubung — buka tab <b>Akun Meta</b>.</div>;
  const t = data.totals;
  if (!t) return <div className="mkperf-state">Belum ada data iklan 30 hari.</div>;

  const SRC = "Meta Graph API via backend Marketing (:8086) — agregat semua akun terhubung, 30 hari terakhir.";
  return (
    <div className="mkperf-kpis">
      <KpiStr label="Total Spend" value={rpShort(t.spend)} sub={`${num(t.accounts)} akun digabung`} info={tip("Total belanja iklan berbayar lintas semua akun — dasar evaluasi efisiensi budget.", SRC)} />
      <KpiStr label="Hasil (WA/Lead)" value={num(t.results)} sub="30 hari" tone="ok" info={tip("Konversi utama: percakapan WA / lead / pembelian — output akhir iklan akuisisi.", SRC + " Diambil dari kolom `actions`.")} />
      <KpiStr label="Cost / Hasil" value={rpShort(t.costPerResult)} sub="rata-rata" info={tip("Efisiensi biaya akuisisi (CPR) = spend ÷ hasil — makin rendah makin baik.", SRC)} />
      <KpiStr label="CTR" value={t.ctr ? t.ctr.toFixed(2) + "%" : "—"} sub={`CPC ${rpShort(t.cpc)}`} info={tip("Daya tarik kreatif: click-through rate = klik ÷ tayang.", SRC)} />
      <KpiStr label="Impressions" value={num(t.impressions)} sub={`${num(t.clicks)} klik`} info={tip("Jangkauan tayang & interaksi klik iklan.", SRC)} />
      <KpiStr label="CPM" value={rpShort(t.cpm)} sub="per 1.000 tayang" info={tip("Biaya jangkauan per 1.000 tayang — indikator harga inventory.", SRC)} />
      <KpiStr label="Campaign Aktif" value={`${num(t.activeCampaigns)}/${num(t.campaigns)}`} sub="aktif / total" info={tip("Berapa campaign sedang berjalan dari total — cakupan aktivitas iklan.", SRC + " Status ACTIVE.")} />
      <KpiStr label="Akun Iklan" value={num(t.accounts)} sub="semua terhubung" info={tip("Jumlah ad account unik yang dikelola (dedupe lintas token).", SRC)} />
    </div>
  );
}

/* ── Real operational panels (from work-items / warnings) ── */
const SEV_TONE: Record<string, string> = { critical: "red", warning: "orange", info: "yellow" };
function EarlyWarningPanel({ warnings }: { warnings: Warning[] }) {
  const sorted = [...warnings].sort((a, b) => {
    const o = { critical: 0, warning: 1, info: 2 } as const;
    return o[a.severity] - o[b.severity];
  });
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar amber" /> Early Warning System <Info text={tip("Mendeteksi langkah yang melewati deadline SLA agar bottleneck cepat ditangani sebelum konten telat tayang.", "Engine warning backend Marketing (:8086) dari deadline tiap langkah work-item.")} /></h2>
        <span className="mkperf-pill">{warnings.length} sinyal</span>
      </header>
      <div className="mkperf-body">
        {sorted.length === 0 ? (
          <div className="muted">Semua langkah on-track. ✅</div>
        ) : (
          <div className="mkperf-warn">
            {sorted.slice(0, 12).map((w, i) => (
              <div key={i} className={`mkperf-warn-row ${SEV_TONE[w.severity] ?? "yellow"}`}>
                <span className="mkperf-warn-dot" />
                <div className="mkperf-warn-tx">
                  <div className="mkperf-warn-ty">{w.step_code} · {w.work_item_title} · {w.owner}</div>
                  <div className="mkperf-warn-ms">{w.message}</div>
                </div>
              </div>
            ))}
            {sorted.length > 12 && <div className="muted mkperf-warn-more">+{sorted.length - 12} sinyal lainnya</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function DistribusiPanel({ byAlur, max }: { byAlur: { alur: string; count: number }[]; max: number }) {
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar green" /> Distribusi per Alur <Info text={tip("Memantau komposisi beban kerja konten per jenis alur (A/B = iklan berbayar, C/D = organik) untuk keseimbangan produksi.", "Work-items :8086, dikelompokkan per kode alur.")} /></h2>
        <span className="mkperf-pill">A · B · C · D</span>
      </header>
      <div className="mkperf-body">
        <div className="mkperf-dist">
          {byAlur.map((b) => (
            <div className="mkperf-dist-row" key={b.alur}>
              <span className="mkperf-dist-lbl">{alurShort[b.alur]}</span>
              <span className="mkperf-dist-trk"><i style={{ width: `${(b.count / max) * 100}%` }} /></span>
              <span className="mkperf-dist-val">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Control Tower panels ── */
function Head({ title, tag, info }: { title: string; tag: string; info?: string }) {
  return (
    <div className="qd-head">
      <h3>{title}{info && <Info text={info} />}</h3>
      <span className="qd-tag">{tag}</span>
    </div>
  );
}

function ChannelMatrix({ channels }: { channels: ChannelRow[] }) {
  const maxLeads = Math.max(1, ...channels.map((c) => c.leads));
  return (
    <section className="qd-card qd-channels">
      <Head title="Channel Performance Matrix" tag="Scale · Optimize · Pause" info={tip("Membandingkan performa & efisiensi tiap channel akuisisi untuk keputusan scale / optimize / pause budget.", "Meta Ads = LIVE Graph API (:8086), spend/leads/CPL agregat semua akun. Channel lain (TikTok/Google/dst) menunggu integrasi API masing-masing.")} />
      <div className="qd-ch-head">
        <span>CHANNEL</span><span className="r">SPEND</span><span>LEADS</span>
        <span className="r">MQL</span><span className="r">CPL</span><span className="r">ROI</span><span>STATUS</span>
      </div>
      <div className="qd-ch-body">
        {channels.length === 0 ? (
          <div className="muted" style={{ padding: "18px 4px" }}>Belum ada channel dengan data live.</div>
        ) : (
          channels.map((c) => {
            const live = /meta/i.test(c.name);
            return (
              <div className="qd-ch-row" key={c.name}>
                <div className="qd-ch-name">
                  <b>{c.name}{live && <span className="qd-live">LIVE</span>}</b>
                  <span>{c.group.toUpperCase()}</span>
                </div>
                <div className="r mono">{rpShort(c.spend)}</div>
                <div className="qd-ch-leads">
                  <i style={{ width: (c.leads / maxLeads) * 100 + "%", background: `var(--${chTone[c.status] === "ok" ? "ok" : chTone[c.status] === "bad" ? "bad" : "warn"})` }} />
                  <em>{num(c.leads)}</em>
                </div>
                <div className="r mono">{c.mql ? num(c.mql) : "—"}</div>
                <div className="r mono">{rpShort(c.cpl)}</div>
                <div className="r mono">{c.roi ?? "—"}</div>
                <div><span className={"qd-pill " + (chTone[c.status] ?? "neutral")}>{cap(c.status)}</span></div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function DemandReadiness({ items }: { items: ProjectDot[] }) {
  const maxBk = Math.max(1, ...items.map((i) => i.booking));
  const color = (p: ProjectDot) => {
    const hiD = p.demand >= 50, hiR = p.readiness >= 50;
    if (hiD && hiR) return "var(--ok)";
    if (!hiD && !hiR) return "var(--bad)";
    return "var(--warn)";
  };
  return (
    <section className="qd-card qd-scatter">
      <Head title="Project Demand & Readiness" tag="Demand × Readiness" info={tip("Memetakan minat pasar (demand) vs kesiapan jual (readiness) tiap proyek untuk prioritas budget & pesan.", "Butuh data CRM/sales (mis. backend sales :8085 atau sheet) — belum terhubung, panel kosong.")} />
      <div className="qd-plot">
        <span className="qd-q tl">FIX READINESS</span>
        <span className="qd-q tr">SCALE</span>
        <span className="qd-q bl">HOLD</span>
        <span className="qd-q br">IMPROVE MESSAGE</span>
        <span className="qd-axis-y">Demand →</span>
        <span className="qd-axis-x">Readiness →</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="qd-grid-lines">
          <line x1="50" y1="0" x2="50" y2="100" />
          <line x1="0" y1="50" x2="100" y2="50" />
        </svg>
        {items.map((p) => {
          const r = 8 + (p.booking / maxBk) * 16;
          return (
            <div key={p.name} className="qd-bubble" title={`${p.name} · demand ${p.demand} · readiness ${p.readiness} · ${p.booking} booking`} style={{ left: p.readiness + "%", bottom: p.demand + "%", width: r, height: r, background: color(p) }} />
          );
        })}
      </div>
    </section>
  );
}

function MqlScoring({ lq, totalLeads }: { lq: LeadQuality; totalLeads: number }) {
  const total = Math.max(1, lq.breakdown.reduce((s, b) => s + b.value, 0));
  return (
    <section className="qd-card">
      <Head title="Lead Quality & MQL Scoring" tag={`${num(totalLeads)} leads`} info={tip("Menilai mutu lead (Hot/Warm/Nurture/Low) & rasio MQL untuk kualitas funnel akuisisi.", "Butuh data CRM (skoring lead) — belum terhubung, panel kosong.")} />
      <div className="qd-segbar">
        {lq.breakdown.map((b) => (
          <span key={b.label} style={{ width: (b.value / total) * 100 + "%" }} />
        ))}
      </div>
      <div className="qd-buckets">
        {lq.breakdown.length === 0 ? (
          <div className="muted" style={{ padding: "8px 2px" }}>Belum ada data lead (perlu CRM).</div>
        ) : (
          lq.breakdown.map((b) => (
            <div className="qd-bk" key={b.label}>
              <span>{b.label}</span><b>{num(b.value)}</b>
            </div>
          ))
        )}
      </div>
      <div className="qd-tb">
        <div><span className="up">▲ Top</span> {lq.topSource}</div>
        <div><span className="down">▼ Bottom</span> {lq.bottomSource}</div>
      </div>
    </section>
  );
}

function SalHandover({ items }: { items: HandoverItem[] }) {
  return (
    <section className="qd-card">
      <Head title="MQL → SAL Handover" tag="Akuntabilitas" info={tip("Akuntabilitas serah-terima lead matang (MQL) dari Marketing ke Sales (SAL): acceptance rate, waktu respon, SLA.", "Butuh data CRM/sales — belum terhubung, panel kosong.")} />
      {items.length === 0 ? (
        <div className="muted" style={{ padding: "14px 4px" }}>Belum ada data handover (perlu CRM).</div>
      ) : (
        <div className="qd-tiles">
          {items.map((h) => (
            <div className="qd-tile" key={h.label}>
              <b>{h.value}</b>
              <span>{h.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* Digital Asset Registry — Instagram LIVE dari Meta Graph API. */
function AssetRegistry({ ig }: { ig: MetaIgAccount[] }) {
  return (
    <section className="qd-card">
      <Head title="Digital Asset Registry" tag="Instagram · Live" info={tip("Inventaris aset digital brand (IG/Web/TikTok/YT/GBP) untuk memantau kepemilikan & pertumbuhan audiens.", "Instagram Business = LIVE Graph API (:8086): followers & jumlah konten. Web/TikTok/YouTube/GBP belum terhubung.")} />
      {ig.length === 0 ? (
        <div className="muted" style={{ padding: "14px 4px" }}>Belum ada akun IG Business tertaut (perlu izin instagram_basic & IG terhubung ke Page).</div>
      ) : (
        <div className="qd-iglist">
          {ig.map((g) => (
            <div className="qd-igrow" key={g.id || g.username}>
              <div className="qd-igid">
                <b>@{g.username || g.id}</b>
                <span>{g.page || "Instagram Business"}</span>
              </div>
              <div className="qd-igm"><b>{num(g.followers_count || 0)}</b><span>followers</span></div>
              <div className="qd-igm"><b>{num(g.media_count || 0)}</b><span>konten</span></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AlertPanel({ alerts }: { alerts: AlertsBlock }) {
  const groups = [
    { key: "red", title: "Red Alert", cls: "red", items: alerts.red },
    { key: "yellow", title: "Yellow", cls: "yellow", items: alerts.yellow },
    { key: "green", title: "Green Signal", cls: "green", items: alerts.green },
  ] as const;
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar" /> Alert System <Info text={tip("Notifikasi otomatis kondisi kritis (Red) / peringatan (Yellow) / sehat (Green) dari rule-engine performa untuk aksi cepat.", "Butuh rule-engine + data CRM/iklan gabungan — belum terhubung, panel kosong.")} /></h2>
        <span className="mkperf-pill">Red · Yellow · Green</span>
      </header>
      <div className="mkperf-body">
        {groups.map((g) => (
          <div key={g.key} className="mkperf-alert-group">
            <div className={`mkperf-alert-title ${g.cls}`}>
              <span className="mkperf-dot" /> {g.title}
              <span className="mkperf-count">{g.items.length}</span>
            </div>
            <ul className={`mkperf-alert-list ${g.cls}`}>
              {g.items.map((msg, i) => (<li key={i}>{msg}</li>))}
              {g.items.length === 0 && <li className="muted">—</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Content & Winning — Best/Worst/Winning diturunkan dari campaign Meta ASLI. */
function ContentPanel({ winning, best, worst, pauseCount }: { winning: MetaCampaign[]; best: MetaCampaign | null; worst: MetaCampaign | null; pauseCount: number }) {
  return (
    <section className="mkperf-card">
      <header className="mkperf-head">
        <h2><span className="mkperf-bar" /> Content &amp; Winning Campaign <Info text={tip("Mengidentifikasi campaign pemenang (paling efisien) untuk direplikasi & campaign terboros untuk dihentikan/diperbaiki.", "Campaign Meta LIVE Graph API (:8086): CPR & hasil per campaign. 'Pause' = ada spend tapi 0 hasil.")} /></h2>
        <span className="mkperf-pill">Live · Meta</span>
      </header>
      <div className="mkperf-body">
        <div className="mkperf-subhead">
          Campaign Unggulan <span className="muted">· CPR terendah (paling efisien)</span>
        </div>
        <div className="mkperf-winlist">
          {winning.map((w) => (
            <div key={w.id} className="mkperf-win">
              <div className="mkperf-win-id">
                <div className="mkperf-win-name">{w.name}</div>
                <div className="mkperf-win-sub">{w.account} · Meta</div>
              </div>
              <div className="mkperf-win-metrics">
                <span className="m">{rpShort(w.spend)}</span>
                <span className="m">{w.resultLabel || "Hasil"} {num(w.results)}</span>
                <span className="mkperf-book">CPR {rpShort(w.costPerResult)}</span>
              </div>
            </div>
          ))}
          {winning.length === 0 && <div className="muted">Belum ada campaign dengan hasil 30 hari.</div>}
        </div>

        <div className="mkperf-bw">
          <div className="mkperf-bw-col best">
            <div className="mkperf-bw-label">▲ Best (CPR termurah)</div>
            <div className="mkperf-bw-name">{best?.name ?? "—"}</div>
            <div className="mkperf-bw-sub">{best ? `${best.account} · CPR ${rpShort(best.costPerResult)} · ${num(best.results)} hasil` : "— · —"}</div>
          </div>
          <div className="mkperf-bw-col worst">
            <div className="mkperf-bw-label">▼ Worst (paling boros)</div>
            <div className="mkperf-bw-name">{worst?.name ?? "—"}</div>
            <div className="mkperf-bw-sub">{worst ? `${worst.account} · ${rpShort(worst.spend)} · ${worst.results ? num(worst.results) + " hasil" : "0 hasil"}` : "— · —"}</div>
          </div>
        </div>

        <div className="mkperf-foot">
          <span className="mkperf-foot-chip pause">{pauseCount} kandidat pause (spend, 0 hasil)</span>
        </div>
      </div>
    </section>
  );
}
