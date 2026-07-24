// Print-document builder for SKP (Surat Konfirmasi Pesanan). Opens a standalone
// window with fully-inlined HTML+CSS, matching the Green Park SKP paper form
// (Data Pemesan / Data Unit / syarat & ketentuan / tanda tangan) so a printed
// copy needs no further editing before signature.

import type { Skp, SkpAddress } from "./types";
import { CARA_BAYAR_LABEL } from "./types";
import { dateLabel, rpFull } from "./format";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #16233b; margin: 0; padding: 28px 34px; font-size: 12px; }
  .doc { max-width: 760px; margin: 0 auto; }
  h1.title { text-align: center; font-size: 19px; letter-spacing: .03em; margin: 0 0 4px; }
  .sub { text-align: center; font-size: 10.5px; color: #5a6b82; margin-bottom: 16px; }
  h2.sec { font-size: 13px; background: #eef3f8; padding: 5px 8px; margin: 16px 0 8px; border-left: 3px solid #0f6b46; }
  h2.sec .hint { font-weight: 400; font-size: 10.5px; color: #b3261e; float: right; }
  table.grid { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.grid td { padding: 3px 4px; font-size: 11.5px; vertical-align: top; }
  table.grid td.lbl { width: 150px; color: #46566e; white-space: nowrap; }
  table.grid td.colon { width: 12px; }
  table.grid td.val { border-bottom: 1px dotted #b9c3d2; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
  .pay { margin: 10px 0; font-size: 11.5px; }
  .pay b { color: #0f6b46; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1.4px solid #16233b; text-align: center; line-height: 10px; font-size: 10px; margin: 0 4px 0 12px; }
  .terms { margin-top: 14px; font-size: 10.3px; line-height: 1.5; }
  .terms ol { padding-left: 18px; margin: 6px 0 0; }
  .terms li { margin-bottom: 6px; text-align: justify; }
  .signs { display: flex; gap: 18px; margin-top: 26px; text-align: center; }
  .signs .col { flex: 1; }
  .signs .role { font-size: 11px; font-weight: 700; margin-bottom: 50px; }
  .signs .name { border-top: 1px solid #16233b; padding-top: 4px; font-size: 11px; }
  .signplace { text-align: right; font-size: 11.5px; margin-top: 18px; }
  @media print { body { padding: 0; } .noprint { display: none; } .terms { page-break-before: always; } }
  .toolbar { text-align: center; margin-bottom: 16px; }
  .toolbar button { font: inherit; padding: 8px 18px; border-radius: 8px; border: none; background: #0f6b46; color: #fff; cursor: pointer; font-weight: 700; }
`;

function openDoc(title: string, inner: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}</style></head>
  <body><div class="toolbar noprint"><button onclick="window.print()">🖨 Cetak / Simpan PDF</button></div><div class="doc">${inner}</div></body></html>`;
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) {
    alert("Popup diblokir browser. Izinkan popup untuk mencetak dokumen.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function row(label: string, value: string): string {
  return `<tr><td class="lbl">${esc(label)}</td><td class="colon">:</td><td class="val">${esc(value || "&nbsp;")}</td></tr>`;
}

function addressRows(addr: SkpAddress, alamatLabel: string): string {
  return `
    <table class="grid">
      ${row(alamatLabel, addr.alamat)}
      <tr>
        <td class="lbl">RT / RW</td><td class="colon">:</td><td class="val" style="width:35%">${esc(addr.rtRw || "&nbsp;")}</td>
        <td class="lbl" style="width:90px">Kecamatan</td><td class="colon">:</td><td class="val">${esc(addr.kecamatan || "&nbsp;")}</td>
      </tr>
      <tr>
        <td class="lbl">Kelurahan</td><td class="colon">:</td><td class="val">${esc(addr.kelurahan || "&nbsp;")}</td>
        <td class="lbl">Kota</td><td class="colon">:</td><td class="val">${esc(addr.kota || "&nbsp;")}</td>
      </tr>
    </table>`;
}

const TERMS = [
  `Surat Konfirmasi Pesanan (SKP) ini merupakan tanda jadi atau booking atas pemesanan satu unit rumah di perumahan {PROYEK} yang tidak dapat diperjualbelikan atau dialihkan. SKP sah dan bersifat mengikat apabila telah ditandatangani oleh seluruh pihak yang bersangkutan dan dana Booking Fee telah diterima oleh Pihak Developer.`,
  `Surat Konfirmasi Pesanan (SKP) ini BUKAN merupakan bukti pembelian/kepemilikan/hak maupun bukti pengalihan hak apapun atas unit yang dipesan dari Pihak Developer kepada Pihak Pemesan atau pihak manapun dan harus ditukar/dilengkapi dengan Surat Pemesanan Pembelian Rumah (SPPR) atas unit yang dipesan berdasarkan prosedur, syarat-syarat dan ketentuan-ketentuan yang ditetapkan oleh Pihak Developer. Dalam hal terdapat perbedaan Data SKP yang dipegang/disimpan oleh Pihak Pemesan dengan Data SKP yang tercatat/disimpan Pihak Developer, maka data yang sah dan berlaku adalah Data SKP yang tercatat/disimpan oleh Pihak Developer.`,
  `Seluruh data-data dalam SKP (Nama Pemesan, Nomor KTP, Alamat KTP, Alamat Surat Menyurat, Nomor Handphone, Email dan Sumber Informasi) wajib diisi dengan lengkap, jelas dan benar serta melampirkan Fotokopi Identitas Diri (KTP) dan Nomor Pokok Wajib Pajak (NPWP) yang benar dan jelas. Pihak Developer tidak bertanggung jawab dalam hal apapun apabila ternyata data yang diberikan tidak lengkap dan tidak benar.`,
  `Perubahan cara pembayaran hanya dapat dilakukan oleh Pihak Pemesan setelah Pihak Pemesan mengajukan permohonan secara tertulis kepada Pihak Developer dan telah mendapat persetujuan tertulis dari Pihak Developer.`,
  `SKP ini merupakan bagian dari SPPR dan bersifat mengikat. Pihak Pemesan wajib menandatangani SPPR selambat-lambatnya 14 (Empat Belas) hari kalender terhitung sejak tanggal SKP ini ditandatangani oleh seluruh pihak di MARKETING OFFICE {PROYEK} {KOTA}.`,
  `Pada saat penandatanganan SPPR, dokumen yang wajib dibawa Pihak Pemesan yang sah adalah: Asli SKP ini yang telah ditandatangani secara lengkap oleh seluruh pihak yang bersangkutan; Fotokopi KTP dan NPWP yang masih berlaku dan jelas; Bukti Pembayaran Booking Fee sesuai SKP.`,
  `Pihak Pemesan wajib membayar Down Payment (DP) selambat-lambatnya 14 (Empat Belas) hari setelah penandatanganan SKP.`,
  `Segala pelaksanaan pembayaran terkait pemesanan unit hanya ditujukan kepada rekening yang tercantum pada Surat Konfirmasi Pemesanan (SKP). Pelaksanaan pembayaran yang dilakukan selain ditujukan kepada Rekening Pihak Developer merupakan di luar kewenangan maupun tanggung jawab Pihak Developer.`,
  `Pembayaran Booking Fee pada SKP tidak dapat diuangkan kembali (non-refundable).`,
  `Segala akibat yang ditimbulkan oleh penyalahgunaan SKP ini oleh pihak lain adalah diluar tanggung jawab Pihak Developer.`,
  `Hal-hal yang tidak atau belum (cukup) diatur dalam SKP ini akan diatur lebih lanjut dalam SPPR maupun perjanjian-perjanjian lain yang dibuat sehubungan dengan unit yang dipesan, berdasarkan prosedur, syarat-syarat dan ketentuan-ketentuan yang berlaku pada proyek perumahan {PROYEK}.`,
];

export function printSkp(s: Skp) {
  const box = (checked: boolean, label: string) => `${esc(label)} <span class="box">${checked ? "✓" : ""}</span>`;

  const inner = `
    <h1 class="title">SURAT KONFIRMASI PESANAN (SKP)</h1>
    <div class="sub">*Data SKP wajib di isi lengkap sesuai KTP</div>

    <h2 class="sec">Data Pemesan</h2>
    <table class="grid">
      ${row("Nama", s.nama)}
      ${row("No. KTP", s.noKtp)}
    </table>
    ${addressRows(s.alamatKtp, "Alamat KTP")}
    <div style="height:6px"></div>
    ${addressRows(s.alamatDomisili, "Alamat Domisili")}
    <table class="grid">
      <tr>
        <td class="lbl">Agama</td><td class="colon">:</td><td class="val" style="width:35%">${esc(s.agama || "&nbsp;")}</td>
        <td class="lbl" style="width:120px">Status Perkawinan</td><td class="colon">:</td><td class="val">${esc(s.statusKawin || "&nbsp;")}</td>
      </tr>
      ${row("Pekerjaan", s.pekerjaan || "")}
    </table>
    ${addressRows(s.alamatKantor, "Alamat Kantor")}
    <table class="grid">
      <tr>
        <td class="lbl">No. Handphone</td><td class="colon">:</td><td class="val" style="width:35%">${esc(s.noHp)}</td>
        <td class="lbl" style="width:100px">No. Telp Kantor</td><td class="colon">:</td><td class="val">${esc(s.noTelpKantor || "&nbsp;")}</td>
      </tr>
      ${row("Email", s.email || "")}
      ${row("Sumber Informasi", s.sumberInfo || "")}
    </table>

    <div class="pay">
      Pembayaran Booking Fee sebesar <b>${rpFull(s.bookingFee)}</b> Dilakukan Via :
      ${box(s.bookingFeeVia === "transfer", "Transfer")} ${box(s.bookingFeeVia === "tunai", "Tunai")}
      <br/>Transfer ke Rekening <b>${esc(s.accountHolder)}</b> pada Bank :
      <br/>${esc(s.bankName)} : <b>${esc(s.bankAccount)}</b> &nbsp; <b>KODE BANK : ${esc(s.bankCode)}</b>
    </div>

    <h2 class="sec">Data Unit</h2>
    <table class="grid">
      ${row("Nama Proyek", s.namaProyek)}
      ${row("Alamat Proyek", s.alamatProyek)}
      <tr>
        <td class="lbl">Type Unit</td><td class="colon">:</td><td class="val" style="width:35%">${esc(s.typeUnit)}</td>
        <td class="lbl" style="width:100px">Blok / No. Unit</td><td class="colon">:</td><td class="val">${esc(s.blokNoUnit)}</td>
      </tr>
      <tr>
        <td class="lbl">Luas Tanah (LT)</td><td class="colon">:</td><td class="val" style="width:35%">${esc(s.luasTanah || "&nbsp;")}</td>
        <td class="lbl" style="width:100px">Luas Bangunan (LB)</td><td class="colon">:</td><td class="val">${esc(s.luasBangunan || "&nbsp;")}</td>
      </tr>
      ${row("Harga Jual", rpFull(s.hargaJual) + " (*sesuai dengan price list yang berlaku)")}
      ${row("Down Payment (Uang Muka)", rpFull(s.downPayment))}
      ${row("Promo", s.promo || "(*selama promo masih berlaku)")}
    </table>
    <div class="pay">
      Cara Pembayaran :
      ${box(s.caraBayar === "kpr", "KPR")} ${box(s.caraBayar === "cash_keras", "Cash Keras")} ${box(s.caraBayar === "cash_bertahap", "Cash Bertahap")}
    </div>
    <table class="grid">
      ${row("Alasan Pembelian Unit", s.alasanPembelian || "")}
    </table>

    <div class="terms">
      <b>Pihak Pemesan yang bertanda tangan di Surat Konfirmasi Pesanan (SKP) ini telah membaca dan mengerti syarat dan ketentuan sebagai berikut :</b>
      <ol>
        ${TERMS.map((t) => `<li>${esc(t.split("{PROYEK}").join(s.namaProyek).split("{KOTA}").join(s.signCity || ""))}</li>`).join("")}
      </ol>
    </div>

    <div class="signplace">${esc(s.signCity || "")}, ${dateLabel(s.signDate)}</div>
    <div class="signs">
      <div class="col"><div class="role">Pemesan</div><div class="name">${esc(s.nama || "(&nbsp;&nbsp;&nbsp;)")}</div></div>
      <div class="col"><div class="role">Marketing</div><div class="name">${esc(s.marketingName || s.byName || "(&nbsp;&nbsp;&nbsp;)")}</div></div>
      <div class="col"><div class="role">Finance</div><div class="name">${esc(s.financeName || "(&nbsp;&nbsp;&nbsp;)")}</div></div>
    </div>
  `;
  openDoc(`SKP ${s.nomor || s.nama || ""}`.trim(), inner);
}

// caraBayar label re-exported for convenience where the form needs it too.
export { CARA_BAYAR_LABEL };
