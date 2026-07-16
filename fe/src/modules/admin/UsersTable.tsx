/* Users table for the Greenpark Admin panel — TanStack React Table:
 * sortable headers · global search · pagination. Styling from wms.css. */

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { User } from "./adminApi";
import { deptName, roleLabel } from "./roleCatalog";
import { WmsSearch } from "@/components/wms/widgets";

export function UsersTable({ users, onDelete }: { users: User[]; onDelete: (u: User) => void }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "user",
        header: "User",
        accessorFn: (u) => u.name || u.username,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div>
              <b>{u.name}</b>
              <br />
              <small style={{ color: "var(--wms-muted)" }}>
                {u.email && u.email !== u.username ? `${u.username} · ${u.email}` : u.username}
              </small>
            </div>
          );
        },
      },
      {
        id: "roles",
        header: "Jabatan / Role",
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original;
          const roles = Object.entries(u.roles ?? {});
          if (u.super) return <span className="wms-badge warn">Super Admin · semua divisi</span>;
          if (roles.length === 0) return <span style={{ color: "var(--wms-muted)" }}>—</span>;
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roles.map(([dept, role]) => (
                <span key={dept} className="wms-badge grey">
                  {deptName(dept)} · {roleLabel(dept, role)}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div style={{ textAlign: "right" }}>Aksi</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div style={{ textAlign: "right" }}>
            <button className="wms-del" onClick={() => onDelete(row.original)} title="Hapus user">✕</button>
          </div>
        ),
      },
    ],
    [onDelete],
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _colId, value) => {
      const u = row.original;
      const hay = [u.name, u.username, u.email, ...Object.entries(u.roles ?? {}).flat()]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(String(value).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const sortMark: Record<string, string> = { asc: " ▲", desc: " ▼" };

  return (
    <div>
      <div style={{ maxWidth: 280, marginBottom: 12 }}>
        <WmsSearch value={globalFilter} onChange={setGlobalFilter} placeholder="Cari user / divisi / role…" />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="wms-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{ cursor: h.column.getCanSort() ? "pointer" : "default", userSelect: "none" }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {sortMark[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="wms-empty">Tidak ada user yang cocok.</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="wms-pagination">
          <span className="info">
            {total === 0 ? 0 : pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} dari {total} user
          </span>
          <button type="button" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>‹ Sebelumnya</button>
          <span className="page">Hal {pageIndex + 1} / {table.getPageCount()}</span>
          <button type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Berikutnya ›</button>
        </div>
      )}
    </div>
  );
}
