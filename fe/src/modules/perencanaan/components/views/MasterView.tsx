import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import type { MasterKind } from "../../api/client";
import type { AccountInfo, BuildingType, Division, DivisionInfo, GP, MasterData, MasterProjectInfo, ProjectDetail, Task } from "../../types";
import { picName } from "../../lib/format";
import { InfoTip } from "../ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "../Modal";
import { MasterImportModal } from "../MasterImportModal";
import { AddProjectModal } from "../AddProjectModal";
import { ProjectImportModal } from "../ProjectImportModal";
import { KavlingEditor } from "./KavlingEditor";
import { DataTable } from "../DataTable";
import { SearchSelect } from "../SearchSelect";

const CATEGORIES = ["Site Plan", "Desain Unit Hunian", "Desain Kawasan"];

/** Output division options for a task (excludes CEO; adds a "none" option). */
function outputOptions(divisions: DivisionInfo[]): { value: Division; label: string }[] {
  const opts: { value: Division; label: string }[] = [{ value: "", label: "— Tidak ke divisi" }];
  for (const d of divisions) {
    if (d.division) opts.push({ value: d.division, label: d.label });
  }
  return opts;
}

/**
 * Data Master — the structural reference data, editable by CEO / Kadep. The
 * project portfolio (add new projects, pick how many Site Plans) and a
 * per-project deliverable editor where each task's PIC and output division are
 * assigned dynamically. Day-to-day status lives in the process tabs.
 */
