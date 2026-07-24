import { useCallback, useEffect, useState } from "react";
import { api } from "../controltower/api/client";
import { Button, Card, EmptyState, Field, TextInput } from "../staff/ui";
import { parseDigits } from "../staff/credit";
import "../staff/staff.css";
import { SearchSelect } from "./SearchSelect";
import "./skp.css";
import { fetchMasterProjects, type MasterProj } from "./perencanaanApi";
import type { SkpProjectTemplate } from "./types";
import { rpFull } from "./format";

const empty: SkpProjectTemplate = {
  _id: "",
  projectName: "",
  projectAddress: "",
  accountHolder: "PT Greenpark Properti Utama",
  bankName: "",
  bankAccount: "",
  bankCode: "",
  bookingFee: 3_000_000,
  marketingCity: "",
  active: true,
};

/**
 * Master Proyek SKP — Kadep-only. Fixed per-project data (nama/alamat proyek,
 * rekening penerima booking fee) reused when staff create a new SKP for that
 * project, so it's never retyped and stays consistent across every SKP issued.
 */
export function SkpProjectsPanel() {
  const [rows, setRows] = useState<SkpProjectTemplate[]>([]);
  const [masterProjects, setMasterProjects] = useState<MasterProj[]>([]);
  const [draft, setDraft] = useState<SkpProjectTemplate>({ ...empty });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [tpl, mp] = await Promise.all([api.skpProjectTemplates(), fetchMasterProjects().catch(() => [])]);
      setRows(tpl);
      setMasterProjects(mp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pickMasterProject = (name: string) => {
    const m = masterProjects.find((p) => p.name === name);
    setDraft((d) => ({ ...d, projectName: name, projectAddress: m?.lokasi || d.projectAddress }));
  };

  const edit = (t: SkpProjectTemplate) => {
    setMsg("");
    setDraft({ ...t });
  };

  const save = async () => {
    if (!draft.projectName.trim()) {
      setErr("Nama proyek wajib diisi.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api.saveSkpProjectTemplate({ ...draft, projectName: draft.projectName.trim() });
      setMsg(draft._id ? "Proyek diperbarui." : "Proyek ditambahkan.");
      setDraft({ ...empty });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (t: SkpProjectTemplate) => {
    if (!window.confirm(`Hapus master proyek "${t.projectName}"? SKP yang sudah dibuat tidak ikut terhapus.`)) return;
    try {
      await api.deleteSkpProjectTemplate(t._id);
      if (draft._id === t._id) setDraft({ ...empty });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="sales-staff">
      <div className="st-grid">
        <Card title={draft._id ? "Edit Proyek" : "Proyek Baru"}>
          <Field label="Nama Proyek" required hint={masterProjects.length === 0 ? "Master proyek Perencanaan tidak tersedia — ketik manual." : "Dari master Perencanaan"}>
            {masterProjects.length === 0 ? (
              <TextInput value={draft.projectName} onChange={(v) => setDraft((d) => ({ ...d, projectName: v }))} placeholder="mis. LE HAUZ LIMO" />
            ) : (
              <SearchSelect
                value={draft.projectName}
                onChange={pickMasterProject}
                options={masterProjects.map((p) => ({ value: p.name, label: p.name, sub: p.gp }))}
                placeholder="Cari / pilih proyek…"
              />
            )}
          </Field>
          <Field label="Alamat Proyek">
            <TextInput
              value={draft.projectAddress}
              onChange={(v) => setDraft((d) => ({ ...d, projectAddress: v }))}
              placeholder="mis. Jl. Kp. Grogol Sebrang Kel. Grogol Kec. Limo - Depok"
            />
          </Field>
          <Field label="Kota Kantor Pemasaran" hint="Dipakai di baris tanda tangan SKP (mis. Depok)">
            <TextInput value={draft.marketingCity} onChange={(v) => setDraft((d) => ({ ...d, marketingCity: v }))} placeholder="mis. Depok" />
          </Field>
          <Field label="Nama Pemegang Rekening">
            <TextInput
              value={draft.accountHolder}
              onChange={(v) => setDraft((d) => ({ ...d, accountHolder: v }))}
              placeholder="mis. PT Greenpark Properti Utama"
            />
          </Field>
          <Field label="Nama Bank">
            <TextInput value={draft.bankName} onChange={(v) => setDraft((d) => ({ ...d, bankName: v }))} placeholder="mis. BSI (Bank Syariah Indonesia)" />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="No. Rekening">
                <TextInput value={draft.bankAccount} onChange={(v) => setDraft((d) => ({ ...d, bankAccount: v }))} placeholder="728-5420-738" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Kode Bank">
                <TextInput value={draft.bankCode} onChange={(v) => setDraft((d) => ({ ...d, bankCode: v }))} placeholder="451" />
              </Field>
            </div>
          </div>
          <Field label="Booking Fee Default">
            <TextInput
              value={draft.bookingFee ? draft.bookingFee.toLocaleString("id-ID") : ""}
              onChange={(v) => setDraft((d) => ({ ...d, bookingFee: parseDigits(v) }))}
              placeholder="3.000.000"
            />
          </Field>

          {err && <div className="st-empty-msg" style={{ color: "#b3261e" }}>⚠ {err}</div>}
          {msg && <div className="st-empty-msg" style={{ color: "#1f9d54" }}>✓ {msg}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button loading={busy} onClick={save}>
              {draft._id ? "Simpan Perubahan" : "Tambah Proyek"}
            </Button>
            {draft._id && (
              <Button variant="ghost" onClick={() => setDraft({ ...empty })}>
                Batal
              </Button>
            )}
          </div>
        </Card>

        <Card title={`Master Proyek (${rows.length})`}>
          {rows.length === 0 ? (
            <EmptyState icon="🏗️" message="Belum ada master proyek. Tambah di sebelah kiri." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((t) => (
                <div key={t._id} style={{ padding: 12, border: "1px solid var(--st-line, #e2e6e2)", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>{t.projectName}</b>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button type="button" onClick={() => edit(t)} style={{ background: "none", border: "none", color: "#0f6b46", cursor: "pointer", fontWeight: 600 }}>
                        edit
                      </button>
                      <button type="button" onClick={() => del(t)} style={{ background: "none", border: "none", color: "#b3261e", cursor: "pointer", fontWeight: 600 }}>
                        hapus
                      </button>
                    </div>
                  </div>
                  {t.projectAddress && <div className="hint">{t.projectAddress}</div>}
                  <div className="hint" style={{ marginTop: 4 }}>
                    {t.bankName} · {t.bankAccount} · Kode {t.bankCode} · Booking Fee {rpFull(t.bookingFee)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
