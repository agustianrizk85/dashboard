import { useEffect, useState } from "react";
import { metaApi } from "./metaApi";
import type { MetaAds, MetaWa, MetaIg, MetaAdsDetail, MetaBreakdownRow, MetaDailyRow } from "./metaApi";
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

function useMeta<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    setErr("");
    fn().then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false));
  };
  useEffect(reload, []);
  return { data, err, loading, reload };
}

function Shell({ loading, err, reload, notConfigured, children }: { loading: boolean; err: string; reload: () => void; notConfigured?: boolean; children: React.ReactNode }) {
  if (loading) return <div className="meta-state">Memuat data Meta…</div>;
  if (err) return <div className="meta-state error">{err}<button className="meta-retry" onClick={reload}>Coba lagi</button></div>;
  if (notConfigured)
    return <div className="meta-state">Integrasi Meta belum dikonfigurasi. Jalankan backend Marketing dengan <code>META_ACCESS_TOKEN</code>.</div>;
  return <>{children}</>;
}

function Head({ title, tag }: { title: string; tag: string }) {
  return <div className="meta-head"><h3>{title}</h3><span className="meta-tag">{tag}</span></div>;
}

/* ===================== ADS ===================== */
const ACC_STATUS: Record<string, string> = { "1": "Aktif", "2": "Dinonaktifkan", "3": "Tidak terbayar", "7": "Review", "9": "Grace period", "101": "Tutup" };
const stripAct = (id: string) => (id || "").replace(/^act_/, "");
const amAccount = (id: string) => `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${stripAct(id)}`;
const amCampaign = (act: string, cid: string) =>
  `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${stripAct(act)}&selected_campaign_ids=${cid}`;

export function AdsView() {
  const { data, err, loading, reload } = useMeta<MetaAds>(metaApi.ads);
  const detail = useMeta<MetaAdsDetail>(metaApi.adsDetail);
  const dt = detail.data;
  const camps = data?.campaigns ?? [];
  const t = data?.totals;
  const accounts = data?.accounts ?? [];
  const accIns = (a: Record<string, unknown>) => (a.insights as Record<string, string> | undefined) ?? {};
  return (
    <div className="meta-wrap">
      <Shell loading={loading} err={err} reload={reload} notConfigured={data ? !data.configured : false}>
        {/* ===== KPI super-detail (30 hari, semua akun) ===== */}
        {t && (
          <section className="meta-card">
            <Head title="KPI Performa Iklan — 30 Hari" tag={`${num(t.accounts)} akun · ${num(t.activeCampaigns)}/${num(t.campaigns)} campaign aktif`} />
            <div className="meta-tiles">
              <Tile k="Total Spend" v={rp(t.spend)} />
              <Tile k="Hasil (WA/Lead)" v={num(t.results)} />
              <Tile k="Cost / Hasil" v={rp(t.costPerResult)} />
              <Tile k="CTR" v={t.ctr ? t.ctr.toFixed(2) + "%" : "—"} />
              <Tile k="CPC" v={rp(t.cpc)} />
              <Tile k="CPM" v={rp(t.cpm)} />
              <Tile k="Impressions" v={num(t.impressions)} />
              <Tile k="Clicks" v={num(t.clicks)} />
              <Tile k="Campaign Aktif" v={`${num(t.activeCampaigns)} / ${num(t.campaigns)}`} />
              <Tile k="Akun Iklan" v={num(t.accounts)} />
            </div>
          </section>
        )}

        {/* ===== Akun iklan (klik → Ads Manager) ===== */}
        {accounts.length > 0 && (
          <section className="meta-card">
            <Head title="Akun Iklan" tag="klik nama → buka Ads Manager ↗" />
            <table className="meta-table">
              <thead><tr><th>Akun</th><th>Status</th><th className="r">Spend 30h</th><th className="r">Impr.</th><th className="r">Klik</th><th className="r">CTR</th></tr></thead>
              <tbody>
                {accounts.map((a, i) => {
                  const ai = accIns(a);
                  return (
                    <tr key={i}>
                      <td>
                        <a className="meta-link" href={amAccount(s(a.id))} target="_blank" rel="noreferrer"><b>{s(a.name) || s(a.id)}</b> ↗</a>
                        <div className="muted" style={{ fontSize: 9 }}>{s(a.id)}</div>
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

        {/* ===== Breakdown per campaign (klik → Ads Manager) ===== */}
        <section className="meta-card">
          <Head title="Breakdown per Campaign" tag={`${camps.length} campaign · klik nama → Ads Manager ↗`} />
          {camps.length ? (
            <table className="meta-table">
              <thead><tr><th>Campaign</th><th>Akun</th><th>Status</th><th className="r">Spend</th><th className="r">Hasil</th><th className="r">CPR</th><th className="r">CTR</th><th className="r">CPC</th><th className="r">Impr.</th></tr></thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a className="meta-link" href={amCampaign(c.accountId, c.id)} target="_blank" rel="noreferrer"><b>{c.name}</b> ↗</a>
                      <div className="muted" style={{ fontSize: 9 }}>{[c.objective, c.resultLabel].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="muted">{c.account}</td>
                    <td><span className={"meta-pill " + (c.status === "ACTIVE" ? "ok" : "neutral")}>{c.status || "—"}</span></td>
                    <td className="r mono">{rp(c.spend)}</td>
                    <td className="r mono">{c.results ? num(c.results) : "—"}</td>
                    <td className="r mono">{c.costPerResult ? rp(c.costPerResult) : "—"}</td>
                    <td className="r mono">{c.ctr ? c.ctr.toFixed(2) + "%" : "—"}</td>
                    <td className="r mono">{c.cpc ? rp(c.cpc) : "—"}</td>
                    <td className="r mono">{num(c.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="meta-empty">Belum ada campaign dengan data 30 hari.</div>
          )}
        </section>

        {/* ===== Breakdown mendalam (tren harian + segmen) ===== */}
        {dt && dt.daily && dt.daily.length > 0 && (
          <section className="meta-card">
            <Head title="Tren Harian — 30 Hari" tag="Spend & Hasil per hari" />
            <DailyChart rows={dt.daily} />
          </section>
        )}
        {dt && (
          <div className="meta-bd-grid">
            <BreakdownCard title="Demografi (Umur · Gender)" rows={dt.demographics} />
            <BreakdownCard title="Placement" rows={dt.placements} />
            <BreakdownCard title="Wilayah" rows={dt.regions} />
            <BreakdownCard title="Device" rows={dt.devices} />
            <BreakdownCard title="Top Ads (Creative)" rows={dt.topAds} wide />
          </div>
        )}
      </Shell>
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
      </Shell>
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
        {igs.length === 0 ? (
          <section className="meta-card">
            <Head title="Instagram Business" tag="Belum tertaut" />
            <div className="meta-empty">
              Belum ada akun Instagram Business yang tertaut ke Facebook Page, atau token belum punya izin
              <code> instagram_basic</code>. Tautkan IG ke Page lewat Meta Business Suite, lalu tambahkan izin Instagram saat generate token.
            </div>
          </section>
        ) : (
          igs.map((ig) => (
            <section className="meta-card" key={ig.id}>
              <Head title={"@" + (ig.username ?? ig.id)} tag={ig.page ? "Page: " + ig.page : "Instagram"} />
              <div className="meta-tiles">
                <Tile k="Followers" v={num(ig.followers_count)} />
                <Tile k="Konten" v={num(ig.media_count)} />
              </div>
            </section>
          ))
        )}
      </Shell>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return <div className="meta-tile"><b>{v}</b><span>{k}</span></div>;
}
