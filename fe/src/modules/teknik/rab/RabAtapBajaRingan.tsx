import { useEffect, useMemo, useState } from "react";
import {
  computeRAB,
  DEFAULT_INPUT,
  DEFAULT_PRICES,
  ROOF_COVERS,
  fmtRp,
  fmtNum,
  type RabInput,
} from "../lib/rabAtap";
import { aiAnalyze, aiConfigured, aiParseSpec } from "./aiRab";
import "./rab.css";

/** Small labelled numeric field. */
function Num({
  label,
  unit,
  value,
  onChange,
  step = 0.1,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="rab-field">
      <span className="rab-flabel">{label}</span>
      <span className="rab-inwrap">
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}

/** Read-only computed row. */
function Out({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rab-field">
      <span className="rab-flabel">{label}</span>
      <span className="rab-out">
        <b>{value}</b>
        {unit && <em>{unit}</em>}
      </span>
    </div>
  );
}

export function RabAtapBajaRingan() {
  const [input, setInput] = useState<RabInput>(DEFAULT_INPUT);
  const [prices, setPrices] = useState<Record<string, number>>({ ...DEFAULT_PRICES });

  const set = <K extends keyof RabInput>(k: K, v: RabInput[K]) => setInput((s) => ({ ...s, [k]: v }));
  const setPrice = (id: string, v: number) => setPrices((p) => ({ ...p, [id]: v }));

  const cover = ROOF_COVERS.find((c) => c.key === input.cover) ?? ROOF_COVERS[0];
  const R = useMemo(() => computeRAB(input, prices), [input, prices]);
  const { geometry: g, recap: r, lines } = R;

  // ---- AI ----
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCfg, setAiCfg] = useState<{ configured: boolean; model: string } | null>(null);
  const [spec, setSpec] = useState("");
  const [aiBusy, setAiBusy] = useState<"fill" | "analyze" | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [aiErr, setAiErr] = useState("");

  useEffect(() => {
    if (aiOpen && aiCfg === null) aiConfigured().then(setAiCfg);
  }, [aiOpen, aiCfg]);

  async function doFill() {
    if (!spec.trim()) return;
    setAiBusy("fill");
    setAiErr("");
    try {
      const patch = await aiParseSpec(spec.trim());
      if (Object.keys(patch).length === 0) throw new Error("AI tidak menemukan parameter");
      setInput((s) => ({ ...s, ...patch }));
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "Gagal memproses AI");
    } finally {
      setAiBusy(null);
    }
  }

  async function doAnalyze() {
    setAiBusy("analyze");
    setAiErr("");
    setAnalysis("");
    try {
      setAnalysis(await aiAnalyze(input, R));
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "Gagal analisa AI");
    } finally {
      setAiBusy(null);
    }
  }

  const tenaga = lines.filter((l) => l.kind === "tenaga");
  const bahan = lines.filter((l) => l.kind === "bahan");

  return (
    <div className="rab-root">
      <div className="rab-titlebar">
        <div className="rab-brand">
          <span className="rab-logo">▩</span> RAB<span className="rab-brand-2">Pro</span>
        </div>
        <div className="rab-title">AHSP PUPR TAHUN 2026</div>
        <button className={"rab-ai-btn" + (aiOpen ? " on" : "")} onClick={() => setAiOpen((o) => !o)}>
          ✨ AI
        </button>
        <button className="rab-print" onClick={() => window.print()}>
          🖨 Cetak
        </button>
      </div>

      {aiOpen && (
        <div className="rab-ai">
          <div className="rab-ai-row">
            <textarea
              className="rab-ai-spec"
              rows={2}
              placeholder="Deskripsikan bangunan… mis. 'rumah 8×15 m, atap pelana genteng metal, tinggi kuda-kuda 2 m, overstek 1 m'"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
            />
            <div className="rab-ai-actions">
              <button className="rab-ai-do" disabled={aiBusy !== null || !spec.trim()} onClick={doFill}>
                {aiBusy === "fill" ? "Mengisi…" : "Isi Otomatis"}
              </button>
              <button className="rab-ai-do ghost" disabled={aiBusy !== null} onClick={doAnalyze}>
                {aiBusy === "analyze" ? "Menganalisa…" : "Analisa RAB"}
              </button>
            </div>
          </div>
          {aiCfg && !aiCfg.configured && (
            <div className="rab-ai-hint">⚠ Kunci AI belum diatur (Panel Admin → Kunci AI). Fitur AI belum aktif.</div>
          )}
          {aiErr && <div className="rab-ai-err">{aiErr}</div>}
          {analysis && <div className="rab-ai-out">{renderInsight(analysis)}</div>}
        </div>
      )}

      <h3 className="rab-h">11. PEKERJAAN ATAP PELANA BAJA RINGAN</h3>

      {/* ---- Row: 11.1 + 11.2 ---- */}
      <div className="rab-grid2">
        <section className="rab-panel">
          <div className="rab-phead">11.1 · Dimensi Utama</div>
          <Num label="Lebar bangunan" unit="m" value={input.lebar} onChange={(v) => set("lebar", v)} />
          <Num label="Panjang bangunan" unit="m" value={input.panjang} onChange={(v) => set("panjang", v)} />
          <Num label="Tinggi kuda-kuda" unit="m" value={input.tinggiKuda} onChange={(v) => set("tinggiKuda", v)} />
          <Num label="Overstek lebar" unit="m" value={input.overstekLebar} onChange={(v) => set("overstekLebar", v)} />
          <Num label="Overstek panjang" unit="m" value={input.overstekPanjang} onChange={(v) => set("overstekPanjang", v)} />
          <Num label="Jarak kuda-kuda" unit="m" value={input.jarakKuda} onChange={(v) => set("jarakKuda", v)} />

          <div className="rab-subhead">Geometri & Luas Atap</div>
          <Out label="Kemiringan atap" value={fmtNum(g.kemiringanDeg, 1)} unit="°" />
          <Out label="Panjang bidang miring" value={fmtNum(g.panjangBidangMiring)} unit="m" />
          <Out label="Panjang miring overstek" value={fmtNum(g.panjangMiringOverstek)} unit="m" />
          <Out label="Jumlah kuda-kuda" value={fmtNum(g.jumlahKuda, 0)} unit="set" />
          <Out label="Total Luas Atap" value={fmtNum(g.luasAtap)} unit="m²" />
        </section>

        <section className="rab-panel">
          <div className="rab-phead">11.2 · Pilihan Struktur</div>
          <label className="rab-field">
            <span className="rab-flabel">Jenis penutup atap</span>
            <select
              className="rab-select"
              value={input.cover}
              onChange={(e) => {
                const c = ROOF_COVERS.find((x) => x.key === e.target.value)!;
                setInput((s) => ({ ...s, cover: c.key, jarakReng: c.jarakReng }));
              }}
            >
              {ROOF_COVERS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <Out label="Luas efektif penutup" value={fmtNum(cover.luasEfektif)} unit={"m²/" + cover.satuanPenutup} />
          <Num label="Jarak antar reng" unit="m" step={0.005} value={input.jarakReng} onChange={(v) => set("jarakReng", v)} />

          <div className="rab-subhead">Rekap Bahan</div>
          <Out label="Panjang Profil C75" value={fmtNum(r.panjangC75)} unit="m" />
          <Out label="Jumlah batang C75" value={fmtNum(r.batangC75, 0)} unit="btg" />
          <Out label="Jumlah Reng" value={fmtNum(r.batangReng, 0)} unit="btg" />
          <Out label="Panjang Reng" value={fmtNum(r.panjangReng)} unit="m" />
          <Out label="Panjang Listplank" value={fmtNum(r.panjangListplank)} unit="m" />
          <Out label="Panjang Nok" value={fmtNum(r.panjangNok)} unit="m" />
        </section>
      </div>

      {/* ---- 11.3 harga satuan ---- */}
      <section className="rab-panel rab-tablewrap">
        <div className="rab-phead">11.3 · Harga Satuan Upah &amp; Bahan</div>
        <div className="rab-tscroll">
          <table className="rab-table">
            <thead>
              <tr>
                <th className="l">Uraian</th>
                <th className="r">Volume</th>
                <th>Satuan</th>
                <th className="r">Harga Satuan (Rp)</th>
                <th className="r">Jumlah Harga (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {tenaga.map((l) => (
                <Row key={l.id} l={l} onPrice={(v) => setPrice(l.id, v)} />
              ))}
              <tr className="rab-subtotal">
                <td colSpan={4}>Jumlah Harga Tenaga Kerja</td>
                <td className="r">{fmtRp(R.totalTenaga)}</td>
              </tr>
              <tr className="rab-group">
                <td colSpan={5}>BAHAN</td>
              </tr>
              {bahan.map((l) => (
                <Row key={l.id} l={l} onPrice={(v) => setPrice(l.id, v)} />
              ))}
              <tr className="rab-subtotal">
                <td colSpan={4}>Jumlah Harga Bahan</td>
                <td className="r">{fmtRp(R.totalBahan)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rab-total">
          <div className="rab-total-l">TOTAL</div>
          <div className="rab-total-r">
            <div className="rab-total-num">{fmtRp(R.total)}</div>
            <div className="rab-total-sub">Biaya Pekerjaan (1 unit)</div>
          </div>
        </div>
      </section>

      <p className="rab-note">
        Volume dihitung otomatis dari dimensi &amp; geometri atap pelana; harga satuan dapat diubah langsung di
        tabel. Koefisien takeoff (C75 per m², jarak reng, upah OH/m², dll) ada di{" "}
        <code>lib/rabAtap.ts</code> — sesuaikan bila AHSP internal berbeda.
      </p>
    </div>
  );
}

/** Render AI insight text as clean bullet lines / sub-headings. */
function renderInsight(text: string) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div className="rab-ai-list">
      {lines.map((l, i) => {
        const clean = l.replace(/^\s*[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").replace(/^#+\s*/, "");
        const isHead = /:$/.test(clean) && clean.length < 64;
        return (
          <div key={i} className={isHead ? "rab-ai-head" : "rab-ai-item"}>
            {clean}
          </div>
        );
      })}
    </div>
  );
}

function Row({ l, onPrice }: { l: { uraian: string; satuan: string; volume: number; harga: number }; onPrice: (v: number) => void }) {
  const jumlah = l.volume * l.harga;
  return (
    <tr>
      <td className="l">{l.uraian}</td>
      <td className="r">{l.volume > 0 ? fmtNum(l.volume) : "-"}</td>
      <td>{l.satuan}</td>
      <td className="r">
        <input
          className="rab-price"
          type="number"
          step={100}
          value={l.harga}
          onChange={(e) => onPrice(parseFloat(e.target.value) || 0)}
        />
      </td>
      <td className="r">{jumlah > 0 ? fmtRp(jumlah) : "-"}</td>
    </tr>
  );
}
