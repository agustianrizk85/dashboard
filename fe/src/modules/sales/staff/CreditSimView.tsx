import { useMemo, useState } from "react";
import { simulateCredit, rupiah, rupiahShort, DSR_LIMIT, type CreditInput } from "./credit";
import { Card, CurrencyInput, Field } from "./ui";
import "./staff.css";

/** Labelled slider row (reused for every numeric parameter). */
function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  fmt: (n: number) => string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="st-range">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="rv">{fmt(value)}</span>
      </div>
    </Field>
  );
}

/**
 * Simulasi Kredit (KPR) — a client-side mortgage calculator for sales staff to
 * run with a prospective buyer. Everything is computed locally (see credit.ts),
 * so results are instant and work even when the backend/AI is offline.
 */
export default function CreditSimView() {
  const [price, setPrice] = useState(500_000_000);
  const [dpPercent, setDpPercent] = useState(20);
  const [rateFixed, setRateFixed] = useState(5);
  const [fixedYears, setFixedYears] = useState(3);
  const [rateFloating, setRateFloating] = useState(11);
  const [tenorYears, setTenorYears] = useState(15);
  const [useFloating, setUseFloating] = useState(true);

  const input: CreditInput = { price, dpPercent, rateFixed, fixedYears, rateFloating: useFloating ? rateFloating : 0, tenorYears };
  const r = useMemo(() => simulateCredit(input), [price, dpPercent, rateFixed, fixedYears, rateFloating, tenorYears, useFloating]);
  const pctStr = (n: number) => n.toString().replace(".", ",") + "%";

  return (
    <div className="sales-staff">
      <div className="st-head">
        <h2>Simulasi Kredit (KPR)</h2>
        <p>
          Hitung estimasi angsuran, total bunga, dan penghasilan minimal untuk membantu konsumen memilih skema pembiayaan.
          Perhitungan dilakukan langsung di perangkat — hasilnya instan.
        </p>
      </div>

      <div className="st-grid">
        {/* ---- inputs ---- */}
        <Card title="Parameter Simulasi">
          <Field label="Harga rumah">
            <CurrencyInput value={price} onChange={setPrice} placeholder="500.000.000" />
          </Field>

          <Slider
            label="Uang muka (DP)"
            hint={`DP = ${rupiah(r.dp)} · Pokok pinjaman = ${rupiah(r.principal)}`}
            min={0}
            max={90}
            step={1}
            value={dpPercent}
            onChange={setDpPercent}
            fmt={(n) => n + "%"}
          />

          <Slider label="Tenor (jangka waktu)" min={1} max={30} step={1} value={tenorYears} onChange={setTenorYears} fmt={(n) => n + " th"} />

          <Field label="Suku bunga tetap (fixed)" hint={`Bunga tetap ${pctStr(rateFixed)} selama ${Math.min(fixedYears, tenorYears)} tahun pertama.`}>
            <div className="st-qm-inline">
              <div className="st-range" style={{ flex: 2 }}>
                <input type="range" min={0} max={15} step={0.25} value={rateFixed} onChange={(e) => setRateFixed(Number(e.target.value))} />
                <span className="rv">{pctStr(rateFixed)}</span>
              </div>
              <div className="st-range" style={{ flex: 1 }}>
                <input type="range" min={1} max={Math.max(1, tenorYears)} step={1} value={Math.min(fixedYears, tenorYears)} onChange={(e) => setFixedYears(Number(e.target.value))} />
                <span className="rv">{Math.min(fixedYears, tenorYears)} th</span>
              </div>
            </div>
          </Field>

          <Field label={<label className="st-check" style={{ margin: 0 }}><input type="checkbox" checked={useFloating} onChange={(e) => setUseFloating(e.target.checked)} /> Ada bunga floating setelah masa fixed</label>}>
            {useFloating ? (
              <div className="st-range" style={{ marginTop: 4 }}>
                <input type="range" min={5} max={18} step={0.25} value={rateFloating} onChange={(e) => setRateFloating(Number(e.target.value))} />
                <span className="rv">{pctStr(rateFloating)}</span>
              </div>
            ) : (
              <span />
            )}
          </Field>
        </Card>

        {/* ---- results ---- */}
        <Card title="Hasil Simulasi">
          {!r.valid ? (
            <div className="st-result-empty">Masukkan harga rumah dan tenor untuk melihat estimasi angsuran.</div>
          ) : (
            <>
              <div className="st-kpi-row">
                <div className="st-kpi hl">
                  <div className="k">Angsuran / bulan {r.hasFloating ? "(fixed)" : ""}</div>
                  <div className="v">{rupiahShort(r.installmentFixed)}</div>
                  <div className="sub">{rupiah(r.installmentFixed)}</div>
                </div>
                {r.hasFloating ? (
                  <div className="st-kpi">
                    <div className="k">Angsuran / bulan (floating)</div>
                    <div className="v">{rupiahShort(r.installmentFloating)}</div>
                    <div className="sub">setelah thn ke-{Math.min(fixedYears, tenorYears)}</div>
                  </div>
                ) : (
                  <div className="st-kpi">
                    <div className="k">Total bunga</div>
                    <div className="v">{rupiahShort(r.totalInterest)}</div>
                    <div className="sub">sepanjang tenor</div>
                  </div>
                )}
                <div className="st-kpi">
                  <div className="k">Penghasilan min.</div>
                  <div className="v">{rupiahShort(r.minIncome)}</div>
                  <div className="sub">DSR {Math.round(DSR_LIMIT * 100)}%</div>
                </div>
              </div>

              <div className="st-mini">
                <div>
                  <div className="k">Pokok pinjaman</div>
                  <div className="v">{rupiahShort(r.principal)}</div>
                </div>
                <div>
                  <div className="k">Total bunga</div>
                  <div className="v">{rupiahShort(r.totalInterest)}</div>
                </div>
                <div>
                  <div className="k">Total bayar</div>
                  <div className="v">{rupiahShort(r.totalPayment)}</div>
                </div>
              </div>

              <div className="st-table-wrap">
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>Tahun</th>
                      <th>Bunga</th>
                      <th>Angsuran/bln</th>
                      <th>Pokok</th>
                      <th>Bunga (thn)</th>
                      <th>Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.schedule.map((y) => (
                      <tr key={y.year}>
                        <td>Tahun {y.year}</td>
                        <td>{pctStr(y.rate)}</td>
                        <td>{rupiah(y.installment)}</td>
                        <td>{rupiahShort(y.principalPaid)}</td>
                        <td>{rupiahShort(y.interestPaid)}</td>
                        <td>{rupiahShort(y.endBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="st-disclaimer">
                * Estimasi memakai metode anuitas (angsuran tetap per periode bunga). Angka aktual dari bank dapat berbeda karena
                biaya provisi, asuransi, administrasi, dan kebijakan suku bunga. Penghasilan minimal memakai asumsi cicilan ≤ {Math.round(DSR_LIMIT * 100)}%
                dari penghasilan bersih.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