export function MasterView({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  onChanged: () => void;
}) {
  const [data, setData] = useState<MasterData | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  // Tab + selected project live in the URL (?tab=&proj=) so they SURVIVE the
  // realtime remount (the layout re-keys on every backend write). Component
  // state would reset back to "proyek" on each input/save.
  const [sp, setSp] = useSearchParams();
  const SUBS = ["proyek", "produk", "tim", "kavling", "deliverable"] as const;
  type SubTab = (typeof SUBS)[number];
  const sub: SubTab = (SUBS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as SubTab) : "proyek";
  const selectedId = sp.get("proj");
  const setSub = (t: SubTab) =>
    setSp(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("tab", t);
        return n;
      },
      { replace: true },
    );
  const setSelectedId = (id: string | null) =>
    setSp(
      (p) => {
        const n = new URLSearchParams(p);
        if (id) n.set("proj", id);
        else n.delete("proj");
        return n;
      },
      { replace: true },
    );

  const load = useCallback(() => {
    api
      .master()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(load, [load]);

  if (err) return <div className="empty-note error">{err}</div>;
  if (!data) {
    return (
      <div className="empty-note">
        <div className="spinner" /> Memuat data master…
      </div>
    );
  }

  const picAccounts = data.accounts.filter((a) => a.isPic);

  const projectCols: ColumnDef<MasterProjectInfo, unknown>[] = [
    { accessorKey: "no", header: "No", size: 50, cell: (i) => <span className="num">{i.getValue<number>()}</span> },
    { accessorKey: "gp", header: "GP", size: 72 },
    {
      accessorKey: "name",
      header: "Nama",
      cell: (i) => (
        <>
          {i.row.original.name}
          {i.row.original.added && <span className="tag-added">tambahan</span>}
        </>
      ),
    },
    { accessorKey: "lokasi", header: "Lokasi" },
    { accessorKey: "units", header: "Unit", size: 62, cell: (i) => <span className="num">{i.getValue<number>()}</span> },
    { accessorKey: "tasks", header: "Tugas", size: 62, cell: (i) => <span className="num">{i.getValue<number>()}</span> },
  ];
  if (canManage) {
    projectCols.push({
      id: "act",
      header: "",
      size: 76,
      enableSorting: false,
      cell: (i) => {
        const p = i.row.original;
        return (
          <button
            type="button"
            className="rv-btn reject"
            title="Hapus proyek beserta semua tugas, kavling & blok"
            onClick={(e) => {
              e.stopPropagation();
              if (
                !window.confirm(
                  `Hapus proyek "${p.name}"?\n\nSemua tugas, kavling, blok & lampiran proyek ini ikut TERHAPUS PERMANEN dan tidak bisa dikembalikan.`,
                )
              )
                return;
              api
                .deleteProject(p.id)
                .then(() => {
                  if (selectedId === p.id) setSelectedId(null);
                  setErr("");
                  load();
                })
                .catch((e2) => setErr(e2 instanceof Error ? e2.message : String(e2)));
            }}
          >
            Hapus
          </button>
        );
      },
    });
  }

  const accountCols: ColumnDef<AccountInfo, unknown>[] = [
    {
      accessorKey: "name",
      header: "Nama",
      cell: (i) => (
        <span className="acct-name-cell">
          <span className={`avatar pic-${i.row.original.username}`}>{i.row.original.name.slice(0, 1)}</span>
          {i.row.original.name}
        </span>
      ),
    },
    { accessorKey: "roleLabel", header: "Peran", size: 150 },
    { accessorKey: "isPic", header: "PIC", size: 60, cell: (i) => (i.getValue<boolean>() ? "Ya" : "—") },
  ];

  return (
    <div className="view view-master">
      <div className="master-note">
        <span className="master-badge">DATA MASTER</span>
        <span className="master-note-text">
          Struktur acuan: portfolio proyek &amp; pohon deliverable (siapa PIC-nya, output ke divisi
          mana). Status pengerjaan/progress adalah <b>data proses</b> — ada di tab lain.
        </span>
        {canManage && (
          <button className="btn-primary master-note-btn" onClick={() => setAdding(true)}>
            + Proyek
          </button>
        )}
      </div>

      <div className="master-subtabs">
        {([
          { key: "proyek", label: "Proyek", n: data.projects.length },
          { key: "produk", label: "Master Produk", n: data.gps.length + data.types.length + data.lebars.length + data.lokasis.length },
          { key: "tim", label: "Tim & Divisi", n: data.accounts.length },
          { key: "kavling", label: "Kavling & Blok" },
          { key: "deliverable", label: "Deliverable" },
        ] as const).map((t) => (
          <button key={t.key} type="button" className={`msub ${sub === t.key ? "on" : ""}`} onClick={() => setSub(t.key)}>
            {t.label}
            {"n" in t && typeof t.n === "number" && <span className="msub-n">{t.n}</span>}
          </button>
        ))}
      </div>

      {/* 1 · Proyek — the project list; select one to edit its kavling/deliverable */}
      {sub === "proyek" && (
        <section className="panel">
          <h2 className="panel-title">
            Proyek Master · {data.projects.length}
            <InfoTip tip="Klik satu proyek untuk memilihnya, lalu buka tab Kavling atau Deliverable. Kolom Unit dihitung dari kavling; Tugas = jumlah deliverable." />
            {canManage && (
              <button type="button" className="acct-refresh" title="Impor proyek dari spreadsheet" onClick={() => setImporting(true)}>
                ⇪ Import
              </button>
            )}
          </h2>
          <div className="panel-pad">
            <DataTable
              columns={projectCols}
              data={data.projects}
              onRowClick={(p) => setSelectedId(p.id)}
              isSelected={(p) => p.id === selectedId}
              pageSize={10}
              searchPlaceholder="Cari proyek / GP / lokasi…"
              empty="Belum ada proyek — klik + Proyek."
              minWidth={520}
            />
          </div>
        </section>
      )}

      {/* 2 · Master Produk — reference masters reused across projects */}
      {sub === "produk" && (
        <>
          <div className="master-products-hd">
            <span className="mp-eyebrow">Master Produk</span>
            <span className="mp-note">Dipakai ulang antar proyek — isi ini dulu sebelum membuat proyek &amp; kavling.</span>
          </div>
          <div className="master-products-grid">
            <GPMaster gps={data.gps} canManage={canManage} onChanged={load} />
            <TypeMaster types={data.types} canManage={canManage} onChanged={load} />
            <SimpleMaster title="Lebar Kavling" importKind="lebar" tip="Kategori lebar (L3.5, L4, L5). Kavling memilih dari sini." placeholder="mis. L4" items={data.lebars} canManage={canManage} reload={load} save={(v) => api.saveLebar(v).then(load)} del={(id) => api.deleteLebar(id).then(load)} />
            <SimpleMaster title="Lokasi" importKind="lokasi" tip="Master lokasi. Proyek memilih dari sini (bukan ketik bebas)." placeholder="mis. Leuwinanggung" items={data.lokasis} canManage={canManage} reload={load} save={(v) => api.saveLokasi(v).then(load)} del={(id) => api.deleteLokasi(id).then(load)} />
          </div>
        </>
      )}

      {/* 3 · Tim & Divisi — read-only reference from the central SSO */}
      {sub === "tim" && (
        <div className="master-products-grid">
          <section className="panel">
            <h2 className="panel-title">
              Akun &amp; Peran · {data.accounts.length}
              <InfoTip tip="Roster ditarik dari Admin pusat (SSO). Tambah/ubah karyawan di Admin pusat — muncul di sini otomatis." />
              <button type="button" className="acct-refresh" title="Tarik ulang roster dari Admin pusat" onClick={load}>
                ⟳ Muat ulang
              </button>
            </h2>
            <div className="acct-hint">
              Dikelola terpusat di <b>Admin pusat (SSO)</b> — karyawan baru otomatis muncul sebagai PIC.
            </div>
            <div className="panel-pad">
              <DataTable columns={accountCols} data={data.accounts} pageSize={10} searchable={data.accounts.length > 6} searchPlaceholder="Cari nama…" empty="Belum ada akun." />
            </div>
          </section>
          <section className="panel">
            <h2 className="panel-title">
              Divisi Output · {data.divisions.length}
              <InfoTip tip="Tujuan hilir tiap deliverable, dari Departemen pusat. Dipilih per deliverable." />
            </h2>
            <div className="div-chips">
              {data.divisions.map((d) => (
                <span key={d.division || d.label} className={`div-chip out-${d.division || "ceo"}`}>
                  {d.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Kavling & Deliverable are per-project — pick one, then edit. */}
      {(sub === "kavling" || sub === "deliverable") && (
        <div className="master-picker">
          <span className="master-picker-lbl">Proyek</span>
          <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value || null)}>
            <option value="">— pilih proyek —</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.gp ? `${p.gp} · ` : ""}
                {p.name}
              </option>
            ))}
          </select>
          {data.projects.length === 0 && <span className="master-picker-hint">Belum ada proyek — tambah dulu.</span>}
        </div>
      )}

      {sub === "kavling" &&
        (selectedId ? (
          <KavlingEditor key={`kav-${selectedId}`} projectId={selectedId} types={data.types} lebars={data.lebars} canManage={canManage} onChanged={load} />
        ) : (
          <div className="empty-note">Pilih proyek di atas untuk mengelola kavling &amp; blok.</div>
        ))}

      {sub === "deliverable" &&
        (selectedId ? (
          <DeliverableEditor
            key={selectedId}
            projectId={selectedId}
            canManage={canManage}
            picAccounts={picAccounts}
            divisions={data.divisions}
            onChanged={() => {
              load();
              onChanged();
            }}
          />
        ) : (
          <div className="empty-note">Pilih proyek di atas untuk mengelola deliverable.</div>
        ))}

      {adding && (
        <AddProjectModal
          gps={data.gps}
          lokasis={data.lokasis}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            setSelectedId(id);
            load();
            onChanged();
          }}
        />
      )}

      {importing && (
        <ProjectImportModal
          onClose={() => setImporting(false)}
          onDone={() => {
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/** GP (grup) master — DataTable + inline add / edit (save on blur) / delete. */
function GPMaster({ gps, canManage, onChanged }: { gps: GP[]; canManage: boolean; onChanged: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [importing, setImporting] = useState(false);
  const run = (p: Promise<unknown>) =>
    p.then(() => {
      setErr("");
      onChanged();
    }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  const add = () => {
    if (!code.trim()) return;
    void run(api.saveGP({ code: code.trim(), name: name.trim() })).then(() => {
      setCode("");
      setName("");
    });
  };
  const cols: ColumnDef<GP, unknown>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      size: 120,
      cell: (i) =>
        canManage ? (
          <input className="me-in" defaultValue={i.row.original.code} onBlur={(e) => e.target.value.trim() !== i.row.original.code && void run(api.saveGP({ ...i.row.original, code: e.target.value.trim() }))} />
        ) : (
          i.row.original.code
        ),
    },
    {
      accessorKey: "name",
      header: "Nama grup",
      cell: (i) =>
        canManage ? (
          <input className="me-in" defaultValue={i.row.original.name} placeholder="—" onBlur={(e) => e.target.value.trim() !== i.row.original.name && void run(api.saveGP({ ...i.row.original, name: e.target.value.trim() }))} />
        ) : (
          i.row.original.name || "—"
        ),
    },
  ];
  if (canManage) cols.push({ id: "act", header: "", size: 64, enableSorting: false, cell: (i) => <button type="button" className="rv-btn reject" onClick={() => void run(api.deleteGP(i.row.original.id))}>Hapus</button> });
  return (
    <section className="panel">
      <h2 className="panel-title">
        Grup (GP) · {gps.length}
        <InfoTip tip="Master grup/cluster. Proyek memilih GP dari sini (bukan ketik bebas)." />
        {canManage && (
          <button type="button" className="acct-refresh" title="Impor GP dari spreadsheet" onClick={() => setImporting(true)}>
            ⇪ Import
          </button>
        )}
      </h2>
      {canManage && (
        <div className="me-addbar">
          <input className="me-in" style={{ width: 90 }} placeholder="GP1" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <input className="me-in" placeholder="Nama grup (opsional)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button type="button" className="btn-primary sm" disabled={!code.trim()} onClick={add}>+ Tambah</button>
        </div>
      )}
      <div className="panel-pad">
        <DataTable columns={cols} data={gps} pageSize={6} searchable={gps.length > 6} searchPlaceholder="Cari GP…" empty="Belum ada GP." />
      </div>
      {err && <div className="review-err">{err}</div>}
      {importing && <MasterImportModal kind="gp" title="Grup (GP)" onClose={() => setImporting(false)} onDone={onChanged} />}
    </section>
  );
}

/** Building-type master — DataTable + inline CRUD. */
function TypeMaster({ types, canManage, onChanged }: { types: BuildingType[]; canManage: boolean; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [lb, setLb] = useState("");
  const [lt, setLt] = useState("");
  const [err, setErr] = useState("");
  const [importing, setImporting] = useState(false);
  const run = (p: Promise<unknown>) =>
    p.then(() => {
      setErr("");
      onChanged();
    }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);
  const add = () => {
    if (!name.trim()) return;
    void run(api.saveBuildingType({ name: name.trim(), luasBangunan: num(lb), luasTanah: num(lt) })).then(() => {
      setName("");
      setLb("");
      setLt("");
    });
  };
  const cols: ColumnDef<BuildingType, unknown>[] = [
    {
      accessorKey: "name",
      header: "Nama",
      cell: (i) =>
        canManage ? (
          <input className="me-in" defaultValue={i.row.original.name} onBlur={(e) => e.target.value.trim() !== i.row.original.name && void run(api.saveBuildingType({ ...i.row.original, name: e.target.value.trim() }))} />
        ) : (
          i.row.original.name
        ),
    },
    {
      accessorKey: "luasBangunan",
      header: "Bangunan",
      size: 88,
      cell: (i) =>
        canManage ? (
          <input className="me-in me-num" type="number" defaultValue={i.row.original.luasBangunan} onBlur={(e) => num(e.target.value) !== i.row.original.luasBangunan && void run(api.saveBuildingType({ ...i.row.original, luasBangunan: num(e.target.value) }))} />
        ) : (
          <span className="num">{i.row.original.luasBangunan}</span>
        ),
    },
    {
      accessorKey: "luasTanah",
      header: "Tanah",
      size: 88,
      cell: (i) =>
        canManage ? (
          <input className="me-in me-num" type="number" defaultValue={i.row.original.luasTanah} onBlur={(e) => num(e.target.value) !== i.row.original.luasTanah && void run(api.saveBuildingType({ ...i.row.original, luasTanah: num(e.target.value) }))} />
        ) : (
          <span className="num">{i.row.original.luasTanah}</span>
        ),
    },
  ];
  if (canManage) cols.push({ id: "act", header: "", size: 64, enableSorting: false, cell: (i) => <button type="button" className="rv-btn reject" onClick={() => void run(api.deleteBuildingType(i.row.original.id))}>Hapus</button> });
  return (
    <section className="panel">
      <h2 className="panel-title">
        Tipe Bangunan · {types.length}
        <InfoTip tip="Master tipe rumah (mis. Garnet 42/32). Dipakai ulang antar proyek; kavling mengacu ke sini." />
        {canManage && (
          <button type="button" className="acct-refresh" title="Impor tipe dari spreadsheet" onClick={() => setImporting(true)}>
            ⇪ Import
          </button>
        )}
      </h2>
      {canManage && (
        <div className="me-addbar">
          <input className="me-in" placeholder="Garnet" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <input className="me-in me-num" style={{ width: 72 }} type="number" placeholder="42" value={lb} onChange={(e) => setLb(e.target.value)} />
          <input className="me-in me-num" style={{ width: 72 }} type="number" placeholder="32" value={lt} onChange={(e) => setLt(e.target.value)} />
          <button type="button" className="btn-primary sm" disabled={!name.trim()} onClick={add}>+ Tambah</button>
        </div>
      )}
      <div className="panel-pad">
        <DataTable columns={cols} data={types} pageSize={6} searchable={types.length > 6} searchPlaceholder="Cari tipe…" empty="Belum ada tipe." />
      </div>
      {err && <div className="review-err">{err}</div>}
      {importing && <MasterImportModal kind="tipe" title="Tipe Bangunan" onClose={() => setImporting(false)} onDone={onChanged} />}
    </section>
  );
}

/** Generic single-field ({id,name}) master — used by Lebar + Lokasi. */
function SimpleMaster<T extends { id: string; name: string }>({
  title,
  importKind,
  tip,
  placeholder,
  items,
  canManage,
  reload,
  save,
  del,
}: {
  title: string;
  importKind: MasterKind;
  tip: string;
  placeholder: string;
  items: T[];
  canManage: boolean;
  reload: () => void;
  save: (v: Partial<T>) => Promise<unknown>;
  del: (id: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [importing, setImporting] = useState(false);
  const run = (p: Promise<unknown>) =>
    p.then(() => {
      setErr("");
    }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  const add = () => {
    if (!name.trim()) return;
    void run(save({ name: name.trim() } as Partial<T>)).then(() => setName(""));
  };
  const cols: ColumnDef<T, unknown>[] = [
    {
      accessorKey: "name",
      header: "Nama",
      cell: (i) =>
        canManage ? (
          <input className="me-in" defaultValue={i.row.original.name} onBlur={(e) => e.target.value.trim() !== i.row.original.name && void run(save({ ...i.row.original, name: e.target.value.trim() }))} />
        ) : (
          i.row.original.name
        ),
    },
  ];
  if (canManage) cols.push({ id: "act", header: "", size: 64, enableSorting: false, cell: (i) => <button type="button" className="rv-btn reject" onClick={() => void run(del(i.row.original.id))}>Hapus</button> });
  return (
    <section className="panel">
      <h2 className="panel-title">
        {title} · {items.length}
        <InfoTip tip={tip} />
        {canManage && (
          <button type="button" className="acct-refresh" title={`Impor ${title} dari spreadsheet`} onClick={() => setImporting(true)}>
            ⇪ Import
          </button>
        )}
      </h2>
      {canManage && (
        <div className="me-addbar">
          <input className="me-in" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button type="button" className="btn-primary sm" disabled={!name.trim()} onClick={add}>+ Tambah</button>
        </div>
      )}
      <div className="panel-pad">
        <DataTable columns={cols} data={items} pageSize={6} searchable={items.length > 6} searchPlaceholder="Cari…" empty="Belum ada data." />
      </div>
      {err && <div className="review-err">{err}</div>}
      {importing && <MasterImportModal kind={importKind} title={title} onClose={() => setImporting(false)} onDone={reload} />}
    </section>
  );
}

function DeliverableEditor({
  projectId,
  canManage,
  picAccounts,
  divisions,
  onChanged,
}: {
  projectId: string;
  canManage: boolean;
  picAccounts: AccountInfo[];
  divisions: DivisionInfo[];
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");

  const reload = useCallback(() => {
    api
      .project(projectId)
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [projectId]);

  useEffect(reload, [reload]);

  const cats = detail?.categories ?? [];
  const active = activeCat && cats.some((c) => c.category === activeCat) ? activeCat : cats[0]?.category ?? "";
  const activeCatObj = cats.find((c) => c.category === active);
  const outOpts = useMemo(() => outputOptions(divisions), [divisions]);

  const apply = (p: Promise<ProjectDetail>) =>
    p
      .then((d) => {
        setDetail(d);
        onChanged();
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

  const catCount = (cat: string) => (detail?.tasks.filter((t) => t.category === cat).length ?? 0);

  if (err) return <div className="empty-note error">{err}</div>;
  if (!detail) return <div className="empty-note">Memuat deliverable…</div>;

  return (
    <section className="panel deliverable-editor">
      <div className="ed-head">
        <div>
          <h2 className="panel-title ed-title">
            Editor Deliverable
            <InfoTip tip="Tambah/hapus deliverable dan tentukan PIC + output divisi. Ini struktur (master), bukan status pengerjaan." />
          </h2>
          <div className="ed-sub">
            {detail.gp} · {detail.name} · <b>{detail.total} tugas</b>
          </div>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Tambah Deliverable
          </button>
        )}
      </div>

      <div className="ed-tabs">
        {cats.map((c) => (
          <button
            key={c.category}
            className={`ed-tab ${c.category === active ? "on" : ""}`}
            onClick={() => setActiveCat(c.category)}
          >
            {c.category}
            <span className="ed-tab-count">{catCount(c.category)}</span>
          </button>
        ))}
      </div>

      <div className="ed-body">
        {activeCatObj?.groups.map((g) => {
          const rows = detail.tasks.filter((t) => t.category === active && t.group === g.group);
          return (
            <div className="ed-group" key={g.group}>
              <div className="ed-group-head">
                <span className="ed-group-name">{g.group}</span>
                <span className="ed-group-meta">{rows.length} tugas</span>
              </div>
              <div className="ed-rows">
                {rows.map((t) => (
                  <TaskEditRow
                    key={t.id}
                    task={t}
                    canManage={canManage}
                    picAccounts={picAccounts}
                    outOpts={outOpts}
                    onReassign={(pic, output) => apply(api.reassignTask(projectId, t.id, pic, output))}
                    onRemove={() => apply(api.removeTask(projectId, t.id))}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <AddDeliverableModal
          defaultCategory={active || CATEGORIES[0]}
          picAccounts={picAccounts}
          outOpts={outOpts}
          onClose={() => setAdding(false)}
          onAdd={(input) => apply(api.addTask(projectId, input)).then(() => setAdding(false))}
        />
      )}
    </section>
  );
}

function TaskEditRow({
  task,
  canManage,
  picAccounts,
  outOpts,
  onReassign,
  onRemove,
}: {
  task: Task;
  canManage: boolean;
  picAccounts: AccountInfo[];
  outOpts: { value: Division; label: string }[];
  onReassign: (pic: string, output: Division) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ed-row">
      <div className="ed-row-name">
        {task.name}
        {task.weighted && <span className="tag-100">100%</span>}
      </div>

      {canManage ? (
        <div className="ed-row-controls">
          <div className="ed-field">
            <span className="ed-field-label">PIC</span>
            <div className="ed-pic-pick">
              <span className={`avatar sm pic-${task.pic}`}>{picName(task.pic).slice(0, 1)}</span>
              <SearchSelect
                size="sm"
                value={task.pic}
                clearable={false}
                placeholder="— PIC —"
                options={picAccounts.map((a) => ({ value: a.username, label: a.name }))}
                onChange={(v) => onReassign(v, task.output)}
              />
            </div>
          </div>
          <div className="ed-field">
            <span className="ed-field-label">Output ke</span>
            <SearchSelect
              size="sm"
              value={task.output}
              placeholder="— Tidak ke divisi —"
              options={outOpts.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label }))}
              onChange={(v) => onReassign(task.pic, v)}
            />
          </div>
          <button className="ed-del" title="Hapus deliverable" onClick={onRemove}>
            Hapus
          </button>
        </div>
      ) : (
        <div className="ed-row-controls">
          <span className={`avatar sm pic-${task.pic}`} title={picName(task.pic)}>
            {picName(task.pic).slice(0, 1)}
          </span>
          {task.output ? (
            <span className={`div-chip sm out-${task.output}`}>{task.output}</span>
          ) : (
            <span className="ed-row-none">—</span>
          )}
        </div>
      )}
    </div>
  );
}

function AddDeliverableModal({
  defaultCategory,
  picAccounts,
  outOpts,
  onClose,
  onAdd,
}: {
  defaultCategory: string;
  picAccounts: AccountInfo[];
  outOpts: { value: Division; label: string }[];
  onClose: () => void;
  onAdd: (input: {
    category: string;
    group: string;
    name: string;
    pic: string;
    output: Division;
    weighted: boolean;
  }) => void;
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [pic, setPic] = useState(picAccounts[0]?.username ?? "");
  const [output, setOutput] = useState<Division>("");
  const [weighted, setWeighted] = useState(false);

  const valid = name.trim() && group.trim() && pic;

  return (
    <Modal title="Tambah Deliverable" sub="Tentukan PIC & output divisi" onClose={onClose} width={620}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onAdd({ category, group: group.trim(), name: name.trim(), pic, output, weighted });
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span>Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Sub-deliverable</span>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="mis. Site Plan 2 / Denah" />
          </label>
        </div>
        <label className="form-field">
          <span>Nama tugas</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Siteplan teknis" />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>PIC (penugasan)</span>
            <select value={pic} onChange={(e) => setPic(e.target.value)}>
              {picAccounts.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.name} · {a.roleLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Output ke divisi</span>
            <select value={output} onChange={(e) => setOutput(e.target.value as Division)}>
              {outOpts.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="chk">
          <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
          Bagian dari milestone 100% (deliverable berbobot)
        </label>
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={!valid}>
            Tambah Deliverable
          </button>
        </div>
      </form>
    </Modal>
  );
}
