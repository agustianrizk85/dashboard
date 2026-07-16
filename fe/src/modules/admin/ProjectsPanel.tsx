import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { WmsSearch } from "@/components/wms/widgets";

/* ─────────────────────────────────────────────────────────────────────────
 * Proyek panel (Admin): map a real-estate project to the Meta accounts
 * (WhatsApp numbers / Instagram accounts) that serve it and the sales team
 * that handles it. Backend = metaapi (/be/meta/api/meta/projects). This is the
 * source of truth for attribution, routing, and per-project dashboard filters.
 * ──────────────────────────────────────────────────────────────────────── */

const META = ((import.meta.env.VITE_META_API as string) ?? "/be/meta").replace(/\/$/, "") + "/api";
const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");
// Master project list is owned by Perencanaan; the Proyek name is picked from it
// (not free-typed). Dev falls back to :8082 (no proxy); prod uses /be/perencanaan.
const PERENCANAAN = ((import.meta.env.VITE_PERENCANAAN_API as string) ?? "http://localhost:8082").replace(/\/$/, "") + "/api";
const TOKEN_KEY = "gp_dashboard_token";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: "Bearer " + t, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

interface Acct {
  kind: "wa" | "ig" | "ad";
  ref: string;
  label: string;
}
interface Sales {
  email: string;
  name: string;
}
interface Project {
  id: number;
  name: string;
  note: string;
  accounts: Acct[] | null;
  sales: Sales[] | null;
}
interface Opt {
  ref: string;
  label: string;
}
interface UserOpt {
  email: string;
  name: string;
}
interface MasterProj {
  id: string;
  gp: string;
  name: string;
  lokasi: string;
}

