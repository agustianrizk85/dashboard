import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/auth/AuthContext";
import { DataTable } from "@/components/DataTable";
import { api } from "../controltower/api/client";
import { Button, Card, EmptyState, Field, Select, TextInput } from "../staff/ui";
import "../staff/staff.css";
import { SearchSelect } from "./SearchSelect";
import "./skp.css";
import { fetchMasterProjects, fetchMasterUnits, type MasterProj, type MasterUnit } from "./perencanaanApi";
import { emptyUnitBooking, UNIT_STATUS_META, type UnitBooking, type UnitStatus } from "./types";
import { dateLabel } from "./format";

const STATUS_OPTS: UnitStatus[] = ["tersedia", "booked", "akad", "terjual", "batal"];

const actBtnStyle = { background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 } as const;

/**
 * Master Booking — status ketersediaan unit per proyek, alurnya Tersedia ->
 * Booked (DP/booking fee masuk) -> Akad (akad kredit/jual-beli ditandatangani)
 * -> Terjual (lunas/selesai), dengan "Akad Batal" kalau transaksinya batal di
 * titik manapun. SKP baru otomatis menandai unit "Booked"; Kadep yang
 * menaikkan ke "Akad"/"Terjual" atau membatalkannya. Semua staf boleh
 * melihat; hanya Kadep yang bisa menambah/mengubah/menghapus.
 */
