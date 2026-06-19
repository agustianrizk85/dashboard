// UI hints for structured step data. Mirrors backend service/catalog.go so the
// form knows which metadata fields and document slots to render per step code.

export interface MetadataField {
  key: string;
  label: string;
  type: "text" | "date" | "number";
}

interface StepHints {
  metadata?: MetadataField[];
  docTypes?: string[];
}

// Human labels per macro category (mirror of backend CategoryLabels).
export const categoryLabels: Record<string, string> = {
  A: "A · Pra-Akad Lahan (Simultan)",
  B: "B · Akad Lahan (Kesinambungan)",
  C: "C · Permit Pasca Akad Lahan",
  D: "D · Legal Pasca Akad Lahan",
  F: "F · Master Data PKS Bank",
  H: "H · Flow Bisnis PKS Bank",
};

const t = (key: string, label: string, type: MetadataField["type"] = "text"): MetadataField => ({
  key,
  label,
  type,
});

export const stepHints: Record<string, StepHints> = {
  // A
  A5: {
    metadata: [t("nama_rt_rw", "Nama RT / RW"), t("alamat_lahan", "Alamat Lahan"), t("tanggal", "Tanggal", "date")],
  },
  A6: { docTypes: ["KTP", "KK", "NPWP", "Buku Nikah", "Lainnya"] },
  A7: { docTypes: ["SHM", "PBB", "Lainnya"] },
  // B
  B2: { metadata: [t("tanggal_meeting", "Tanggal Meeting", "date"), t("notaris", "Notaris"), t("catatan", "Catatan")] },
  B3: {
    metadata: [
      t("biaya_akta_notaris", "Biaya Akta Notaris (Rp)", "number"),
      t("biaya_pph", "Biaya PPh (Rp)", "number"),
      t("biaya_bphtb", "Biaya BPHTB (Rp)", "number"),
      t("biaya_ditanggung_para_pihak", "Biaya Ditanggung Para Pihak"),
      t("pt_yang_dipakai", "PT yang Dipakai"),
    ],
  },
  B4: { docTypes: ["Akta KSO", "Akta Kuasa Jual", "Akta Kuasa Mengelola Lahan", "Akta PPJB Termin"] },
  // C
  C1: { docTypes: ["KTP Warga & RT/RW", "Izin Tetangga", "Surat Kompensasi", "Kwitansi"] },
  C13: { metadata: [t("nama_izin", "Nama Izin"), t("catatan", "Catatan")] },
  // F
  F1: { metadata: [t("gdrive_folder_link", "Link Folder Gdrive (share)")] },
  F2: { docTypes: ["Formulir PKS Bank"] },
  // H
  H1: { metadata: [t("gdrive_link", "Link Gdrive"), t("tanggal_serah", "Tanggal Serah", "date"), t("nama_bank", "Nama Bank")] },
  H2: { metadata: [t("catatan_survei", "Catatan Survei"), t("tanggal_survei", "Tanggal Survei", "date")], docTypes: ["Foto Survei"] },
  H3: { metadata: [t("catatan_revisi", "Catatan Revisi")] },
  H4: { metadata: [t("tanggal_ttd", "Tanggal TTD", "date")] },
  H5: { docTypes: ["Salinan Akta PKS Bank"] },
};

export function hintsFor(code: string): StepHints {
  return stepHints[code] ?? {};
}

// Document types eligible for OCR auto-fill.
export const ocrDocTypes = ["KTP", "KK", "NPWP", "SHM", "PBB"];
