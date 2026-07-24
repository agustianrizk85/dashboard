import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../controltower/api/client";
import { Button, Card, EmptyState, Field, Select, TextInput } from "../staff/ui";
import { parseDigits } from "../staff/credit";
import "../staff/staff.css";
import { SearchSelect } from "./SearchSelect";
import "./skp.css";
import { fetchMasterUnits, fetchSiteplanMarketing, type MasterUnit, type SiteplanFile } from "./perencanaanApi";
import { emptySkp, CARA_BAYAR_LABEL, type Skp, type SkpAddress, type SkpProjectTemplate } from "./types";
import { dateLabel, rpFull, todayISO } from "./format";
import { printSkp } from "./print";

const AGAMA_OPTS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];
const STATUS_KAWIN_OPTS = ["Belum Kawin", "Kawin", "Cerai Hidup", "Cerai Mati"];

/** Rupiah field styled identically to a plain TextInput (no distinct "Rp" box). */
function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  return (
    <TextInput value={value ? value.toLocaleString("id-ID") : ""} onChange={(v) => onChange(parseDigits(v))} placeholder={placeholder} />
  );
}

function AddressFields({ label, value, onChange }: { label: string; value: SkpAddress; onChange: (a: SkpAddress) => void }) {
  const set = (patch: Partial<SkpAddress>) => onChange({ ...value, ...patch });
  return (
    <>
      <Field label={label}>
        <TextInput value={value.alamat} onChange={(v) => set({ alamat: v })} placeholder="Jl. …" />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="RT/RW">
            <TextInput value={value.rtRw} onChange={(v) => set({ rtRw: v })} placeholder="001/002" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Kelurahan">
            <TextInput value={value.kelurahan} onChange={(v) => set({ kelurahan: v })} />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Kecamatan">
            <TextInput value={value.kecamatan} onChange={(v) => set({ kecamatan: v })} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Kota">
            <TextInput value={value.kota} onChange={(v) => set({ kota: v })} />
          </Field>
        </div>
      </div>
    </>
  );
}

/**
 * SKP (Surat Konfirmasi Pesanan) — sales staff create/edit a booking
 * confirmation per buyer, picking a Master Proyek template to prefill the
 * project + rekening data, then print it ready for signature.
 */