export function UnitBookingPanel() {
  const { user } = useAuth();
  const canManage = user?.role === "kadep";

  const [rows, setRows] = useState<UnitBooking[]>([]);
  const [masterProjects, setMasterProjects] = useState<MasterProj[]>([]);
  const [masterUnits, setMasterUnits] = useState<MasterUnit[]>([]);
  const [draft, setDraft] = useState<UnitBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [list, mp, mu] = await Promise.all([
        api.unitBookings(),
        fetchMasterProjects().catch(() => []),
        fetchMasterUnits().catch(() => []),
      ]);
      setRows(list);
      setMasterProjects(mp);
      setMasterUnits(mu);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const projects = useMemo(() => Array.from(new Set(rows.map((r) => r.namaProyek))).sort(), [rows]);

  // Kavling master, scoped to the project currently picked in the form —
  // picking one prefills type + luas (informational, kept in `note` for now).
  const unitsForDraftProject = useMemo(
    () => (draft ? masterUnits.filter((u) => u.projectName === draft.namaProyek) : []),
    [masterUnits, draft],
  );
  const pickMasterUnit = (noKav: string) => {
    const u = masterUnits.find((m) => m.noKav === noKav && m.projectName === draft?.namaProyek);
    if (!draft) return;
    setDraft({ ...draft, blokNoUnit: noKav, typeUnit: u?.type || draft.typeUnit });
  };

  const filtered = useMemo(
    () => (projectFilter ? rows.filter((r) => r.namaProyek === projectFilter) : rows),
    [rows, projectFilter],
  );

  const save = async () => {
    if (!draft) return;
    if (!draft.namaProyek.trim() || !draft.blokNoUnit.trim()) {
      setErr("Nama proyek dan Blok/No Unit wajib diisi.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api.saveUnitBooking(draft);
      setMsg(draft._id ? "Status unit diperbarui." : "Unit ditambahkan.");
      setDraft(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const quickStatus = async (u: UnitBooking, status: UnitStatus) => {
    try {
      await api.saveUnitBooking({ ...u, status });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (u: UnitBooking) => {
    if (!window.confirm(`Hapus unit "${u.blokNoUnit}" (${u.namaProyek}) dari daftar?`)) return;
    try {
      await api.deleteUnitBooking(u._id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const cols = useMemo<ColumnDef<UnitBooking, unknown>[]>(() => {
    const base: ColumnDef<UnitBooking, unknown>[] = [
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        cell: (i) => {
          const meta = UNIT_STATUS_META[i.row.original.status];
          return (
            <span
              className="badge"
              style={{ background: meta.bg, color: meta.c, fontWeight: 700, padding: "3px 10px", borderRadius: 999, fontSize: 12, whiteSpace: "nowrap" }}
            >
              {meta.label}
            </span>
          );
        },
      },
      { accessorKey: "typeUnit", header: "Tipe Unit", size: 120, cell: (i) => i.row.original.typeUnit || <span className="hint">—</span> },
      { accessorKey: "blokNoUnit", header: "Blok / No Unit", size: 130 },
      { accessorKey: "namaProyek", header: "Proyek" },
      { accessorKey: "note", header: "Catatan", cell: (i) => i.row.original.note || <span className="hint">—</span> },
      {
        accessorKey: "updatedAt",
        header: "Update",
        size: 110,
        cell: (i) => dateLabel(i.row.original.updatedAt),
      },
    ];
    if (canManage) {
      base.push({
        id: "act",
        header: "",
        size: 280,
        enableSorting: false,
        cell: (i) => {
          const u = i.row.original;
          return (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {STATUS_OPTS.filter((s) => s !== u.status).map((s) => (
                <button key={s} type="button" onClick={() => quickStatus(u, s)} style={{ ...actBtnStyle, color: "#0f6b46" }}>
                  {UNIT_STATUS_META[s].label}
                </button>
              ))}
              <button type="button" onClick={() => setDraft({ ...u })} style={{ ...actBtnStyle, color: "#16233b" }}>
                edit
              </button>
              <button type="button" onClick={() => del(u)} style={{ ...actBtnStyle, color: "#b3261e" }}>
                hapus
              </button>
            </div>
          );
        },
      });
    }
    return base;
  }, [canManage]);

  return (
    <div className="sales-staff">
      <div style={{ maxWidth: draft ? 640 : 1100 }}>
        <Card
          title={draft ? (draft._id ? "Ubah Unit" : "Tambah Unit") : "Master Booking — Status Unit"}
          right={!draft && canManage && <Button onClick={() => setDraft(emptyUnitBooking())}>+ Tambah Unit</Button>}
        >
          {err && <div className="st-empty-msg" style={{ color: "#b3261e" }}>⚠ {err}</div>}
          {msg && <div className="st-empty-msg" style={{ color: "#1f9d54" }}>✓ {msg}</div>}

          {draft ? (
            <>
              <Field label="Nama Proyek" required>
                {masterProjects.length === 0 ? (
                  <TextInput value={draft.namaProyek} onChange={(v) => setDraft({ ...draft, namaProyek: v })} placeholder="mis. Le Hauz Limo" />
                ) : (
                  <SearchSelect
                    value={draft.namaProyek}
                    onChange={(v) => setDraft({ ...draft, namaProyek: v })}
                    options={masterProjects.map((p) => ({ value: p.name, label: p.name, sub: p.gp }))}
                    placeholder="Cari / pilih proyek…"
                  />
                )}
              </Field>
              {unitsForDraftProject.length > 0 ? (
                <Field label="Kavling / Unit" required hint="Dari master Perencanaan — mengisi Type Unit otomatis">
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
                      <TextInput value={draft.typeUnit ?? ""} onChange={(v) => setDraft({ ...draft, typeUnit: v })} placeholder="mis. 36/72" />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Blok / No. Unit" required>
                      <TextInput value={draft.blokNoUnit} onChange={(v) => setDraft({ ...draft, blokNoUnit: v })} placeholder="mis. B7" />
                    </Field>
                  </div>
                </div>
              )}
              <Field label="Status">
                <Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v as UnitStatus })} options={STATUS_OPTS} />
              </Field>
              <Field label="Catatan" hint="opsional">
                <TextInput value={draft.note ?? ""} onChange={(v) => setDraft({ ...draft, note: v })} />
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button loading={busy} onClick={save}>
                  {draft._id ? "Simpan" : "Tambah"}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Batal
                </Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ maxWidth: 320, marginBottom: 8 }}>
                <Field label="Proyek">
                  <Select value={projectFilter} onChange={setProjectFilter} options={projects} placeholder="Semua proyek" />
                </Field>
              </div>

              {filtered.length === 0 ? (
                <EmptyState icon="🏠" message={canManage ? "Belum ada unit. Tambah dengan tombol di atas." : "Belum ada data unit."} />
              ) : (
                <DataTable columns={cols} data={filtered} pageSize={10} searchable={filtered.length > 10} searchPlaceholder="Cari tipe / blok / proyek…" empty="Belum ada unit." />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
