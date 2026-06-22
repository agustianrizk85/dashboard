/**
 * Client for the read-only Google Sheets bridge (sheets-api service, :8091).
 * Hidden tabs are blocked server-side, so anything this returns is safe to show.
 */
const BASE =
  ((import.meta.env.VITE_SHEETS_API as string) ?? "http://localhost:8091") + "/api/sheets";

export type Row = Record<string, string>;

export interface TabInfo {
  title: string;
  sheetId: number;
  index: number;
  rows: number;
  cols: number;
}

export interface TabsResponse {
  spreadsheet: string;
  tabs: TabInfo[];
  /** How many tabs are hidden and therefore withheld by the bridge. */
  hiddenCount: number;
}

export interface SheetData {
  tab: string;
  range: string;
  count: number;
  headers: string[];
  rows: Row[];
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* no JSON body */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const sheetsApi = {
  base: BASE,
  tabs: () => getJSON<TabsResponse>(`${BASE}/tabs`),
  data: (tab: string) => getJSON<SheetData>(`${BASE}/data?tab=${encodeURIComponent(tab)}`),
};

/**
 * Read a field by header name, tolerant of trailing spaces / casing in the
 * sheet headers (e.g. the "GP " column has a trailing space upstream).
 */
export function field(row: Row, name: string): string {
  if (name in row) return row[name] ?? "";
  const want = name.trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === want) return row[k] ?? "";
  }
  return "";
}
