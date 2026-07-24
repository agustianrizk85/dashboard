import { useCallback, useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "../../api/client";
import type { BuildingType, Kavling, ProjectDetail } from "../../types";
import { InfoTip } from "../ui";
import { DataTable } from "@/components/DataTable";
import { KavlingImportModal } from "../KavlingImportModal";
import { SearchSelect, type SelectOption } from "../SearchSelect";

/**
 * KavlingEditor — Fase 2. Manages the Blok master + the Kavling (units) table for
 * the selected project, each kavling referencing a BuildingType + Blok. The table
 * is sortable / paginated / searchable (react-table); tipe & blok use searchable
 * dropdowns. Jumlah Unit/Tipe derive from here.
 */
export function KavlingEditor({
  projectId,
  types,
  canManage,
  onChanged,
}: {
  projectId: string;
  types: BuildingType[];
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    api
      .project(projectId)
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [projectId]);
  useEffect(reload, [reload]);

  const run = (p: Promise<unknown>) =>
    p.then(() => {
      setErr("");
      reload();
      onChanged?.(); // refresh the Proyek tab's derived Unit/Tipe counts
    }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));

  const [blokName, setBlokName] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [draft, setDraft] = useState({ noKav: "", typeId: "", blokId: "", luasBangunan: "", lebarKavling: "" });

  const typeById = (id: string) => types.find((t) => t.id === id);
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);

  if (!detail) return <div className="empty-note">Memuat kavling…</div>;

  const bloks = detail.bloks;
  const kavling = detail.kavling;
  const blokById = (id: string) => bloks.find((b) => b.id === id);
  const distinctTypes = new Set(kavling.filter((k) => k.typeId).map((k) => k.typeId)).size;

  const typeOpts: SelectOption[] = types.map((t) => ({ value: t.id, label: t.name, hint: `${t.luasBangunan}/${t.luasTanah}` }));
  const blokOpts: SelectOption[] = bloks.map((b) => ({ value: b.id, label: b.name }));
  const addBlok = () => {
    if (!blokName.trim()) return;
    void run(api.saveBlok(projectId, { name: blokName.trim() })).then(() => setBlokName(""));
  };
  const addKavling = () => {
    if (!draft.noKav.trim()) return;
    void run(
      api.saveKavling(projectId, {
        noKav: draft.noKav.trim(),
        typeId: draft.typeId,
        blokId: draft.blokId,
        luasBangunan: num(draft.luasBangunan),
        lebarKavling: draft.lebarKavling.trim(),
      }),
    ).then(() => setDraft({ noKav: "", typeId: "", blokId: "", luasBangunan: "", lebarKavling: "" }));
  };
  const draftType = (id: string) => {
    const t = typeById(id);
    setDraft((d) => ({ ...d, typeId: id, luasBangunan: t ? String(t.luasBangunan) : d.luasBangunan }));
  };

  const cols: ColumnDef<Kavling, unknown>[] = [
    {
      accessorKey: "noKav",
      header: "No. Kav",
      size: 96,
      cell: (i) =>
        canManage ? (
          <input className="me-in" defaultValue={i.row.original.noKav} onBlur={(e) => e.target.value.trim() !== i.row.original.noKav && void run(api.saveKavling(projectId, { ...i.row.original, noKav: e.target.value.trim() }))} />
        ) : (
          i.row.original.noKav
        ),
    },
    {
      id: "tipe",
      header: "Tipe",
      accessorFn: (k) => typeById(k.typeId)?.name ?? "",
      cell: (i) => {
        const k = i.row.original;
        return canManage ? (
          <SearchSelect
            size="sm"
            value={k.typeId}
            options={typeOpts}
            placeholder="— tipe —"
            onChange={(v) => {
              const t = typeById(v);
              void run(api.saveKavling(projectId, { ...k, typeId: v, luasBangunan: t ? t.luasBangunan : k.luasBangunan }));
            }}
          />
        ) : (
          typeById(k.typeId)?.name ?? "—"
        );
      },
    },
    {
      id: "blok",
      header: "Blok",
      accessorFn: (k) => blokById(k.blokId)?.name ?? "",
      cell: (i) => {
        const k = i.row.original;
        return canManage ? (
          <SearchSelect size="sm" value={k.blokId} options={blokOpts} placeholder="— blok —" onChange={(v) => void run(api.saveKavling(projectId, { ...k, blokId: v }))} />
        ) : (
          blokById(k.blokId)?.name ?? "—"
        );
      },
    },
    {
      accessorKey: "luasBangunan",
      header: "Luas Bangunan",
      size: 84,
      cell: (i) =>
        canManage ? (
          <input className="me-in me-num" type="number" defaultValue={i.row.original.luasBangunan} onBlur={(e) => num(e.target.value) !== i.row.original.luasBangunan && void run(api.saveKavling(projectId, { ...i.row.original, luasBangunan: num(e.target.value) }))} />
        ) : (
          <span className="num">{i.row.original.luasBangunan}</span>
        ),
    },
    {
      accessorKey: "lebarKavling",
      header: "Luas Tanah",
      size: 92,
      cell: (i) => {
        const k = i.row.original;
        return canManage ? (
          <input
            className="me-in me-num"
            defaultValue={k.lebarKavling}
            onBlur={(e) => e.target.value.trim() !== k.lebarKavling && void run(api.saveKavling(projectId, { ...k, lebarKavling: e.target.value.trim() }))}
          />
        ) : (
          k.lebarKavling || "—"
        );
      },
    },
  ];
  if (canManage) {
    cols.push({
      id: "act",
      header: "",
      size: 60,
      enableSorting: false,
      cell: (i) => (
        <button type="button" className="rv-btn reject" onClick={() => void run(api.deleteKavling(projectId, i.row.original.id))}>
          Hapus
        </button>
      ),
    });
  }

  return (
    <section className="panel deliverable-editor kavling-editor">
      <div className="ed-head">
        <div>
          <h2 className="panel-title ed-title">
            Kavling &amp; Blok
            <InfoTip tip="Unit per proyek. Tiap kavling punya Tipe (dari master) + Blok. Jumlah Unit/Tipe di Proyek Master dihitung dari sini." />
          </h2>
          <div className="ed-sub">
            {detail.gp} · {detail.name} · <b>{kavling.length} kavling</b> · {bloks.length} blok · {distinctTypes} tipe
          </div>
        </div>
        {canManage && (
          <button type="button" className="btn-ghost sm kav-import-btn" title="Impor kavling massal dari spreadsheet / XLSX / CSV" onClick={() => setShowImport(true)}>
            ⇪ Import
          </button>
        )}
      </div>

      {showImport && (
        <KavlingImportModal
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setErr("");
            reload();
            onChanged?.();
          }}
        />
      )}

      {/* Blok master */}
      <div className="kav-blok-bar">
        <span className="kav-blok-label">Blok</span>
        {bloks.map((b) => (
          <span key={b.id} className="kav-blok-chip">
            {b.name}
            {canManage && (
              <button type="button" className="kav-blok-x" title="Hapus blok" onClick={() => void run(api.deleteBlok(projectId, b.id))}>
                ×
              </button>
            )}
          </span>
        ))}
        {bloks.length === 0 && <span className="kav-blok-empty">Belum ada blok</span>}
        {canManage && (
          <span className="kav-blok-add">
            <input className="me-in" placeholder="+ Blok (mis. A)" value={blokName} onChange={(e) => setBlokName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBlok()} />
            <button type="button" className="btn-primary sm" disabled={!blokName.trim()} onClick={addBlok}>
              Tambah
            </button>
          </span>
        )}
      </div>

      {/* Add kavling form — luas bangunan ikut Tipe (auto), tak perlu diisi */}
      {canManage && (
        <div className="kav-add">
          <input className="me-in kav-add-no" placeholder="No kav (A1)" value={draft.noKav} onChange={(e) => setDraft((d) => ({ ...d, noKav: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addKavling()} />
          <div className="kav-add-sel">
            <SearchSelect value={draft.typeId} options={typeOpts} placeholder="— tipe —" onChange={draftType} />
          </div>
          <div className="kav-add-sel">
            <SearchSelect value={draft.blokId} options={blokOpts} placeholder="— blok —" onChange={(v) => setDraft((d) => ({ ...d, blokId: v }))} />
          </div>
          <input className="me-in me-num kav-add-num" placeholder="Luas Tanah" value={draft.lebarKavling} onChange={(e) => setDraft((d) => ({ ...d, lebarKavling: e.target.value }))} />
          <button type="button" className="btn-primary sm" disabled={!draft.noKav.trim()} onClick={addKavling}>
            + Tambah
          </button>
        </div>
      )}

      <div className="panel-pad">
        <DataTable columns={cols} data={kavling} pageSize={10} searchPlaceholder="Cari no kav / tipe / blok…" empty="Belum ada kavling — tambah unit pertama di atas." minWidth={680} />
      </div>
      {err && <div className="review-err">{err}</div>}
    </section>
  );
}
