import { RESOURCES } from "../master/schema";

interface Step {
  n: number;
  title: string;
  desc: string;
}

const FLOW: Step[] = [
  { n: 1, title: "Sumber: Google Sheet Monitoring", desc: "Sumber data UTAMA adalah spreadsheet \"DASHBOARD MONITORING PROGRES PEMBANGUNAN UNIT RUMAH\" milik tim Teknik. Server menariknya otomatis (auto-sync) di tab Sync Spreadsheet — semua angka dashboard berasal dari sini, bukan diketik ulang." },
  { n: 2, title: "Auto-sync → ke Dashboard", desc: "Tiap interval (atur 30 detik–60 menit di Sync Spreadsheet), server membaca SEMUA tab sheet, mendeteksi blok master per-unit lewat judul kolom (NAMA PROYEK + BLOK), menggabungkan data unit yang sama dari beberapa tab, lalu memperbarui dashboard live (tanpa refresh, lewat WebSocket)." },
  { n: 3, title: "Progress Unit (dari kolom % di sheet)", desc: "Progres tiap unit diambil dari kolom PROGRES PEMBANGUNAN (%) di sheet, lalu dipetakan ke 17 tahap pembangunan berbobot (Termin 1–4) untuk Cek List Progress. Bobot tahap = template metodologi tetap (bukan dari sheet)." },
  { n: 4, title: "Pantau Progres Proyek", desc: "Tiap proyek: Actual (rata-rata progres unit dari sheet) dibanding Baseline/Target. Selisihnya (deviasi) menentukan status On Track / At Risk / Off Track + keterlambatan — dihitung otomatis oleh server." },
  { n: 5, title: "Nilai Performa Kontraktor", desc: "Kontraktor (kolom NAMA KONTRAKTOR) diranking dari jumlah SPK, nilai kontrak, progres & keterlambatan unit yang dikerjakannya." },
  { n: 6, title: "Quality Control (Mutu & Defect)", desc: "Komplain & defect. Catatan: data ini BELUM ada di sheet monitoring — diisi manual via Master Data (komplain/defect/recovery-plan)." },
  { n: 7, title: "Kurva S & Deviasi", desc: "Kurva S baseline (rencana 20 minggu) + bobot 12 item pekerjaan diambil dari tab \"Kurva S\" di sheet. Progres aktual unit (kolom % di sheet) dibanding baseline → deviasi, status (Sangat Cepat…Critical Delay), SPI, forecast. Deviasi ≤ −5% wajib Recovery Plan." },
  { n: 8, title: "Kesiapan BAST (Site & Handover)", desc: "Status & tanggal BAST diambil dari kolom STATUS BAST KONSUMEN / TGL BAST KONSUMEN di sheet." },
  { n: 9, title: "KPI Direksi", desc: "KPI (SPI, deviasi, on-time, QC) dihitung dari data di atas, dengan ambang Hijau/Kuning/Merah sebagai alat kontrol pimpinan." },
];

// SOURCES maps each dashboard figure to where it actually comes from, so it is
// clear what is read straight from the sheet, what is a fixed methodology
// template, and what is computed by the server.
const SOURCES: { item: string; src: string; kind: "Sheet" | "Hitungan" | "Template" | "Manual" }[] = [
  { item: "Proyek · Blok · Type · Status Kavling", src: "Kolom NAMA PROYEK · BLOK · TYPE · STATUS KAVLING / UNIT", kind: "Sheet" },
  { item: "SPK: Nomor · Tgl · Kontraktor · Nilai Kontrak", src: "Kolom NOMOR SPK · TGL SPK · NAMA KONTRAKTOR · NILAI KONTRAK PER (m2)", kind: "Sheet" },
  { item: "Progres aktual per unit (%)", src: "Kolom PROGRES PEMBANGUNAN (%) — dipetakan ke 17 tahap (Cek List)", kind: "Sheet" },
  { item: "Target / rencana per unit (%)", src: "Kolom TARGET PEMBANGUNAN (%)", kind: "Sheet" },
  { item: "Status BAST · Tgl BAST", src: "Kolom STATUS BAST KONSUMEN · TGL BAST KONSUMEN", kind: "Sheet" },
  { item: "Status terlambat", src: "Kolom STATUS PEMBANGUNAN (Terlambat / Belum Terlambat)", kind: "Sheet" },
  { item: "Kurva S baseline (rencana, 20 minggu)", src: "Tab \"Kurva S\" — baris RENCANA (kumulatif per minggu)", kind: "Sheet" },
  { item: "Bobot Pekerjaan (12 item RAB)", src: "Tab \"Kurva S\" — ITEM PEKERJAAN + bobot per minggu", kind: "Sheet" },
  { item: "Komplain", src: "Kolom KOMPLAIN · KETERANGAN KOMPLAIN di master", kind: "Sheet" },
  { item: "Deviasi · SPI · Overall · On/At Risk (agregat)", src: "Dihitung server dari data sheet (progres % vs Kurva S baseline)", kind: "Hitungan" },
  { item: "Checklist 17 tahap (BOWPLANK…) · Defect · Recovery", src: "Metodologi/penyesuaian — belum ada di sheet (sheet pakai 12 item pekerjaan)", kind: "Manual" },
];

