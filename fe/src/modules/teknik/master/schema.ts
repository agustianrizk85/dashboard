// Declarative schema for the master-data (CRUD) screens. A single generic
// ResourceManager renders any of these configs. The model is relational
// (docs/DATA_MODEL.md): "ref" fields pick a related record by id.

export type FieldType = "text" | "number" | "textarea" | "select" | "tags" | "ref" | "file";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  /** For type "ref": the related resource key (e.g. "proyek") to pick an id from. */
  refResource?: string;
  /** For type "ref": which field of the related record to show as the option label. */
  refLabelField?: string;
  /** UI-only helper field: shown in form, NOT saved/imported/shown in table. */
  uiOnly?: boolean;
  /** For type "ref": filter options to records where record[refField] === value of byField. */
  filterBy?: { byField: string; refField: string };
  hideInTable?: boolean;
  /** Derived/computed field: shown but not editable, and excluded from imports. */
  readOnly?: boolean;
  tip?: string;
  result?: string;
}

export interface ResourceConfig {
  key: string;
  group?: string;
  title: string;
  singular: string;
  idEditable?: boolean;
  idLabel?: string;
  idTip?: string;
  fields: FieldDef[];
}

const STATUS_KAVLING = [
  { value: "SOLD", label: "SOLD" },
  { value: "READY STOCK", label: "READY STOCK" },
  { value: "AVAILABLE", label: "AVAILABLE" },
  { value: "SOLD MANAGEMENT", label: "SOLD MANAGEMENT" },
];