const emptyDraft = { id: 0, name: "", note: "", wa: new Set<string>(), ig: new Set<string>(), ad: new Set<string>(), sales: new Set<string>() };
type Draft = { id: number; name: string; note: string; wa: Set<string>; ig: Set<string>; ad: Set<string>; sales: Set<string> };

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [waOpts, setWaOpts] = useState<Opt[]>([]);
  const [igOpts, setIgOpts] = useState<Opt[]>([]);
  const [adOpts, setAdOpts] = useState<Opt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [masterProjects, setMasterProjects] = useState<MasterProj[]>([]);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [pj, wa, ig, conns, us, mp] = await Promise.all([
        fetch(`${META}/meta/projects`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${META}/meta/whatsapp`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        fetch(`${META}/meta/instagram/accounts`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        fetch(`${META}/meta/connections`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        // Sales pool = users of the sales/marketing depts. Uses the per-dept
        // endpoint (any authed director can read it) — not the super-only
        // /admin/users — so the picker isn't empty for a non-super director.
        Promise.all(
          ["sales", "marketing", "digitalmarketing"].map((d) =>
            fetch(`${AUTH}/dept/${d}/users`, { headers: authHeaders() })
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => []),
          ),
        ).then((lists) => lists.flatMap((x) => (Array.isArray(x) ? x : x.users ?? []))),
        // Master proyek (Perencanaan) — sumber pilihan Nama Proyek. Tolerant: kalau
        // service mati / token ditolak, list kosong dan form fallback ke input teks.
        fetch(`${PERENCANAAN}/projects`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      setProjects(pj.projects ?? []);
      // WA numbers: wabas[].phones[] → {id=phone_number_id, display_phone_number}
      const waList: Opt[] = [];
      for (const w of wa.wabas ?? []) {
        for (const p of w.phones ?? []) {
          if (p.id) waList.push({ ref: String(p.id), label: p.display_phone_number || p.verified_name || String(p.id) });
        }
      }
      setWaOpts(waList);
      // IG accounts: {accounts:[{id=ig user id, username}]} (defensive on shape)
      const igArr = ig.accounts ?? ig.igAccounts ?? [];
      setIgOpts(igArr.filter((a: { id?: string }) => a.id).map((a: { id: string; username?: string }) => ({ ref: String(a.id), label: a.username ? "@" + a.username : String(a.id) })));
      // Ad accounts: one per connection (its pinned ad_account_id).
      const connArr = conns.connections ?? [];
      const adSeen = new Set<string>();
      const adList: Opt[] = [];
      for (const cn of connArr as Array<{ label?: string; ad_account_id?: string; meta_user_name?: string }>) {
        const ref = (cn.ad_account_id || "").replace(/^act_/, "");
        if (!ref || adSeen.has(ref)) continue;
        adSeen.add(ref);
        adList.push({ ref, label: `${cn.label || cn.meta_user_name || "Akun"} · act_${ref}` });
      }
      setAdOpts(adList);
      // Sales pool: dedupe the merged dept users by e-mail.
      const arr: Array<{ email?: string; name?: string; username?: string }> = Array.isArray(us) ? us : [];
      const seen = new Set<string>();
      const salesUsers: UserOpt[] = [];
      for (const u of arr) {
        const email = (u.email || u.username || "").toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        salesUsers.push({ email, name: u.name || u.username || email });
      }
      setUsers(salesUsers);
      // Master projects: perencanaan returns ProjectRollup[]; keep gp + name + lokasi.
      const mpRaw = mp as { projects?: unknown[] } | unknown[] | null;
      const mpArr = (Array.isArray(mpRaw) ? mpRaw : mpRaw?.projects ?? []) as Array<{ id?: string; gp?: string; name?: string; lokasi?: string }>;
      setMasterProjects(
        mpArr
          .filter((p) => p.name)
          .map((p) => ({ id: String(p.id ?? p.name), gp: String(p.gp ?? ""), name: String(p.name), lokasi: String(p.lokasi ?? "") })),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editProject = (p: Project) => {
    setMsg("");
    setDraft({
      id: p.id,
      name: p.name,
      note: p.note ?? "",
      wa: new Set((p.accounts ?? []).filter((a) => a.kind === "wa").map((a) => a.ref)),
      ig: new Set((p.accounts ?? []).filter((a) => a.kind === "ig").map((a) => a.ref)),
      ad: new Set((p.accounts ?? []).filter((a) => a.kind === "ad").map((a) => a.ref)),
      sales: new Set((p.sales ?? []).map((s) => s.email)),
    });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setErr("Nama proyek wajib diisi.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    const accounts: Acct[] = [
      ...[...draft.wa].map((ref) => ({ kind: "wa" as const, ref, label: waOpts.find((o) => o.ref === ref)?.label ?? ref })),
      ...[...draft.ig].map((ref) => ({ kind: "ig" as const, ref, label: igOpts.find((o) => o.ref === ref)?.label ?? ref })),
      ...[...draft.ad].map((ref) => ({ kind: "ad" as const, ref, label: adOpts.find((o) => o.ref === ref)?.label ?? ref })),
    ];
    const sales: Sales[] = [...draft.sales].map((email) => ({ email, name: users.find((u) => u.email === email)?.name ?? email }));
    try {
      const r = await fetch(`${META}/meta/projects`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: draft.id, name: draft.name.trim(), note: draft.note.trim(), accounts, sales }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg(draft.id ? "Proyek diperbarui." : "Proyek dibuat.");
      setDraft({ ...emptyDraft });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: Project) => {
    if (!confirm(`Hapus proyek "${p.name}"?`)) return;
    try {
      const r = await fetch(`${META}/meta/projects/${p.id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (draft.id === p.id) setDraft({ ...emptyDraft });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const checkGroup = (
    title: ReactNode,
    opts: Opt[],
    emptyMsg: string,
    set: "wa" | "ig" | "ad",
    colLabel: string,
    searchPlaceholder: string,
  ) => (
    <div className="wms-field">
      <span>{title} {opts.length > 0 && <small>({draft[set].size}/{opts.length} dipilih)</small>}</span>
      {opts.length === 0 ? (
        <div className="wms-note small">{emptyMsg}</div>
      ) : (
        <PickerTable
          items={opts}
          getKey={(o) => o.ref}
          columns={[{ id: "label", header: colLabel, value: (o) => o.label }]}
          selected={draft[set]}
          onChange={(next) => setDraft((d) => ({ ...d, [set]: next }))}
          searchPlaceholder={searchPlaceholder}
          emptyText="Tidak ada yang cocok."
        />
      )}
    </div>
  );

  return (
    <div>
      {err && <div className="wms-err" style={{ marginBottom: 10 }}>{err}</div>}
      {msg && <div className="wms-ok" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="wms-grid">
        {/* ── Editor ── */}
        <div className="wms-card wms-col-5">
          <div className="wms-card-h"><h3>{draft.id ? "Edit Proyek" : "Proyek Baru"}</h3></div>
          <div className="wms-field">
            <span>Nama Proyek <small>(dari master Perencanaan)</small></span>
            {masterProjects.length === 0 ? (
              <>
                <input value={draft.name} placeholder="mis. Green Park Serua" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <div className="wms-note small">Master proyek Perencanaan tidak tersedia — ketik manual.</div>
              </>
            ) : (
              <ProjectCombobox
                projects={masterProjects}
                value={draft.name}
                onSelect={(m) => setDraft((d) => ({ ...d, name: m.name, note: d.note.trim() ? d.note : m.lokasi }))}
              />
            )}
          </div>
          <label className="wms-field">
            <span>Catatan <small>(opsional)</small></span>
            <input value={draft.note} placeholder="lokasi / keterangan" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>

          {checkGroup("Nomor WhatsApp", waOpts, "Belum ada nomor WA terhubung.", "wa", "Nomor WA", "Cari nomor WA…")}
          {checkGroup("Akun Instagram", igOpts, "Belum ada akun IG terhubung.", "ig", "Akun IG", "Cari akun IG…")}
          {checkGroup(<>Akun Iklan <small>(filter Ads)</small></>, adOpts, "Belum ada akun iklan terhubung.", "ad", "Akun Iklan", "Cari akun iklan…")}

          <div className="wms-field">
            <span>Tim Sales {users.length > 0 && <small>({draft.sales.size}/{users.length} dipilih)</small>}</span>
            {users.length === 0 ? (
              <div className="wms-note small">Belum ada user marketing/sales.</div>
            ) : (
              <PickerTable
                items={users}
                getKey={(u) => u.email}
                columns={[
                  { id: "name", header: "Nama", value: (u) => u.name },
                  { id: "email", header: "Email", value: (u) => u.email, muted: true },
                ]}
                selected={draft.sales}
                onChange={(next) => setDraft((d) => ({ ...d, sales: next }))}
                searchPlaceholder="Cari nama / email…"
                emptyText="Tidak ada user yang cocok."
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="wms-btn" disabled={busy} onClick={save}>
              {busy ? "Menyimpan…" : draft.id ? "Simpan Perubahan" : "Tambah Proyek"}
            </button>
            {draft.id !== 0 && (
              <button className="wms-btn ghost" disabled={busy} onClick={() => setDraft({ ...emptyDraft })}>Batal</button>
            )}
          </div>
        </div>

        {/* ── List ── */}
        <div className="wms-card wms-col-7">
          <div className="wms-card-h"><h3>Proyek ({projects.length})</h3></div>
          {projects.length === 0 && <div className="wms-empty">Belum ada proyek. Buat di sebelah kiri.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map((p) => (
              <div key={p.id} className="wms-listrow">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <b>{p.name}</b>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button className="wms-linkbtn" onClick={() => editProject(p)}>edit</button>
                    <button className="wms-linkbtn danger" onClick={() => del(p)}>hapus</button>
                  </div>
                </div>
                {p.note && <div className="wms-note small" style={{ margin: "2px 0 0" }}>{p.note}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {(p.accounts ?? []).map((a, i) => (
                    <span key={i} className="wms-badge grey">
                      {a.kind === "wa" ? "📱" : a.kind === "ig" ? "📷" : "💰"} {a.label}
                    </span>
                  ))}
                  {(p.sales ?? []).map((s, i) => (
                    <span key={"s" + i} className="wms-badge">🧑‍💼 {s.name}</span>
                  ))}
                </div>
                {(p.accounts ?? []).length === 0 && (p.sales ?? []).length === 0 && (
                  <div className="wms-note small" style={{ marginTop: 6 }}>Belum ada akun/sales.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Generic multi-select picker: searchable, sortable table (TanStack). ──
 * Used for Tim Sales and the WA/IG/Ad account groups. Row click toggles an
 * item; the header checkbox selects/clears exactly the rows matching the
 * current search. `selected` (a Set of item keys) is owned by the parent draft;
 * we hand back the next Set via onChange. */
interface PickerColumn<T> {
  id: string;
  header: string;
  value: (item: T) => string; // used for the cell text, sorting and search
  muted?: boolean; // render in muted colour (e.g. the email column)
}

function PickerTable<T>({
  items,
  getKey,
  columns,
  selected,
  onChange,
  searchPlaceholder,
  emptyText,
}: {
  items: T[];
  getKey: (item: T) => string;
  columns: PickerColumn<T>[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const cbStyle = { width: 16, height: 16, accentColor: "var(--wms-green)", cursor: "pointer" } as const;

  const colDefs = useMemo<ColumnDef<T>[]>(
    () => [
      {
        id: "pick",
        enableSorting: false,
        enableGlobalFilter: false,
        header: ({ table }) => {
          const rows = table.getFilteredRowModel().rows;
          const all = rows.length > 0 && rows.every((r) => selected.has(getKey(r.original)));
          return (
            <input
              type="checkbox"
              aria-label="Pilih semua"
              checked={all}
              onChange={() => {
                const next = new Set(selected);
                for (const r of rows) all ? next.delete(getKey(r.original)) : next.add(getKey(r.original));
                onChange(next);
              }}
              style={cbStyle}
            />
          );
        },
        cell: ({ row }) => (
          <input type="checkbox" checked={selected.has(getKey(row.original))} readOnly tabIndex={-1} style={cbStyle} />
        ),
      },
      ...columns.map(
        (c): ColumnDef<T> => ({
          id: c.id,
          header: c.header,
          accessorFn: (item) => c.value(item),
          cell: c.muted
            ? ({ row }) => <span style={{ color: "var(--wms-muted)" }}>{c.value(row.original)}</span>
            : undefined,
        }),
      ),
    ],
    [columns, selected, onChange, getKey],
  );

  const table = useReactTable({
    data: items,
    columns: colDefs,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: (row, _id, value) =>
      columns
        .map((c) => c.value(row.original))
        .join(" ")
        .toLowerCase()
        .includes(String(value).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const toggleOne = (key: string) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  const sortMark: Record<string, string> = { asc: " ▲", desc: " ▼" };
  const rows = table.getRowModel().rows;
  const colCount = columns.length + 1;

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <WmsSearch value={globalFilter} onChange={setGlobalFilter} placeholder={searchPlaceholder} />
      </div>
      <div style={{ maxHeight: "40vh", overflowY: "auto", border: "1px solid var(--wms-line)", borderRadius: "var(--wms-radius-sm)" }}>
        <table className="wms-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    style={{ cursor: h.column.getCanSort() ? "pointer" : "default", userSelect: "none", width: h.id === "pick" ? 40 : undefined, textAlign: h.id === "pick" ? "center" : "left" }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {sortMark[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="wms-empty">{emptyText}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} onClick={() => toggleOne(getKey(row.original))} style={{ cursor: "pointer" }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ textAlign: cell.column.id === "pick" ? "center" : "left" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Project combobox: type-to-search over the Perencanaan master list. ──
 * Dropdown height is capped at ~4 rows (scroll for the rest). Selecting only
 * happens via a list pick, so a legacy name that isn't in the master survives
 * until the user deliberately replaces it. */
const CB_ROW = 44; // approx px per option → 4 rows visible before scroll
function ProjectCombobox({
  projects,
  value,
  onSelect,
}: {
  projects: MasterProj[];
  value: string;
  onSelect: (p: MasterProj) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? projects.filter((p) => `${p.gp} ${p.name} ${p.lokasi}`.toLowerCase().includes(q)) : projects),
    [projects, q],
  );

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row in range and scrolled into view (keyboard nav).
  useEffect(() => {
    if (active > filtered.length - 1) setActive(Math.max(0, filtered.length - 1));
  }, [filtered.length, active]);
  useEffect(() => {
    if (open) (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (p: MasterProj) => {
    onSelect(p);
    setQuery("");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        choose(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        value={open ? query : value}
        placeholder={value || "Cari / pilih proyek…"}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open}
        aria-controls="proj-cb-list"
        autoComplete="off"
        style={{ width: "100%" }}
      />
      {open && (
        <ul
          id="proj-cb-list"
          ref={listRef}
          role="listbox"
          style={{
            position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0,
            margin: 0, padding: 4, listStyle: "none",
            maxHeight: CB_ROW * 4, overflowY: "auto",
            background: "var(--wms-panel)", border: "1px solid var(--wms-line)",
            borderRadius: "var(--wms-radius-sm)", boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: "10px 10px", color: "var(--wms-muted)", fontSize: 12.5 }}>Tidak ada proyek cocok.</li>
          ) : (
            filtered.map((p, i) => {
              const selected = p.name === value;
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                    background: i === active ? "var(--wms-green-50)" : "transparent",
                    display: "flex", flexDirection: "column", gap: 1,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: "var(--wms-ink)" }}>
                    {p.gp ? `${p.gp} · ` : ""}{p.name}{selected ? " ✓" : ""}
                  </span>
                  {p.lokasi && <span style={{ fontSize: 11.5, color: "var(--wms-muted)" }}>{p.lokasi}</span>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
