// Pure KPR (mortgage) simulation math for the Simulasi Kredit tool. No backend:
// it runs entirely client-side so staff get instant results while sitting with a
// prospective buyer. Supports the common Indonesian fixed→floating scheme (a
// fixed rate for the first N years, then a floating rate re-amortised on the
// remaining balance).

export interface CreditInput {
  price: number; // harga rumah (Rp)
  dpPercent: number; // uang muka (% dari harga)
  rateFixed: number; // suku bunga tetap (% per tahun)
  fixedYears: number; // lama masa bunga tetap (tahun)
  rateFloating: number; // suku bunga floating (% per tahun); 0 = tanpa floating
  tenorYears: number; // tenor total (tahun)
}

export interface YearRow {
  year: number;
  rate: number; // annual rate applied that year (%)
  installment: number; // monthly installment during that year
  principalPaid: number; // principal repaid during the year
  interestPaid: number; // interest paid during the year
  endBalance: number; // outstanding principal at year end
}

export interface CreditResult {
  dp: number; // uang muka (Rp)
  principal: number; // pokok pinjaman (Rp)
  installmentFixed: number; // angsuran/bln selama masa fixed
  installmentFloating: number; // angsuran/bln setelah fixed (0 bila tanpa floating)
  hasFloating: boolean;
  totalInterest: number; // total bunga sepanjang tenor (Rp)
  totalPayment: number; // pokok + bunga (Rp)
  minIncome: number; // estimasi penghasilan minimal (DSR 35%)
  schedule: YearRow[]; // ringkasan amortisasi per tahun
  valid: boolean;
}

/** Level monthly payment (annuity) for a loan; 0 for non-positive inputs. */
export function monthlyAnnuity(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Ratio of installment to income banks typically allow (Debt Service Ratio). */
export const DSR_LIMIT = 0.35;

export function simulateCredit(inp: CreditInput): CreditResult {
  const price = Math.max(0, inp.price || 0);
  const dp = (price * clamp(inp.dpPercent || 0, 0, 100)) / 100;
  const principal = Math.max(0, price - dp);
  const totalMonths = Math.round((inp.tenorYears || 0) * 12);
  const fixedMonths = Math.min(Math.round((inp.fixedYears || 0) * 12), totalMonths);
  const hasFloating = (inp.rateFloating || 0) > 0 && fixedMonths < totalMonths;

  const iFixed = (inp.rateFixed || 0) / 100 / 12;
  const iFloat = ((hasFloating ? inp.rateFloating : inp.rateFixed) || 0) / 100 / 12;

  // Bank convention: the fixed-period installment is the full-tenor annuity at the
  // fixed rate; when floating kicks in we re-amortise the remaining balance.
  const installmentFixed = monthlyAnnuity(principal, iFixed, totalMonths);

  let balance = principal;
  let installment = installmentFixed;
  let installmentFloating = 0;
  let totalInterest = 0;
  const yearly = new Map<number, { rate: number; inst: number; p: number; i: number; bal: number }>();

  for (let m = 1; m <= totalMonths && balance > 0.005; m++) {
    if (hasFloating && m === fixedMonths + 1) {
      installment = monthlyAnnuity(balance, iFloat, totalMonths - fixedMonths);
      installmentFloating = installment;
    }
    const rate = hasFloating && m > fixedMonths ? iFloat : iFixed;
    const interest = balance * rate;
    let principalPay = installment - interest;
    if (principalPay > balance) principalPay = balance; // final month rounding
    balance -= principalPay;
    totalInterest += interest;

    const y = Math.ceil(m / 12);
    const row = yearly.get(y) ?? { rate: rate * 12 * 100, inst: installment, p: 0, i: 0, bal: balance };
    row.p += principalPay;
    row.i += interest;
    row.bal = balance;
    row.inst = installment;
    row.rate = rate * 12 * 100;
    yearly.set(y, row);
  }

  const schedule: YearRow[] = [...yearly.entries()].map(([year, r]) => ({
    year,
    rate: Math.round(r.rate * 10) / 10,
    installment: Math.round(r.inst),
    principalPaid: Math.round(r.p),
    interestPaid: Math.round(r.i),
    endBalance: Math.max(0, Math.round(r.bal)),
  }));

  const maxInstallment = Math.max(installmentFixed, installmentFloating);
  return {
    dp: Math.round(dp),
    principal: Math.round(principal),
    installmentFixed: Math.round(installmentFixed),
    installmentFloating: Math.round(installmentFloating),
    hasFloating,
    totalInterest: Math.round(totalInterest),
    totalPayment: Math.round(principal + totalInterest),
    minIncome: Math.round(maxInstallment / DSR_LIMIT),
    schedule,
    valid: principal > 0 && totalMonths > 0,
  };
}

/* ---------- currency helpers for the staff tools ---------- */

const idr = new Intl.NumberFormat("id-ID");

/** Full Rupiah with thousands separators, e.g. "Rp 1.234.567". */
export function rupiah(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "Rp 0";
  return "Rp " + idr.format(Math.round(n));
}

/** Compact Rupiah, e.g. "Rp 1,2 M" / "Rp 850 jt". */
export function rupiahShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "Rp " + (n / 1e9).toFixed(2).replace(".", ",") + " M";
  if (abs >= 1e6) return "Rp " + (n / 1e6).toFixed(1).replace(".", ",") + " jt";
  if (abs >= 1e3) return "Rp " + Math.round(n / 1e3) + " rb";
  return rupiah(n);
}

/** Parse a formatted currency/number string to a number (digits only). */
export function parseDigits(s: string): number {
  const d = (s || "").replace(/[^\d]/g, "");
  return d ? Number(d) : 0;
}
