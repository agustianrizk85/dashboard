// UI hints for the Marketing workflow. Mirrors backend service/catalog.go so the
// step form knows which metadata link-fields to render per step code, and maps
// alur / phase / owner to human labels and colours.

export interface MetadataField {
  key: string;
  label: string;
  type: "text" | "date" | "number";
}

// Human labels per alur (mirror of backend AlurLabels).
export const alurLabels: Record<string, string> = {
  A: "A · Iklan Berbayar — Konten Hardsell / Desain Statis",
  B: "B · Iklan Berbayar — Konten Video",
  C: "C · Konten Organik — Carousel",
  D: "D · Konten Organik — Video / Reels",
};

// Short label for chips / cards.
export const alurShort: Record<string, string> = {
  A: "Iklan · Hardsell",
  B: "Iklan · Video",
  C: "Organik · Carousel",
  D: "Organik · Reels",
};

// Macro phase labels (shared by every alur).
export const phaseLabels: Record<string, string> = {
  brief: "Brief",
  produksi: "Produksi",
  review: "Review & Revisi",
  approval: "Approval",
  distribusi: "Distribusi",
  done: "Selesai",
};

const t = (key: string, label: string, type: MetadataField["type"] = "text"): MetadataField => ({
  key,
  label,
  type,
});

// Link / structured fields collected per step (keys mirror catalog MetadataKeys).
export const stepMetadata: Record<string, MetadataField[]> = {
  // Alur A
  A1: [t("link_gambar_rumah", "Link Gambar Rumah (Perencanaan)")],
  A2: [t("link_brief", "Link Brief / Copy")],
  A3: [t("link_desain", "Link Hasil Desain")],
  A7: [t("tanggal_pengajuan", "Tanggal Pengajuan", "date")],
  A8: [t("platform", "Platform (Meta/Google)"), t("tanggal_topup", "Tanggal Top Up", "date")],
  A9: [t("link_meta_ads", "Link / ID Campaign Meta Ads"), t("tanggal_tayang", "Tanggal Tayang", "date")],
  // Alur B
  B1: [t("link_brief", "Link Brief Shooting")],
  B2: [t("link_footage_icloud", "Link Footage (iCloud)"), t("tanggal_shooting", "Tanggal Shooting", "date")],
  B4: [t("link_draft_video", "Link Draft Video")],
  B5: [t("link_render_animasi", "Link Render Animasi")],
  B9: [t("tanggal_pengajuan", "Tanggal Pengajuan", "date")],
  B10: [t("platform", "Platform (Meta/Google)"), t("tanggal_topup", "Tanggal Top Up", "date")],
  B11: [t("link_meta_ads", "Link / ID Campaign Meta Ads"), t("tanggal_tayang", "Tanggal Tayang", "date")],
  // Alur C
  C1: [t("link_brief", "Link Brief")],
  C2: [t("link_desain", "Link Desain Carousel")],
  C6: [t("caption", "Caption"), t("jadwal_posting", "Jadwal Posting", "date")],
  C7: [t("link_postingan", "Link Postingan")],
  // Alur D
  D1: [t("link_brief", "Link Brief")],
  D2: [t("link_footage_icloud", "Link Footage (iCloud)"), t("tanggal_shooting", "Tanggal Shooting", "date")],
  D4: [t("link_draft_video", "Link Draft Video")],
  D8: [t("caption", "Caption"), t("jadwal_posting", "Jadwal Posting", "date")],
  D9: [t("link_postingan", "Link Postingan")],
};

export function metadataFor(code: string): MetadataField[] {
  return stepMetadata[code] ?? [];
}
