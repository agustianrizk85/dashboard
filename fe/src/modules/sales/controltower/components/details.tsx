import type { Dashboard } from "../types";
import { Pill } from "./ui";
import { CAT, CH_C, LAYER_C, SEV, STATUS, convColor, effClass, funnelConv, num, pct, rpShort, statusFor } from "../lib/format";

/* ---------- Panel 1 — Executive ---------- */
export function ExecutiveDetail({ d }: { d: Dashboard }) {
  const e = d.exec;
  const rows: [string, string, string][] = [
    ["Target 2026", e.target2026 + " unit", "Komitmen tahunan"],
    ["Realisasi Akad (YTD)", e.akad + " unit", pct((e.akad / e.target2026) * 100, 1) + " dari target"],
    ["Total Booking", e.booking + " unit", "Termasuk pipeline aktif"],
    ["Menuju Akad / Proses", e.proses + " unit", "On KPR / dokumen"],
    ["Batal / Gugur", e.batal + " unit", pct((e.batal / e.booking) * 100, 1) + " dari booking"],
    ["Gap ke Target", e.target2026 - e.akad + " unit", "Sisa menuju 500"],
    ["Revenue Akad (Cash-In)", rpShort(e.revenueAkad), "Terkonfirmasi"],
    ["Potensi Revenue Pipeline", rpShort(e.potentialRevenue), "Dari proses menuju akad"],
    ["Total Ads Spent", rpShort(e.adsSpent), `Q1 ${rpShort(e.adsSpentQ1)} · Q2 ${rpShort(e.adsSpentQ2)}`],
  ];
  return (
    <div>
      <p className="md-lead">
        Posisi pencapaian menuju target <b>500 unit</b>. Realisasi akad <b>{e.akad}</b> ({pct((e.akad / e.target2026) * 100, 1)}) — status{" "}
        <b style={{ color: d.summary.status === "on-track" ? STATUS.hijau.c : d.summary.status === "risk" ? STATUS.kuning.c : STATUS.merah.c }}>
          {d.summary.status}
        </b>
        , butuh akselerasi pipeline & cash-in.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Item</th>
            <th>Nilai</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r[0]}</td>
              <td className="num">
                <b>{r[1]}</b>
              </td>
              <td className="muted">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="md-sub">KPI Scorecard</h4>
      <table className="dtable">
        <thead>
          <tr>
            <th>#</th>
            <th>KPI</th>
            <th>Aktual</th>
            <th>Target</th>
            <th>Owner</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {d.kpis.map((k) => {
            const s = statusFor(k.value, k.target, k.lowerBetter);
            return (
              <tr key={k.no}>
                <td className="muted">{k.no}</td>
                <td>{k.name}</td>
                <td className="num">
                  <b>
                    {k.value.toString().replace(".", ",")}
                    {k.unit}
                  </b>
                </td>
                <td className="num muted">
                  {k.target}
                  {k.unit}
                </td>
                <td className="muted">{k.owner}</td>
                <td>
                  <Pill color={STATUS[s].c} bg={STATUS[s].bg}>
                    {STATUS[s].label}
                  </Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Panel 2 — Funnel ---------- */
export function FunnelDetail({ d }: { d: Dashboard }) {
  const f = d.funnel;
  return (
    <div>
      <p className="md-lead">
        Full funnel <b>{f.length > 0 ? f[0].key : "Impression"} → {f.length > 0 ? f[f.length - 1].key : "Cash-In"}</b>: dari{" "}
        <b>{num(f.length > 0 ? f[0].value : 0)}</b> hingga <b>{num(f.length > 0 ? f[f.length - 1].value : 0)}</b>. Konversi tiap tahap
        dihitung terhadap tahap sebelumnya; yang di bawah standar GP ditandai merah/kuning. Penjualan total <b>semua sumber</b>:
        Booking <b>{d.exec.booking}</b> · Akad <b>{d.exec.akad}</b> · Cash-In <b>{rpShort(d.exec.revenueAkad)}</b>.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Tahap</th>
            <th>Aktual</th>
            <th>Target Ideal</th>
            <th>Konversi</th>
            <th>Std</th>
            <th>Owner</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {f.map((s, i) => {
            const conv = funnelConv(f, i);
            let st: keyof typeof STATUS = "hijau";
            if (s.std && conv != null) st = statusFor(conv, s.std);
            else if (s.std && i === 1) st = statusFor((s.value / f[0].value) * 100, s.std);
            return (
              <tr key={i}>
                <td>
                  <b>{s.key}</b>
                </td>
                <td className="num">{s.isMoney ? rpShort(s.value) : num(s.value)}</td>
                <td className="num muted">{s.isMoney ? rpShort(s.target) : num(s.target)}</td>
                <td className="num">{conv != null ? pct(conv, 1) : i === 1 ? pct((s.value / f[0].value) * 100, 1) : "—"}</td>
                <td className="num muted">{s.std ? "≥" + s.std + "%" : "—"}</td>
                <td className="muted">{s.owner}</td>
                <td>
                  <Pill color={STATUS[st].c} bg={STATUS[st].bg}>
                    {STATUS[st].label}
                  </Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="callout merah">
        <b>Cara baca:</b> setiap tahap menampilkan konversi terhadap tahap sebelumnya. Tahap dengan konversi di bawah standar (Std) adalah
        titik kebocoran utama — prioritaskan perbaikan di sana. Standar tiap tahap diatur lewat <b>Master Data → Full Funnel</b>.
      </div>
    </div>
  );
}

/* ---------- Panel 5 — Project ---------- */
export function ProjectDetail({ d }: { d: Dashboard }) {
  const ps = [...d.projects].sort((a, b) => b.rev - a.rev);
  return (
    <div>
      <p className="md-lead">
        Prioritaskan energi: dorong <b>Mesin Utama</b>, dampingi <b>Pendukung</b>, bereskan bottleneck <b>Pembenahan</b> sebelum push besar.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Project</th>
            <th>Kategori</th>
            <th>Total</th>
            <th>Akad</th>
            <th>Proses</th>
            <th>Batal</th>
            <th>Revenue Akad</th>
            <th>Cost/Akad</th>
            <th>Efisiensi</th>
            <th>Stok Sisa</th>
          </tr>
        </thead>
        <tbody>
          {ps.map((p) => (
            <tr key={p.code}>
              <td>
                <b>{p.code}</b>
                <div className="muted small">{p.name}</div>
              </td>
              <td>
                <Pill color={CAT[p.cat].c} bg={CAT[p.cat].bg}>
                  {CAT[p.cat].label}
                </Pill>
              </td>
              <td className="num">{p.total}</td>
              <td className="num">
                <b>{p.akad}</b>
              </td>
              <td className="num">{p.proses}</td>
              <td className="num">{p.batal}</td>
              <td className="num">{p.rev ? rpShort(p.rev) : "—"}</td>
              <td className="num">{p.cpa ? "Rp" + p.cpa.toString().replace(".", ",") + " Jt" : "—"}</td>
              <td>
                <span className={"eff " + effClass(p.eff)}>{p.eff}</span>
              </td>
              <td className="num">
                {p.stock.avail}
                <span className="muted">/{p.stock.total}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Panel 4 — Sales ---------- */
export function SalesDetail({ d }: { d: Dashboard }) {
  const ranked = [...d.sales].sort((a, b) => b.akad - a.akad || b.conv - a.conv);
  return (
    <div>
      <p className="md-lead">
        Ranking objektif berdasar akad & konversi. <b>Top 5</b> layak apresiasi; <b>conv &lt; 33%</b> perlu coaching SPV.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>#</th>
            <th>Sales</th>
            <th>Role</th>
            <th>Project</th>
            <th>Akad</th>
            <th>Proses</th>
            <th>Batal</th>
            <th>Total</th>
            <th>Conv %</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((s, i) => (
            <tr key={s.name} className={i < 5 ? "row-top" : s.conv < 33 ? "row-low" : ""}>
              <td className="muted">{i + 1}</td>
              <td>
                <b>{s.name}</b>
              </td>
              <td>
                <span className={"role role-" + s.role.toLowerCase()}>{s.role}</span>
              </td>
              <td className="muted small">{s.project}</td>
              <td className="num">
                <b>{s.akad}</b>
              </td>
              <td className="num">{s.proses}</td>
              <td className="num">{s.batal}</td>
              <td className="num">{s.total}</td>
              <td className="num" style={{ color: convColor(s.conv) }}>
                <b>{s.conv}%</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Panel 3 — Lead Quality ---------- */
export function LeadQualityDetail({ d }: { d: Dashboard }) {
  const ps = [...d.projects].sort((a, b) => (a.cpa || 999) - (b.cpa || 999));
  return (
    <div className="md-grid2">
      <div>
        <h4 className="md-sub">Kualitas leads</h4>
        <p className="md-lead">
          Volume besar, konversi rendah → fokus <b>kualitas</b> & <b>kecepatan follow-up</b>, bukan menambah leads.
        </p>
        <table className="dtable">
          <tbody>
            <tr>
              <td>Total Leads</td>
              <td className="num">
                <b>20.291</b>
              </td>
            </tr>
            <tr>
              <td>Valid Leads</td>
              <td className="num">
                <b>13.255</b> <span className="muted">(65%)</span>
              </td>
            </tr>
            <tr>
              <td>Confirmed Visit</td>
              <td className="num">
                <b>711</b>
              </td>
            </tr>
            <tr className="row-low">
              <td>Lead → CV Rate</td>
              <td className="num">
                <b style={{ color: "#D6453A" }}>5,4%</b> <span className="muted">min 20%</span>
              </td>
            </tr>
            <tr>
              <td>Unreachable</td>
              <td className="num">1.376</td>
            </tr>
            <tr>
              <td>Not Engaged</td>
              <td className="num">1.326</td>
            </tr>
            <tr>
              <td>Not Qualified</td>
              <td className="num">420</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="md-sub">Efisiensi Meta Ads per project (Cost / Akad)</h4>
        <table className="dtable">
          <thead>
            <tr>
              <th>Project</th>
              <th>Spend</th>
              <th>Akad</th>
              <th>Cost/Akad</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {ps.map((p) => (
              <tr key={p.code}>
                <td>
                  <b>{p.code}</b>
                </td>
                <td className="num muted">{rpShort(p.ads)}</td>
                <td className="num">{p.akad}</td>
                <td className="num">
                  <b>{p.cpa ? "Rp" + p.cpa.toString().replace(".", ",") + "Jt" : "—"}</b>
                </td>
                <td>
                  <span className={"eff " + effClass(p.eff)}>{p.eff}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="md-foot muted">
          Total Ads Spent {rpShort(d.exec.adsSpent)} · {d.projects.reduce((a, p) => a + p.akad, 0)} akad.
        </p>
      </div>
    </div>
  );
}

/* ---------- Panel 7 — Reason Code ---------- */
export function ReasonDetail({ d }: { d: Dashboard }) {
  const layers: Array<"L1" | "L2" | "L3"> = ["L1", "L2", "L3"];
  const total = d.reasons.reduce((a, r) => a + r.count, 0);
  return (
    <div>
      <p className="md-lead">
        Total <b>{num(total)}</b> prospek hilang terklasifikasi. Dominasi di <b style={{ color: LAYER_C.L1 }}>Layer-1</b> menegaskan masalah
        follow-up awal.
      </p>
      <div className="md-grid3">
        {layers.map((L) => {
          const list = d.reasons.filter((r) => r.layer === L).sort((a, b) => b.count - a.count);
          const max = Math.max(...list.map((r) => r.count));
          const sum = list.reduce((a, r) => a + r.count, 0);
          return (
            <div className="rd-col" key={L}>
              <div className="rd-h" style={{ borderColor: LAYER_C[L] }}>
                <b style={{ color: LAYER_C[L] }}>{d.reasonMeta[L].stage}</b>
                <span className="muted">
                  {d.reasonMeta[L].target} · {num(sum)} loss
                </span>
              </div>
              {list.map((r) => (
                <div className="rd-row" key={r.code}>
                  <span className="rd-code" style={{ color: LAYER_C[L] }}>
                    {r.code}
                  </span>
                  <div className="rd-info">
                    <b>{r.name}</b>
                    <span className="muted">{r.id}</span>
                  </div>
                  <div className="rd-bar">
                    <div style={{ width: (r.count / max) * 100 + "%", background: LAYER_C[L] }} />
                  </div>
                  <span className="rd-n">{num(r.count)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Panel 8 — Cash ---------- */
export function CashDetail({ d }: { d: Dashboard }) {
  const e = d.exec;
  return (
    <div>
      <p className="md-lead">
        Dari <b>{e.booking} booking</b>, baru <b>{e.akad} akad</b> ({pct((e.akad / e.booking) * 100, 0)}). <b>{e.proses}</b> tertahan di proses (potensi{" "}
        {rpShort(e.potentialRevenue)}), <b style={{ color: "#D6453A" }}>{e.batal} batal</b> = kebocoran cash.
      </p>
      <table className="dtable">
        <tbody>
          <tr>
            <td>Total Booking Aktif</td>
            <td className="num">
              <b>{e.booking}</b>
            </td>
            <td className="muted">unit</td>
          </tr>
          <tr>
            <td>Menuju Akad (proses/KPR)</td>
            <td className="num">
              <b style={{ color: "#D9930B" }}>{e.proses}</b>
            </td>
            <td className="muted">potensi {rpShort(e.potentialRevenue)}</td>
          </tr>
          <tr>
            <td>Akad Selesai</td>
            <td className="num">
              <b style={{ color: "#1F9D54" }}>{e.akad}</b>
            </td>
            <td className="muted">cash-in {rpShort(e.revenueAkad)}</td>
          </tr>
          <tr className="row-low">
            <td>Batal / Gugur</td>
            <td className="num">
              <b style={{ color: "#D6453A" }}>{e.batal}</b>
            </td>
            <td className="muted">{pct((e.batal / e.booking) * 100, 1)} dari booking</td>
          </tr>
          <tr>
            <td>Booking → Akad Rate</td>
            <td className="num">
              <b>{pct((e.akad / e.booking) * 100, 1)}</b>
            </td>
            <td className="muted">target ≥70%</td>
          </tr>
        </tbody>
      </table>
      <div className="callout kuning">
        <b>Aksi cash:</b> eskalasi {e.proses} pipeline proses untuk akad bulan ini (≈{rpShort(e.potentialRevenue)}). Audit {e.batal} batal untuk
        reason code & pencegahan.
      </div>
    </div>
  );
}

/* ---------- Panel 6 — Channels ---------- */
export function ChannelDetail({ d }: { d: Dashboard }) {
  const max = Math.max(...d.channels.map((c) => c.total));
  return (
    <div>
      <p className="md-lead">
        WhatsApp, Walk-in/Event, dan Instagram (Meta Ads) jadi tiga mesin booking utama. Buyer-Get-Buyer kecil tapi konversi 100%.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Sumber</th>
            <th>Distribusi</th>
            <th>Booking</th>
            <th>Akad</th>
            <th>Konversi</th>
          </tr>
        </thead>
        <tbody>
          {d.channels.map((c, i) => (
            <tr key={c.code}>
              <td>
                <b>{c.name}</b>
              </td>
              <td>
                <div className="tbar">
                  <div style={{ width: (c.total / max) * 100 + "%", background: CH_C[i] }} />
                </div>
              </td>
              <td className="num">{c.total}</td>
              <td className="num">
                <b>{c.akad}</b>
              </td>
              <td className="num" style={{ color: c.conv >= 50 ? "#1F9D54" : "#D9930B" }}>
                <b>{c.conv}%</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Panel 9 — Agent & Event ---------- */
export function AgentEventDetail({ d }: { d: Dashboard }) {
  const ev = d.events.attributed;
  const agentAkad = d.agents.reduce((s, a) => s + a.akad, 0);
  const contrib = d.exec.akad > 0 ? Math.round((agentAkad / d.exec.akad) * 1000) / 10 : 0;
  const top = [...d.agents].sort((a, b) => b.akad - a.akad)[0];
  const idle = d.agents.filter((a) => a.akad === 0);

  // Auto-generated ("AI") insights from the agent + event data.
  const insights: string[] = [];
  if (top && top.akad > 0) insights.push(`Agent terbaik: ${top.name} (${top.akad} akad · ${top.conv}% konversi).`);
  insights.push(
    `Kontribusi agent ${contrib}% dari total akad` +
      (contrib < 15 ? " — di bawah target 15%, dorong rekrut & aktivasi agent produktif." : " — sudah memenuhi target 15%."),
  );
  if (idle.length) insights.push(`${idle.length} agent perlu reaktivasi (0 akad): ${idle.map((a) => a.name).join(", ")}.`);
  if (ev.booking > 0)
    insights.push(
      `Event/Walk-in: ${ev.akad} akad dari ${ev.booking} booking (${ev.conv}%)` +
        (ev.conv >= 50 ? " — konversi sehat, perbanyak undangan/open house." : " — konversi rendah, perbaiki follow-up pasca-event."),
    );

  return (
    <div className="md-grid2">
      <div>
        <h4 className="md-sub">Agent & Broker</h4>
        <table className="dtable">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Project</th>
              <th>Akad</th>
              <th>Total</th>
              <th>Conv</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.agents.map((a) => (
              <tr key={a.name}>
                <td>
                  <b>{a.name}</b>
                </td>
                <td className="muted">{a.project}</td>
                <td className="num">
                  <b>{a.akad}</b>
                </td>
                <td className="num">{a.total}</td>
                <td className="num">{a.conv}%</td>
                <td>
                  <Pill
                    color={a.status.includes("Need") ? "#D6453A" : a.status.includes("Low") ? "#D9930B" : "#1F9D54"}
                    bg={a.status.includes("Need") ? "#FBEAE8" : a.status.includes("Low") ? "#FCF4E2" : "#E8F6ED"}
                  >
                    {a.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="md-foot muted">
          Kontribusi agent: {agentAkad} akad ({contrib}% dari total). Target ≥15%.
        </p>
      </div>
      <div>
        <h4 className="md-sub">🤖 AI Insight — Agent Performance</h4>
        <div className="callout">
          <b>{ev.name}</b>
          <br />
          {ev.booking} booking · {ev.akad} akad · konversi {ev.conv}%
        </div>
        <ul className="md-insight">
          {insights.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Panel 10 — AI Alert ---------- */
const ORDER: Record<string, number> = { merah: 0, kuning: 1, hijau: 2 };
export function AlertDetail({ d }: { d: Dashboard }) {
  const sorted = [...d.alerts].sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  return (
    <div>
      <p className="md-lead">
        Prioritas eksekusi otomatis dari status data. Mulai dari <b style={{ color: "#D6453A" }}>KRITIS</b>, lalu{" "}
        <b style={{ color: "#B97F09" }}>RISIKO</b>, dan amankan <b style={{ color: "#1F9D54" }}>PELUANG</b>.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Prioritas</th>
            <th>Issue</th>
            <th>Command</th>
            <th>PIC</th>
            <th>Deadline</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a, i) => (
            <tr key={i}>
              <td>
                <Pill color={SEV[a.sev].c} bg={SEV[a.sev].bg}>
                  {SEV[a.sev].label}
                </Pill>
              </td>
              <td>
                <b>{a.title}</b>
                <div className="muted small">{a.detail}</div>
              </td>
              <td>{a.action}</td>
              <td className="muted">{a.pic}</td>
              <td>
                <b>{a.deadline}</b>
              </td>
              <td className="muted">{a.impact || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
