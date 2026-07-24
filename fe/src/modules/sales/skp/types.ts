// Shared types for SKP (Surat Konfirmasi Pesanan — unit booking confirmation
// letter). Mirror the sales backend's domain shapes
// (backend/sales/internal/domain/skp.go).

export interface SkpProjectTemplate {
  _id: string;
  projectName: string;
  projectAddress: string;
  accountHolder: string;
  bankName: string;
  bankAccount: string;
  bankCode: string;
  bookingFee: number;
  marketingCity: string;
  active: boolean;
}

export interface SkpAddress {
  alamat: string;
  rtRw: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
}

export const emptySkpAddress: SkpAddress = { alamat: "", rtRw: "", kelurahan: "", kecamatan: "", kota: "" };

export type CaraBayar = "kpr" | "cash_keras" | "cash_bertahap";
export type BookingFeeVia = "transfer" | "tunai";

export interface Skp {
  _id: string;
  nomor?: string;

  nama: string;
  noKtp: string;
  alamatKtp: SkpAddress;
  alamatDomisili: SkpAddress;
  agama?: string;
  statusKawin?: string;
  pekerjaan?: string;
  alamatKantor: SkpAddress;
  noHp: string;
  noTelpKantor?: string;
  email?: string;
  sumberInfo?: string;

  bookingFee: number;
  bookingFeeVia: BookingFeeVia;

  projectTemplateId?: string;
  namaProyek: string;
  alamatProyek: string;
  typeUnit: string;
  blokNoUnit: string;
  luasTanah?: string;
  luasBangunan?: string;
  hargaJual: number;
  downPayment: number;
  promo?: string;
  caraBayar: CaraBayar;
  alasanPembelian?: string;

  accountHolder: string;
  bankName: string;
  bankAccount: string;
  bankCode: string;

  marketingName?: string;
  financeName?: string;
  signCity?: string;
  signDate?: string;

  by: string;
  byName: string;
  createdAt: string;
}

export const CARA_BAYAR_LABEL: Record<CaraBayar, string> = {
  kpr: "KPR",
  cash_keras: "Cash Keras",
  cash_bertahap: "Cash Bertahap",
};

export type UnitStatus = "tersedia" | "booked" | "akad" | "terjual" | "batal";

export interface UnitBooking {
  _id: string;
  namaProyek: string;
  typeUnit?: string;
  blokNoUnit: string;
  status: UnitStatus;
  skpId?: string;
  note?: string;
  updatedAt: string;
}

export const UNIT_STATUS_META: Record<UnitStatus, { label: string; c: string; bg: string }> = {
  tersedia: { label: "Tersedia", c: "#1F9D54", bg: "#E8F6ED" },
  booked: { label: "Booked", c: "#B97F09", bg: "#FCF4E2" },
  akad: { label: "Akad", c: "#1D5FBF", bg: "#E7F0FD" },
  terjual: { label: "Terjual", c: "#5A6B60", bg: "#ECEFEC" },
  batal: { label: "Akad Batal", c: "#B3261E", bg: "#FBE9E9" },
};

export function emptyUnitBooking(namaProyek = ""): UnitBooking {
  return { _id: "", namaProyek, typeUnit: "", blokNoUnit: "", status: "tersedia", updatedAt: "" };
}

export function emptySkp(): Skp {
  return {
    _id: "",
    nama: "",
    noKtp: "",
    alamatKtp: { ...emptySkpAddress },
    alamatDomisili: { ...emptySkpAddress },
    alamatKantor: { ...emptySkpAddress },
    noHp: "",
    bookingFee: 3_000_000,
    bookingFeeVia: "transfer",
    namaProyek: "",
    alamatProyek: "",
    typeUnit: "",
    blokNoUnit: "",
    hargaJual: 0,
    downPayment: 0,
    caraBayar: "kpr",
    accountHolder: "",
    bankName: "",
    bankAccount: "",
    bankCode: "",
    by: "",
    byName: "",
    createdAt: "",
  };
}