export const RESOURCES: ResourceConfig[] = [
  /* ===== MASTER ===== */
  {
    key: "clusters",
    group: "Master",
    title: "Cluster",
    singular: "Cluster",
    idEditable: true,
    idLabel: "ID Cluster",
    idTip: "Kode unik, mis. 'gp3'.",
    fields: [
      { name: "kode", label: "Kode", type: "text", tip: "Kode kawasan, mis. GP3.", result: "Label kawasan." },
      { name: "nama", label: "Nama Cluster", type: "text", tip: "Nama kawasan, mis. Green Park 3.", result: "Induk dari proyek." },
    ],
  },
  {
    key: "proyek",
    group: "Master",
    title: "Proyek",
    singular: "Proyek",
    idEditable: true,
    idLabel: "ID / Slug",
    idTip: "Kode unik proyek (huruf kecil), mis. 'verlim-3'.",
    fields: [
      { name: "nama", label: "Nama Proyek", type: "text", tip: "Nama proyek, mis. VERLIM 3.", result: "Judul proyek & pengelompokan unit." },
      { name: "clusterId", label: "Cluster", type: "ref", refResource: "clusters", refLabelField: "nama", tip: "Kawasan induk proyek.", result: "Relasi proyek → cluster." },
      { name: "kode", label: "Kode", type: "text", hideInTable: true, tip: "Kode singkat proyek.", result: "Identitas singkat." },
      { name: "spv", label: "SPV", type: "text", tip: "Nama SPV penanggung jawab proyek.", result: "PIC lapangan + tampil di dashboard." },
    ],
  },
  {
    key: "units",
    group: "Master",
    title: "Unit / Kavling",
    singular: "Unit",
    fields: [
      { name: "proyekId", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", tip: "Proyek induk unit.", result: "Relasi unit → proyek." },
      { name: "blok", label: "Blok", type: "text", tip: "Blok/kavling, mis. A1.", result: "Identitas unit." },
      { name: "type", label: "Type", type: "text", hideInTable: true, tip: "Tipe rumah, mis. CRYSTAL.", result: "Spesifikasi unit." },
      { name: "luasBangunan", label: "Luas Bangunan (m²)", type: "number", tip: "Luas bangunan (m²).", result: "Dasar nilai kontrak & laporan." },
      { name: "luasTanah", label: "Luas Tanah (m²)", type: "number", hideInTable: true, tip: "Luas tanah (m²).", result: "Spesifikasi kavling." },
      { name: "statusKavling", label: "Status Kavling", type: "select", options: STATUS_KAVLING, tip: "Status jual unit.", result: "Status kavling di laporan." },
    ],
  },
  {
    key: "kontraktor",
    group: "Master",
    title: "Kontraktor",
    singular: "Kontraktor",
    fields: [
      { name: "nama", label: "Nama Kontraktor", type: "text", tip: "Nama kontraktor/vendor.", result: "Dipakai di SPK & ranking kontraktor." },
    ],
  },
  /* ===== TRANSAKSI (urut alur bisnis) ===== */
  {
    key: "akad",
    group: "Transaksi",
    title: "Akad",
    singular: "Akad",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit yang diakad.", result: "Relasi akad → unit." },
      { name: "tglAkad", label: "Tgl Akad", type: "text", tip: "Tanggal akad (YYYY-MM-DD).", result: "Awal proses (Pola Bisnis)." },
    ],
  },
  {
    key: "ttd-gambar-kerja",
    group: "Transaksi",
    title: "Ttd Gambar Kerja",
    singular: "Ttd Gambar Kerja",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit terkait.", result: "Relasi → unit." },
      { name: "tglAcc", label: "Tgl ACC Gambar Kerja", type: "text", tip: "Tanggal ACC/TTD gambar kerja (YYYY-MM-DD).", result: "ACUAN MULAI hitung progres pembangunan." },
      { name: "tglTerbitSpk", label: "Tgl Terbit SPK", type: "text", hideInTable: true, tip: "Tanggal penerbitan SPK.", result: "Jembatan ke SPK." },
      { name: "lampiran", label: "Lampiran GK", type: "file", hideInTable: true, tip: "Upload file gambar kerja.", result: "Arsip gambar kerja." },
      { name: "keterangan", label: "Keterangan", type: "textarea", hideInTable: true, tip: "Catatan.", result: "Catatan." },
    ],
  },
  {
    key: "spk",
    group: "Transaksi",
    title: "SPK",
    singular: "SPK",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit yang dibangun.", result: "Relasi SPK → unit." },
      { name: "nomorSpk", label: "Nomor SPK", type: "text", tip: "Nomor surat perintah kerja.", result: "Identitas transaksi SPK." },
      { name: "kontraktorId", label: "Nama Kontraktor", type: "ref", refResource: "kontraktor", refLabelField: "nama", tip: "Kontraktor pelaksana.", result: "Relasi SPK → kontraktor & ranking." },
      { name: "tglTerbit", label: "Tgl Terbit SPK", type: "text", tip: "Tanggal terbit SPK (YYYY-MM-DD).", result: "Acuan penerbitan & target selesai." },
      { name: "tglSelesaiTarget", label: "Tgl Selesai SPK", type: "text", readOnly: true, tip: "Otomatis: Tgl Terbit + 5 bulan (target standar).", result: "Acuan target penyelesaian." },
      { name: "lbSpk", label: "LB SPK (m²)", type: "number", hideInTable: true, tip: "Luas bangunan SPK (m²).", result: "Dasar nilai kontrak." },
      { name: "hargaPerM2", label: "Harga per Meter", type: "number", hideInTable: true, tip: "Harga per m².", result: "Komponen nilai kontrak." },
      { name: "nilaiKontrak", label: "Nilai Kontrak", type: "number", readOnly: true, tip: "Otomatis: LB × Harga per meter.", result: "Nilai pekerjaan + ranking kontraktor." },
      { name: "layout", label: "Layout", type: "select", options: [
        { value: "STANDAR", label: "STANDAR" }, { value: "CUSTOM", label: "CUSTOM" },
      ], hideInTable: true, tip: "Layout standar/custom.", result: "Jenis layout." },
      { name: "nominalAddendum", label: "Nominal Addendum", type: "number", hideInTable: true, tip: "Nominal addendum (Rp).", result: "Penyesuaian nilai kontrak." },
    ],
  },
  {
    key: "progres-mingguan",
    group: "Transaksi",
    title: "Progres Mingguan",
    singular: "Progres",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit yang dilaporkan.", result: "Relasi progres → unit." },
      { name: "mingguKe", label: "Minggu Ke", type: "number", tip: "Minggu berjalan (1–20).", result: "Sumbu waktu Kurva S." },
      { name: "aktual", label: "Aktual (%)", type: "number", tip: "Progres aktual kumulatif (%).", result: "Realisasi pada Kurva S." },
      { name: "target", label: "Target (%)", type: "number", tip: "Target kumulatif (%) dari Kurva S.", result: "Pembanding deviasi/SPI." },
      { name: "linkFoto", label: "Foto Progres", type: "file", hideInTable: true, tip: "Upload foto progres — tersimpan otomatis di server.", result: "Lampiran bukti progres." },
      { name: "updatedBy", label: "Diupdate Oleh", type: "text", hideInTable: true, tip: "User penginput.", result: "Jejak audit." },
      { name: "tglUpdate", label: "Tgl Update", type: "text", hideInTable: true, tip: "Tanggal update (YYYY-MM-DD).", result: "Kebaruan data." },
    ],
  },
  {
    key: "bast-kontraktor",
    group: "Transaksi",
    title: "BAST Kontraktor (BAPP)",
    singular: "BAST Kontraktor",
    fields: [
      { name: "spkId", label: "SPK", type: "ref", refResource: "spk", refLabelField: "nomorSpk", tip: "SPK yang diserahterimakan.", result: "Relasi BAST → SPK." },
      { name: "tglSerahTerima", label: "Tgl Serah Terima", type: "text", tip: "Tanggal serah terima dari kontraktor (YYYY-MM-DD).", result: "Penutupan pekerjaan kontraktor." },
      { name: "linkFoto", label: "Lampiran Foto", type: "file", hideInTable: true, tip: "Upload foto serah terima.", result: "Bukti serah terima." },
      { name: "linkBapp", label: "Lampiran BAPP", type: "file", hideInTable: true, tip: "Upload form BAPP.", result: "Dokumen BAPP." },
      { name: "linkCeklis", label: "Lampiran Ceklis", type: "file", hideInTable: true, tip: "Upload form ceklis.", result: "Dokumen ceklis." },
    ],
  },
  {
    key: "bast-konsumen",
    group: "Transaksi",
    title: "BAST Konsumen",
    singular: "BAST Konsumen",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit yang diserahterimakan.", result: "Relasi BAST → unit." },
      { name: "tglBast", label: "Tgl BAST", type: "text", tip: "Tanggal serah terima ke konsumen (YYYY-MM-DD).", result: "Penutupan ke konsumen." },
      { name: "status", label: "Status", type: "select", options: [
        { value: "Belum BAST", label: "Belum BAST" }, { value: "Sudah BAST", label: "Sudah BAST" },
      ], tip: "Status serah terima.", result: "Status BAST." },
      { name: "lampiranFoto", label: "Lampiran Foto BAST", type: "file", hideInTable: true, tip: "Upload foto serah terima ke konsumen.", result: "Bukti BAST." },
      { name: "scanBerkas", label: "Scan Berkas BAST", type: "file", hideInTable: true, tip: "Upload scan berkas BAST.", result: "Arsip dokumen." },
    ],
  },
  {
    key: "komplain",
    group: "Transaksi",
    title: "Komplain",
    singular: "Komplain",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit yang dikomplain.", result: "Relasi komplain → unit." },
      { name: "tgl", label: "Tanggal", type: "text", tip: "Tanggal komplain (YYYY-MM-DD).", result: "Mulai aging." },
      { name: "keterangan", label: "Keterangan", type: "textarea", tip: "Isi komplain.", result: "Detail keluhan." },
      { name: "status", label: "Status", type: "select", options: [
        { value: "open", label: "Open" }, { value: "progress", label: "Progress" }, { value: "closed", label: "Closed" },
      ], tip: "Status penanganan.", result: "Status komplain." },
      { name: "aging", label: "Aging (hari)", type: "number", tip: "Umur komplain (hari).", result: "Indikator keterlambatan SLA." },
      { name: "link", label: "Link", type: "text", hideInTable: true, tip: "Tautan bukti/komplain.", result: "Lampiran." },
    ],
  },
  {
    key: "defect",
    group: "Transaksi",
    title: "Defect (QC)",
    singular: "Defect",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit dengan defect.", result: "Relasi defect → unit." },
      { name: "kategori", label: "Kategori", type: "text", tip: "Kategori defect (mis. Rembes, Retak).", result: "Pengelompokan defect." },
      { name: "status", label: "Status", type: "select", options: [
        { value: "open", label: "Open" }, { value: "closed", label: "Closed" },
      ], tip: "Status defect.", result: "Status QC." },
      { name: "aging", label: "Aging (hari)", type: "number", tip: "Umur defect (hari).", result: "Indikator keterlambatan." },
      { name: "repeat", label: "Berulang?", type: "select", options: [
        { value: "Tidak", label: "Tidak" }, { value: "Ya", label: "Ya" },
      ], tip: "Apakah defect berulang.", result: "Indikator mutu kronis." },
    ],
  },
  {
    key: "recovery-plan",
    group: "Transaksi",
    title: "Recovery Plan",
    singular: "Recovery Plan",
    fields: [
      { name: "proyekFilter", label: "Proyek", type: "ref", refResource: "proyek", refLabelField: "nama", uiOnly: true, tip: "Pilih proyek dulu untuk menyaring daftar unit." },
      { name: "unitId", label: "Unit", type: "ref", refResource: "units", refLabelField: "blok", filterBy: { byField: "proyekFilter", refField: "proyekId" }, tip: "Unit/proyek kritis.", result: "Relasi recovery → unit." },
      { name: "rootCause", label: "Root Cause", type: "textarea", tip: "Akar penyebab keterlambatan.", result: "Analisa penyebab (wajib bila Critical)." },
      { name: "targetPercepatan", label: "Target Percepatan", type: "text", tip: "Target percepatan (mis. +5%/minggu).", result: "Sasaran pemulihan." },
      { name: "status", label: "Status", type: "select", options: [
        { value: "open", label: "Open" }, { value: "progress", label: "Progress" }, { value: "done", label: "Done" },
      ], tip: "Status recovery.", result: "Progress pemulihan." },
    ],
  },
  /* ===== MASTER KONSTRUKSI (Kurva S) ===== */
  {
    key: "termin",
    group: "Master Konstruksi",
    title: "Termin",
    singular: "Termin",
    idEditable: true,
    idLabel: "ID Termin",
    idTip: "Kode unik, mis. 't1'.",
    fields: [
      { name: "no", label: "No", type: "number", tip: "Urutan termin (1–4).", result: "Urutan termin." },
      { name: "kode", label: "Kode", type: "text", tip: "Kode termin (T1–T4) — dipakai mengelompokkan Tahap Pembangunan.", result: "Penghubung ke tahap (header TERMIN di checklist)." },
      { name: "nama", label: "Nama Termin", type: "text", tip: "Nama termin, mis. Termin 1.", result: "Label termin." },
      { name: "bobotProgres", label: "Bobot Progres (%)", type: "number", tip: "Σ bobot tahap pada termin ini (%).", result: "Porsi progres fisik termin." },
      { name: "persenBayar", label: "% Pembayaran", type: "number", tip: "Persentase pembayaran saat termin ini tercapai.", result: "Acuan termin pembayaran SPK." },
      { name: "keterangan", label: "Keterangan", type: "textarea", hideInTable: true, tip: "Tahap yang termasuk termin ini.", result: "Penjelasan cakupan termin." },
    ],
  },
  {
    key: "construction-stages",
    group: "Master Konstruksi",
    title: "Tahap Pembangunan",
    singular: "Tahap",
    idEditable: true,
    idLabel: "ID Tahap",
    idTip: "Kode unik tahap, mis. 'cs-1'.",
    fields: [
      { name: "no", label: "No", type: "number", tip: "Urutan tahap (1–17).", result: "Urutan kolom checklist." },
      { name: "name", label: "Nama Tahap", type: "text", tip: "Nama tahap — kunci checklist unit. JANGAN rename.", result: "Kolom checklist & kunci status per unit." },
      { name: "weight", label: "Bobot (%)", type: "number", tip: "Bobot tahap (semua = 100%).", result: "Kontribusi % saat tahap dicentang." },
      { name: "termin", label: "Termin", type: "select", options: [
        { value: "T1", label: "Termin 1" }, { value: "T2", label: "Termin 2" },
        { value: "T3", label: "Termin 3" }, { value: "T4", label: "Termin 4" },
      ], tip: "Termin pembayaran.", result: "Pengelompokan header TERMIN." },
    ],
  },
  {
    key: "work-items",
    group: "Master Konstruksi",
    title: "Bobot Pekerjaan (Kurva S)",
    singular: "Item",
    idEditable: true,
    idLabel: "ID Item",
    idTip: "Kode unik item, mis. 'wi-1'.",
    fields: [
      { name: "no", label: "No", type: "number", tip: "Urutan item.", result: "Urutan master bobot." },
      { name: "name", label: "Nama Pekerjaan", type: "text", tip: "Nama item (mis. Pondasi & Beton).", result: "Item pada Kurva S." },
      { name: "weight", label: "Bobot (%)", type: "number", tip: "Bobot item (semua = 100%).", result: "Kontribusi ke kurva rencana." },
    ],
  },
  {
    key: "kurva-weekly",
    group: "Master Konstruksi",
    title: "Kurva S Mingguan",
    singular: "Minggu",
    idEditable: true,
    idLabel: "ID Minggu",
    idTip: "Kode unik minggu, mis. 'kw-1'.",
    fields: [
      { name: "week", label: "Minggu Ke", type: "number", tip: "Minggu (1–20).", result: "Sumbu X kurva rencana." },
      { name: "weight", label: "Bobot (%)", type: "number", tip: "Target bobot minggu ini.", result: "Kenaikan kurva per minggu." },
      { name: "cumulative", label: "Kumulatif (%)", type: "number", tip: "Target kumulatif s/d minggu ini.", result: "Garis RENCANA pada Kurva S." },
    ],
  },
  /* ===== CHECKLIST ===== */
  {
    key: "progress-units",
    group: "Checklist",
    title: "Unit Progress (checklist)",
    singular: "Unit",
    idEditable: true,
    idLabel: "ID Unit",
    idTip: "Kode unik unit, mis. 'pu-1'.",
    fields: [
      { name: "noInduk", label: "No. Induk", type: "text", tip: "Nomor induk unit.", result: "Identitas baris di Cek List Progress." },
      { name: "project", label: "Nama Proyek", type: "text", tip: "Proyek/cluster unit.", result: "Filter proyek di grid checklist." },
      { name: "blok", label: "Blok", type: "text", tip: "Blok/kavling unit.", result: "Identitas unit di grid." },
      { name: "tglSpk", label: "Tgl SPK", type: "text", hideInTable: true, tip: "Tanggal SPK (YYYY-MM-DD).", result: "Acuan mulai." },
      { name: "tglSpkFinish", label: "Tgl SPK Finish", type: "text", hideInTable: true, tip: "Target selesai (YYYY-MM-DD).", result: "Acuan target." },
      { name: "status", label: "Status Kavling", type: "select", options: STATUS_KAVLING, tip: "Status jual unit.", result: "Label status di grid." },
      { name: "keterangan", label: "Keterangan", type: "textarea", hideInTable: true, tip: "Catatan progres. Centang tahap di tab Cek List Progress.", result: "Keterangan progres di grid." },
    ],
  },
];
