import { useState } from "react";
import type { Ticket } from "./types";
import { api } from "./api/client";
import { Panel, Pill } from "./components/ui";
import type { Tone } from "./types";

function klsTone(k: string): Tone {
  switch (k.toUpperCase()) {
    case "CRITICAL":
      return "bad";
    case "MAJOR":
      return "warn";
    case "MINOR":
      return "ok";
    default:
      return "neutral";
  }
}

function statusTone(s: string): Tone {
  return s.toUpperCase() === "COMPLETE" ? "ok" : s.toUpperCase() === "PROGRESS" ? "warn" : "neutral";
}

/**
 * Live complaint tickets — these arrive from the WhatsApp intake bot (waelectron
 * cso.js POSTs to /api/tickets) and can also be created manually here. They
 * supplement the spreadsheet-derived executive numbers.
 */
export function TicketsView({ tickets, canManage }: { tickets: Ticket[]; canManage: boolean }) {
  const [form, setForm] = useState({ nama: "", unit: "", proyek: "", kategori: "", deskripsi: "", klasifikasi: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.deskripsi.trim() && !form.kategori.trim()) {
      setErr("Isi minimal deskripsi atau kategori komplain.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const t = await api.createTicket({ ...form, source: "manual" });
      setMsg(`✓ Tiket ${t.id} dibuat (${t.klasifikasi}, SLA ${t.sla}).`);
      setForm({ nama: "", unit: "", proyek: "", kategori: "", deskripsi: "", klasifikasi: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel tag="WHATSAPP" title="Tiket Komplain Masuk" sub={`${tickets.length} tiket live · intake WhatsApp + manual`}>
        <div className="tbl-scroll" style={{ maxHeight: 460 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th><th>Waktu</th><th>Nama</th><th>Unit</th><th>Proyek</th>
                <th>Deskripsi</th><th>Klasifikasi</th><th>SLA</th><th>Status</th><th>Sumber</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.id}</b></td>
                  <td className="nowrap">{t.tanggal}</td>
                  <td>{t.nama || "—"}</td>
                  <td>{t.unit || "—"}</td>
                  <td>{t.proyek || "—"}</td>
                  <td style={{ maxWidth: 260 }}>{t.deskripsi || t.kategori || "—"}</td>
                  <td><Pill tone={klsTone(t.klasifikasi)}>{t.klasifikasi}</Pill></td>
                  <td className="nowrap">{t.sla}</td>
                  <td><Pill tone={statusTone(t.status)}>{t.status}</Pill></td>
                  <td>{t.source}</td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={10} className="tbl-empty">Belum ada tiket live. Komplain via WhatsApp akan muncul di sini otomatis.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {canManage && (
        <Panel tag="INPUT" title="Buat Tiket Manual" sub="klasifikasi otomatis dari kata kunci bila dikosongkan (SOP D.E.A.S.K)">
          <div className="tk-form">
            <input placeholder="Nama konsumen" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            <input placeholder="Unit / Blok" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <input placeholder="Proyek" value={form.proyek} onChange={(e) => setForm({ ...form, proyek: e.target.value })} />
            <input placeholder="Kategori (mis. Rembesan)" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} />
            <select value={form.klasifikasi} onChange={(e) => setForm({ ...form, klasifikasi: e.target.value })}>
              <option value="">Klasifikasi otomatis</option>
              <option value="CRITICAL">CRITICAL (≤2 hari)</option>
              <option value="MAJOR">MAJOR (≤3–5 hari)</option>
              <option value="MINOR">MINOR (≤7 hari)</option>
            </select>
            <input className="wide" placeholder="Deskripsi komplain" value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
            <button className="md-btn primary" onClick={() => void submit()} disabled={busy}>
              {busy ? "Menyimpan…" : "+ Buat Tiket"}
            </button>
          </div>
          {err && <div className="md-error">{err}</div>}
          {msg && <div className="okline">{msg}</div>}
        </Panel>
      )}
    </>
  );
}