const TOOLS = [
  { label: "Sync Spreadsheet (utama)", desc: "Sumber data utama: tarik dari Google Sheet monitoring. Bisa otomatis (auto-sync, pilih interval 30 detik–60 menit) atau manual (Tarik & Preview → Terapkan). Hasil mengganti seluruh data unit/SPK/progres, bisa di-rollback." },
  { label: "Input manual (Master Data)", desc: "Override/lengkapi data yang belum ada di sheet (mis. komplain, defect, recovery): tombol ＋ Tambah di tiap tabel, tiap field ada tooltip ⓘ." },
  { label: "Import / Contoh / Export (Excel)", desc: "Alternatif: unduh template .xlsx, isi, lalu Import massal; atau Export isi tabel ke .xlsx." },
  { label: "Centang tahap (Cek List Progress)", desc: "Penyesuaian manual per unit — centang tahap selesai → % progres ikut berubah." },
  { label: "Seed data contoh", desc: "Pulihkan data contoh bawaan (untuk demo/uji)." },
  { label: "Hapus semua data", desc: "Kosongkan seluruh data (mulai dari nol). Akun login tetap aman; auto-sync akan mengisi lagi dari sheet pada siklus berikutnya." },
];

export function ProsesBisnis() {
  return (
    <div className="pb-wrap">
      <div className="pb-intro">
        <h2>Proses Bisnis — Dashboard Teknik</h2>
        <p>
          Satu layar kendali Departemen Teknik: dari pemantauan progres pembangunan dan kontraktor, mutu &amp; komplain,
          kesiapan site/handover, sampai KPI dan keputusan. <b>Sumber data utama = Google Sheet monitoring yang ditarik
          otomatis (auto-sync)</b>; sebagian kecil (komplain/defect) diisi manual. Halaman ini menjelaskan <b>alur kerjanya</b> dan
          <b> dari mana tiap data berasal</b>.
        </p>
      </div>

      <div className="pb-section-h">Sumber Data (dari mana datanya)</div>
      <p className="pb-note">
        Hampir semua angka di dashboard berasal dari spreadsheet <b>"DASHBOARD MONITORING PROGRES PEMBANGUNAN UNIT RUMAH"</b>{" "}
        yang ditarik otomatis (lihat tab <b>Sync Spreadsheet</b>). Berikut peta tiap data:
      </p>
      <div className="pb-cards">
        <div className="pb-card" style={{ gridColumn: "1 / -1" }}>
          <table className="pb-table">
            <thead>
              <tr>
                <th>Data di Dashboard</th>
                <th>Sumber</th>
                <th>Jenis</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.item}>
                  <td className="pb-f">{s.item}</td>
                  <td>{s.src}</td>
                  <td className="pb-r">{s.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pb-section-h">Alur Kerja</div>
      <div className="pb-flow">
        {FLOW.map((s, i) => (
          <div className="pb-step" key={s.n}>
            <div className="pb-step-n">{s.n}</div>
            <div className="pb-step-body">
              <div className="pb-step-title">{s.title}</div>
              <div className="pb-step-desc">{s.desc}</div>
            </div>
            {i < FLOW.length - 1 && <div className="pb-step-line" />}
          </div>
        ))}
      </div>

      <div className="pb-section-h">Cara Input Data (per data)</div>
      <p className="pb-note">
        Buka tab <b>Master Data</b>, pilih jenis data di kiri, klik <b>＋ Tambah</b>, lalu isi field berikut. Tiap field
        juga punya tooltip <b>ⓘ</b> saat mengisi form.
      </p>
      <div className="pb-cards">
        {RESOURCES.map((r) => (
          <div className="pb-card" key={r.key}>
            <div className="pb-card-h">{r.title}</div>
            <table className="pb-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Cara isi</th>
                  <th>Hasilnya</th>
                </tr>
              </thead>
              <tbody>
                {r.fields.map((f) => (
                  <tr key={f.name}>
                    <td className="pb-f">{f.label}</td>
                    <td>{f.tip ?? "—"}</td>
                    <td className="pb-r">{f.result ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="pb-section-h">Alat Data</div>
      <div className="pb-tools">
        {TOOLS.map((t) => (
          <div className="pb-tool" key={t.label}>
            <b>{t.label}</b>
            <span>{t.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