export function SkpFormView() {
  const [rows, setRows] = useState<Skp[]>([]);
  const [templates, setTemplates] = useState<SkpProjectTemplate[]>([]);
  const [masterUnits, setMasterUnits] = useState<MasterUnit[]>([]);
  const [draft, setDraft] = useState<Skp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [list, tpl, mu] = await Promise.all([api.skpList(), api.skpProjectTemplates(), fetchMasterUnits().catch(() => [])]);
      setRows(list);
      setTemplates(tpl);
      setMasterUnits(mu);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((s) => `${s.nama} ${s.namaProyek} ${s.typeUnit} ${s.blokNoUnit}`.toLowerCase().includes(n));
  }, [rows, q]);

  // Kavling master, scoped to the project currently picked — selecting one
  // prefills type + luas so it always matches the real inventory.
  const unitsForDraftProject = useMemo(
    () => (draft ? masterUnits.filter((u) => u.projectName === draft.namaProyek) : []),
    [masterUnits, draft],
  );
  // Siteplan Marketing reference image(s) for the picked project, matched by
  // name in Perencanaan (debounced — namaProyek is free text while typing).
  const [siteplan, setSiteplan] = useState<SiteplanFile[]>([]);
  const projectName = draft?.namaProyek ?? "";
  useEffect(() => {
    if (!projectName.trim()) {
      setSiteplan([]);
      return;
    }
    const t = setTimeout(() => {
      fetchSiteplanMarketing(projectName).then(setSiteplan).catch(() => setSiteplan([]));
    }, 400);
    return () => clearTimeout(t);
  }, [projectName]);

  const pickMasterUnit = (noKav: string) => {
    if (!draft) return;
    const u = unitsForDraftProject.find((m) => m.noKav === noKav);
    setDraft({
      ...draft,
      blokNoUnit: noKav,
      typeUnit: u?.type || draft.typeUnit,
      luasTanah: u?.lebar ? `${u.lebar} m²` : draft.luasTanah,
      luasBangunan: u?.luasBangunan ? `${u.luasBangunan} m²` : draft.luasBangunan,
    });
  };

  const startNew = () => {
    setMsg("");
    setErr("");
    setDraft(emptySkp());
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x._id === id);
    if (!t || !draft) return;
    setDraft({
      ...draft,
      projectTemplateId: t._id,
      namaProyek: t.projectName,
      alamatProyek: t.projectAddress,
      accountHolder: t.accountHolder,
      bankName: t.bankName,
      bankAccount: t.bankAccount,
      bankCode: t.bankCode,
      bookingFee: t.bookingFee || draft.bookingFee,
      signCity: draft.signCity || t.marketingCity,
    });
  };

  const edit = (s: Skp) => {
    setMsg("");
    setErr("");
    setDraft({ ...s });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.nama.trim()) {
      setErr("Nama pemesan wajib diisi.");
      return;
    }
    if (!draft.namaProyek.trim()) {
      setErr("Nama proyek wajib diisi (pilih dari Master Proyek atau ketik manual).");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const saved = await api.saveSkp(draft);
      setDraft(saved);
      setMsg("✓ SKP tersimpan.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (s: Skp) => {
    if (!window.confirm(`Hapus SKP "${s.nama}" (${s.namaProyek})?`)) return;
    try {
      await api.deleteSkp(s._id);
      if (draft?._id === s._id) setDraft(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="sales-staff">
      <div style={{ maxWidth: 640 }}>
        <Card
          title={draft ? (draft._id ? "Edit SKP" : "SKP Baru") : "Daftar SKP"}
          right={!draft && <Button onClick={startNew}>+ SKP Baru</Button>}
        >
          {!draft ? (
            <>
              <Field label="Cari">
                <TextInput value={q} onChange={setQ} placeholder="Cari nama pemesan / proyek / unit…" />
              </Field>
              {filtered.length === 0 ? (
                <EmptyState icon="📄" message="Belum ada SKP. Klik “+ SKP Baru” untuk membuat." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map((s) => (
                    <div key={s._id} style={{ padding: 12, border: "1px solid var(--st-line, #e2e6e2)", borderRadius: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <b>{s.nama}</b>
                        <span className="hint">{s.signDate ? dateLabel(s.signDate) : "draft"}</span>
                      </div>
                      <div className="hint">
                        {s.namaProyek} · {s.typeUnit} {s.blokNoUnit && `· Blok ${s.blokNoUnit}`} · {rpFull(s.hargaJual)}
                      </div>
                      <div className="hint" style={{ marginTop: 2 }}>
                        {CARA_BAYAR_LABEL[s.caraBayar]} · dibuat oleh {s.byName || s.by}
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                        <button type="button" onClick={() => edit(s)} style={{ background: "none", border: "none", color: "#0f6b46", cursor: "pointer", fontWeight: 600 }}>
                          edit
                        </button>
                        <button type="button" onClick={() => printSkp(s)} style={{ background: "none", border: "none", color: "#16233b", cursor: "pointer", fontWeight: 600 }}>
                          🖨 cetak
                        </button>
                        <button type="button" onClick={() => del(s)} style={{ background: "none", border: "none", color: "#b3261e", cursor: "pointer", fontWeight: 600 }}>
                          hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {templates.length > 0 && (
                <Field label="Isi dari Master Proyek" hint="Prefill nama/alamat proyek + rekening booking fee">
                  <Select
                    value={draft.projectTemplateId ?? ""}
                    onChange={applyTemplate}
                    options={templates.map((t) => t._id)}
                    placeholder="— Pilih proyek —"
                  />
                </Field>
              )}

              <h4 style={{ margin: "14px 0 6px" }}>Data Pemesan</h4>
              <Field label="Nama (sesuai KTP)" required>
                <TextInput value={draft.nama} onChange={(v) => setDraft({ ...draft, nama: v })} />
              </Field>
              <Field label="No. KTP">
                <TextInput value={draft.noKtp} onChange={(v) => setDraft({ ...draft, noKtp: v })} />
              </Field>
              <AddressFields label="Alamat KTP" value={draft.alamatKtp} onChange={(a) => setDraft({ ...draft, alamatKtp: a })} />
              <AddressFields label="Alamat Domisili" value={draft.alamatDomisili} onChange={(a) => setDraft({ ...draft, alamatDomisili: a })} />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Agama">
                    <Select value={draft.agama ?? ""} onChange={(v) => setDraft({ ...draft, agama: v })} options={AGAMA_OPTS} placeholder="— pilih —" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Status Perkawinan">
                    <Select
                      value={draft.statusKawin ?? ""}
                      onChange={(v) => setDraft({ ...draft, statusKawin: v })}
                      options={STATUS_KAWIN_OPTS}
                      placeholder="— pilih —"
                    />
                  </Field>
                </div>
              </div>
              <Field label="Pekerjaan">
                <TextInput value={draft.pekerjaan ?? ""} onChange={(v) => setDraft({ ...draft, pekerjaan: v })} />
              </Field>
              <AddressFields label="Alamat Kantor" value={draft.alamatKantor} onChange={(a) => setDraft({ ...draft, alamatKantor: a })} />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="No. Handphone" required>
                    <TextInput value={draft.noHp} onChange={(v) => setDraft({ ...draft, noHp: v })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="No. Telp Kantor">
                    <TextInput value={draft.noTelpKantor ?? ""} onChange={(v) => setDraft({ ...draft, noTelpKantor: v })} />
                  </Field>
                </div>
              </div>
              <Field label="Email">
                <TextInput value={draft.email ?? ""} onChange={(v) => setDraft({ ...draft, email: v })} />
              </Field>
              <Field label="Sumber Informasi">
                <TextInput value={draft.sumberInfo ?? ""} onChange={(v) => setDraft({ ...draft, sumberInfo: v })} placeholder="mis. Iklan IG, referral, walk-in…" />
              </Field>

              <h4 style={{ margin: "14px 0 6px" }}>Booking Fee</h4>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Nominal">
                    <MoneyInput value={draft.bookingFee} onChange={(n) => setDraft({ ...draft, bookingFee: n })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Dibayar Via">
                    <Select
                      value={draft.bookingFeeVia}
                      onChange={(v) => setDraft({ ...draft, bookingFeeVia: v as Skp["bookingFeeVia"] })}
                      options={["transfer", "tunai"]}
                    />
                  </Field>
                </div>
              </div>

              <h4 style={{ margin: "14px 0 6px" }}>Data Unit</h4>
              <Field label="Nama Proyek" required>
                <TextInput value={draft.namaProyek} onChange={(v) => setDraft({ ...draft, namaProyek: v })} />
              </Field>
              <Field label="Alamat Proyek">
                <TextInput value={draft.alamatProyek} onChange={(v) => setDraft({ ...draft, alamatProyek: v })} />
              </Field>
              {unitsForDraftProject.length > 0 ? (
                <Field label="Kavling / Unit" hint="Dari master Perencanaan — mengisi Type Unit + Luas otomatis">
                  <SearchSelect
                    value={draft.blokNoUnit}
                    onChange={pickMasterUnit}
                    options={unitsForDraftProject.map((u) => ({ value: u.noKav, label: u.noKav, sub: `Blok ${u.blok} · ${u.type}` }))}
                    placeholder="Cari no. kavling / blok / tipe…"
                  />
                </Field>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <Field label="Type Unit" hint={draft.namaProyek ? "Master kavling proyek ini tidak tersedia — ketik manual." : undefined}>
                      <TextInput value={draft.typeUnit} onChange={(v) => setDraft({ ...draft, typeUnit: v })} />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Blok / No. Unit">
                      <TextInput value={draft.blokNoUnit} onChange={(v) => setDraft({ ...draft, blokNoUnit: v })} />
                    </Field>
                  </div>
                </div>
              )}
              {siteplan.length > 0 && (
                <Field label="Site Plan Marketing" hint="Referensi dari Perencanaan — klik untuk lihat ukuran penuh">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {siteplan.map((f) => (
                      <a
                        key={f.id}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        title={f.name}
                        style={{ display: "block", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: "1px solid var(--st-line, #e2e6e2)" }}
                      >
                        {f.mime.startsWith("image/") ? (
                          <img src={f.url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📄</div>
                        )}
                      </a>
                    ))}
                  </div>
                </Field>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Luas Tanah (LT)">
                    <TextInput value={draft.luasTanah ?? ""} onChange={(v) => setDraft({ ...draft, luasTanah: v })} placeholder="mis. 72 m²" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Luas Bangunan (LB)">
                    <TextInput value={draft.luasBangunan ?? ""} onChange={(v) => setDraft({ ...draft, luasBangunan: v })} placeholder="mis. 45 m²" />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Harga Jual" required>
                    <MoneyInput value={draft.hargaJual} onChange={(n) => setDraft({ ...draft, hargaJual: n })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Down Payment (Uang Muka)">
                    <MoneyInput value={draft.downPayment} onChange={(n) => setDraft({ ...draft, downPayment: n })} />
                  </Field>
                </div>
              </div>
              <Field label="Promo" hint="Selama promo masih berlaku">
                <TextInput value={draft.promo ?? ""} onChange={(v) => setDraft({ ...draft, promo: v })} />
              </Field>
              <Field label="Cara Pembayaran">
                <Select
                  value={draft.caraBayar}
                  onChange={(v) => setDraft({ ...draft, caraBayar: v as Skp["caraBayar"] })}
                  options={["kpr", "cash_keras", "cash_bertahap"]}
                />
              </Field>
              <Field label="Alasan Pembelian Unit">
                <TextInput value={draft.alasanPembelian ?? ""} onChange={(v) => setDraft({ ...draft, alasanPembelian: v })} />
              </Field>

              <h4 style={{ margin: "14px 0 6px" }}>Rekening Booking Fee</h4>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Pemegang Rekening">
                    <TextInput value={draft.accountHolder} onChange={(v) => setDraft({ ...draft, accountHolder: v })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Nama Bank">
                    <TextInput value={draft.bankName} onChange={(v) => setDraft({ ...draft, bankName: v })} />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="No. Rekening">
                    <TextInput value={draft.bankAccount} onChange={(v) => setDraft({ ...draft, bankAccount: v })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Kode Bank">
                    <TextInput value={draft.bankCode} onChange={(v) => setDraft({ ...draft, bankCode: v })} />
                  </Field>
                </div>
              </div>

              <h4 style={{ margin: "14px 0 6px" }}>Tanda Tangan</h4>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Nama Marketing">
                    <TextInput value={draft.marketingName ?? ""} onChange={(v) => setDraft({ ...draft, marketingName: v })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Nama Finance">
                    <TextInput value={draft.financeName ?? ""} onChange={(v) => setDraft({ ...draft, financeName: v })} />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Kota Tanda Tangan">
                    <TextInput value={draft.signCity ?? ""} onChange={(v) => setDraft({ ...draft, signCity: v })} placeholder="mis. Depok" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Tanggal Tanda Tangan">
                    <TextInput
                      type="date"
                      value={draft.signDate ?? ""}
                      onChange={(v) => setDraft({ ...draft, signDate: v })}
                    />
                  </Field>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setDraft({ ...draft, signDate: todayISO() })} style={{ marginBottom: 8 }}>
                Set tanggal hari ini
              </Button>

              {err && <div className="st-empty-msg" style={{ color: "#b3261e" }}>⚠ {err}</div>}
              {msg && <div className="st-empty-msg" style={{ color: "#1f9d54" }}>{msg}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Button loading={busy} onClick={save}>
                  {draft._id ? "Simpan Perubahan" : "Simpan SKP"}
                </Button>
                {draft._id && (
                  <Button variant="ghost" onClick={() => printSkp(draft)}>
                    🖨 Cetak
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Tutup
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
