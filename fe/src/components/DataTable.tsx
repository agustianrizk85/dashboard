import { useState, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import "./datatable.css";

/**
 * DataTable — a reusable sortable / paginated / searchable table built on
 * @tanstack/react-table. Columns carry their own cell renderers, so inline-edit
 * inputs work inside CRUD tables. Pass `toolbar` for an add button/form.
 */
export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Cari…",
  onRowClick,
  isSelected,
  empty = "Tidak ada data.",
  toolbar,
  minWidth,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  isSelected?: (row: T) => boolean;
  empty?: string;
  toolbar?: ReactNode;
  minWidth?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: ps } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * ps + 1;
  const to = Math.min(total, (pageIndex + 1) * ps);

  return (
    <div className="dt">
      {(searchable || toolbar) && (
        <div className="dt-toolbar">
          {searchable && (
            <input
              className="dt-search"
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          )}
          {toolbar && <div className="dt-toolbar-slot">{toolbar}</div>}
        </div>
      )}
      <div className="dt-scroll">
        <table className="dt-table" style={minWidth ? { minWidth } : undefined}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                      className={sortable ? "dt-th-sort" : ""}
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                    >
                      <span className="dt-th-inner">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortable && <span className={`dt-sort ${dir || ""}`}>{dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}</span>}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={`${onRowClick ? "dt-clickable" : ""} ${isSelected?.(row.original) ? "dt-on" : ""}`}
              >
                {row.getVisibleCells().map((c) => (
                  <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="dt-empty">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > ps && (
        <div className="dt-pager">
          <span className="dt-count">
            {from}–{to} dari {total}
          </span>
          <div className="dt-pager-btns">
            <button type="button" disabled={!table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)} title="Awal">
              «
            </button>
            <button type="button" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} title="Sebelumnya">
              ‹
            </button>
            <span className="dt-page">
              Hal {pageIndex + 1}/{table.getPageCount()}
            </span>
            <button type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} title="Berikutnya">
              ›
            </button>
            <button type="button" disabled={!table.getCanNextPage()} onClick={() => table.setPageIndex(table.getPageCount() - 1)} title="Akhir">
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
