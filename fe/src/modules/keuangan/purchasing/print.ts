// Print-document builders for PR and PO. Each opens a standalone window with
// fully-inlined HTML+CSS (independent of .kc-scope) so the layout is clean when
// printed. Labels/sections mirror the Green Park PR & PO templates.

import type { PurchaseOrder, PurchaseRequest } from "../types";
import { dateLabel, rpFull, terbilang } from "./format";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #16233b; margin: 0; padding: 28px 34px; font-size: 12px; }
  .doc { max-width: 720px; margin: 0 auto; }
  .head { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2.5px solid #0f6b46; padding-bottom: 12px; }
  .head .brand { font-size: 20px; font-weight: 800; color: #0f6b46; letter-spacing: .02em; }
  .head .sub { font-size: 11px; color: #5a6b82; margin-top: 2px; }
  .doctitle { text-align: right; margin-left: auto; }
  .doctitle h1 { font-size: 22px; margin: 0; letter-spacing: .06em; color: #102a4c; }
  .doctitle .no { font-size: 12px; font-weight: 700; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 26px; margin: 14px 0 6px; }
  .meta .r { display: flex; font-size: 12px; padding: 2px 0; }
  .meta .r b { width: 130px; color: #46566e; font-weight: 600; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.items th, table.items td { border: 1px solid #b9c3d2; padding: 6px 8px; font-size: 11.5px; }
  table.items th { background: #eef3f8; text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; color: #46566e; }
  table.items td.n, table.items th.n { text-align: right; }
  table.items td.c, table.items th.c { text-align: center; width: 34px; }
  .totals { margin-top: 8px; margin-left: auto; width: 300px; }
  .totals .r { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .totals .r.grand { border-top: 1.5px solid #16233b; margin-top: 4px; padding-top: 6px; font-weight: 800; font-size: 13px; }
  .terbilang { margin-top: 8px; font-style: italic; font-size: 11.5px; color: #46566e; }
  .note { margin-top: 12px; font-size: 11.5px; white-space: pre-wrap; }
  .note b { color: #46566e; }
  .signs { display: flex; gap: 24px; margin-top: 34px; }
  .sign { flex: 1; text-align: center; font-size: 11.5px; }
  .sign .role { color: #46566e; margin-bottom: 56px; }
  .sign .name { border-top: 1px solid #16233b; padding-top: 4px; font-weight: 700; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .toolbar { text-align: center; margin-bottom: 16px; }
  .toolbar button { font: inherit; padding: 8px 18px; border-radius: 8px; border: none; background: #0f6b46; color: #fff; cursor: pointer; font-weight: 700; }
`;

function openDoc(title: string, inner: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}</style></head>
  <body><div class="toolbar noprint"><button onclick="window.print()">🖨 Cetak / Simpan PDF</button></div><div class="doc">${inner}</div></body></html>`;
  const w = window.open("", "_blank", "width=860,height=980");
  if (!w) {
    alert("Popup diblokir browser. Izinkan popup untuk mencetak dokumen.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function brandHead(docTitle: string, nomor: string): string {
  return `
    <div class="head">
      <div>
        <div class="brand">Green Park Group</div>
        <div class="sub">Departemen Keuangan · Purchasing</div>
        <div class="sub">Jl. Green Park Raya, Bekasi · greenpark.id</div>
      </div>
      <div class="doctitle">
        <h1>${esc(docTitle)}</h1>
        <div class="no">${esc(nomor || "(draft)")}</div>
      </div>
    </div>`;
}

function metaRow(label: string, value: string): string {
  return `<div class="r"><b>${esc(label)}</b><span>${esc(value || "—")}</span></div>`;
}

function signBlock(role: string, name: string): string {
  return `<div class="sign"><div class="role">${esc(role)}</div><div class="name">${esc(name || "(   )")}</div></div>`;
}

export function printPR(pr: PurchaseRequest) {
  const items = (pr.items ?? [])
    .map(
      (it, i) =>
        `<tr><td class="c">${it.no || i + 1}</td><td>${esc(it.nama)}</td><td>${esc(it.satuan)}</td><td class="n">${esc(it.qty)}</td><td>${esc(it.tujuan)}</td></tr>`,
    )
    .join("");
  const inner = `
    ${brandHead("Purchase Request", pr.nomor)}
    <div class="meta">
      ${metaRow("Request Date", dateLabel(pr.requestDate))}
      ${metaRow("Request By", pr.requestBy)}
      ${metaRow("Date Required", dateLabel(pr.dateRequired))}
      ${metaRow("Dept", pr.dept)}
      ${metaRow("Proyek", pr.proyek)}
      ${metaRow("Supplier", pr.supplier)}
      ${metaRow("PIC", pr.pic)}
      ${metaRow("Alamat Pengiriman", pr.alamatPengiriman)}
    </div>
    <table class="items">
      <thead><tr><th class="c">No</th><th>Nama Barang</th><th>Satuan</th><th class="n">Qty</th><th>Tujuan / Keperluan</th></tr></thead>
      <tbody>${items || `<tr><td colspan="5" style="text-align:center;color:#94a3b8">Tidak ada item.</td></tr>`}</tbody>
    </table>
    ${pr.catatan ? `<div class="note"><b>Catatan:</b> ${esc(pr.catatan)}</div>` : ""}
    <div class="signs">
      ${signBlock("Diajukan oleh (Staff / SPV)", pr.diajukanOleh || pr.requestBy)}
      ${signBlock("Diketahui oleh (KADEP)", pr.diketahuiOleh)}
    </div>`;
  openDoc(`PR ${pr.nomor || ""}`.trim(), inner);
}

export function printPO(po: PurchaseOrder) {
  const items = (po.items ?? [])
    .map(
      (it, i) =>
        `<tr><td class="c">${it.no || i + 1}</td><td>${esc(it.nama)}</td><td>${esc(it.satuan)}</td><td class="n">${esc(it.qty)}</td><td class="n">${rpFull(it.hargaSatuan)}</td><td class="n">${rpFull(it.jumlah)}</td></tr>`,
    )
    .join("");
  const inner = `
    ${brandHead("Purchase Order", po.nomor)}
    <div class="meta">
      ${metaRow("Nomor", po.nomor)}
      ${metaRow("Tanggal", dateLabel(po.tanggal))}
      ${metaRow("Ref. PR", po.prNomor)}
      ${metaRow("Tanggal Pengiriman", dateLabel(po.tanggalPengiriman))}
      ${metaRow("Syarat Pembayaran", po.syaratPembayaran || po.caraBayar)}
      ${metaRow("Supplier", po.supplier)}
      ${metaRow("PIC", po.pic)}
      ${metaRow("Alamat Pengiriman", po.alamatPengiriman)}
    </div>
    <table class="items">
      <thead><tr><th class="c">No</th><th>Nama Barang</th><th>Satuan</th><th class="n">Qty</th><th class="n">Harga Satuan</th><th class="n">Jumlah Harga</th></tr></thead>
      <tbody>${items || `<tr><td colspan="6" style="text-align:center;color:#94a3b8">Tidak ada item.</td></tr>`}</tbody>
    </table>
    <div class="totals">
      <div class="r"><span>Sub Total</span><span>${rpFull(po.subTotal)}</span></div>
      <div class="r"><span>Potongan</span><span>${rpFull(po.potongan)}</span></div>
      <div class="r"><span>Biaya Pengiriman</span><span>${rpFull(po.biayaPengiriman)}</span></div>
      <div class="r grand"><span>Total</span><span>${rpFull(po.total)}</span></div>
    </div>
    <div class="terbilang">Terbilang: <b>${esc(po.terbilang || terbilang(po.total))}</b></div>
    ${po.catatan ? `<div class="note"><b>Catatan:</b> ${esc(po.catatan)}</div>` : ""}
    <div class="signs">
      ${signBlock("Disiapkan oleh (Staff Purchasing)", po.disiapkanOleh || po.purchaser)}
      ${signBlock("Diketahui oleh (KADEP Keuangan)", po.diketahuiOleh)}
      ${signBlock("Disetujui oleh (Dirops / CEO)", po.disetujuiOleh)}
    </div>`;
  openDoc(`PO ${po.nomor || ""}`.trim(), inner);
}
