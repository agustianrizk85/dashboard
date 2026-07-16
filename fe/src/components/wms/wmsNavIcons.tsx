/* Sidebar nav icons for the WMS shell. Every module passes plain-text nav
 * labels; WmsShell asks navIcon() for a matching glyph so all divisions get
 * consistent icons without each module wiring its own. Icons are inline,
 * stroke-based, and use currentColor so they follow the active/hover state and
 * the light/dark theme. Match rules are ordered most-specific first. */
import type { ReactNode } from "react";

function Ic({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  home: <Ic><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></Ic>,
  building: <Ic><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /><path d="M11 21v-4h2v4" /></Ic>,
  shield: <Ic><path d="M12 3 5 6v5c0 4.2 3 7.4 7 8.5 4-1.1 7-4.3 7-8.5V6z" /><path d="m9 11 2 2 4-4" /></Ic>,
  megaphone: <Ic><path d="M4 10v4a1 1 0 0 0 1 1h2l4 4V5L7 9H5a1 1 0 0 0-1 1Z" /><path d="M15 8a4 4 0 0 1 0 8" /></Ic>,
  trending: <Ic><path d="M4 17l6-6 3 3 7-7" /><path d="M16 7h4v4" /></Ic>,
  wallet: <Ic><path d="M4 7h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z" /><path d="M4 7V6a2 2 0 0 1 2-2h9" /><circle cx="16" cy="13" r="1.3" /></Ic>,
  wrench: <Ic><path d="M15.5 5.5a4 4 0 0 0-5.3 5l-6 6L6.5 19l6-6a4 4 0 0 0 5-5.3l-2.5 2.5-2.3-.6-.6-2.3z" /></Ic>,
  headset: <Ic><path d="M5 13v-1a7 7 0 0 1 14 0v1" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19a4 4 0 0 1-4 3h-3" /></Ic>,
  clipboard: <Ic><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H9z" /><path d="m9 13 2 2 4-4" /></Ic>,
  chat: <Ic><path d="M20 12a8 8 0 0 1-11.4 7.2L4 20.5l1.3-4.4A8 8 0 1 1 20 12Z" /></Ic>,
  inbox: <Ic><path d="M4 4h16v16H4z" /><path d="M4 13h4l1.5 2h5L16 13h4" /></Ic>,
  kanban: <Ic><rect x="4" y="4" width="4" height="16" rx="1" /><rect x="10" y="4" width="4" height="11" rx="1" /><rect x="16" y="4" width="4" height="14" rx="1" /></Ic>,
  layers: <Ic><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Ic>,
  pencil: <Ic><path d="M15 5l4 4" /><path d="M4 20l1-4L16 5l3 3L8 19z" /></Ic>,
  users: <Ic><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" /></Ic>,
  database: <Ic><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v6c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-6" /><path d="M4.5 11.5v6c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-6" /></Ic>,
  truck: <Ic><rect x="2" y="7" width="12" height="9" rx="1.5" /><path d="M14 10h3.5L21 13.5V16h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></Ic>,
  file: <Ic><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 13h5M10 16h5" /></Ic>,
  clock: <Ic><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.8" /></Ic>,
  sync: <Ic><path d="M20 11a8 8 0 0 0-14-4l-2 2" /><path d="M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14 4l2-2" /><path d="M20 19v-4h-4" /></Ic>,
  gear: <Ic><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M4.2 7l2.1 1.2M17.7 15.8 19.8 17M4.2 17l2.1-1.2M17.7 8.2 19.8 7M3 12h2.5M18.5 12H21" /></Ic>,
  gauge: <Ic><circle cx="12" cy="12" r="8" /><path d="M12 12l3.5-3" /><circle cx="12" cy="12" r="1" /><path d="M12 4v1.5M20 12h-1.5M5.5 12H4" /></Ic>,
  linechart: <Ic><path d="M4 4v16h16" /><path d="m7 14 3-4 3 2 5-7" /></Ic>,
  trophy: <Ic><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11" /><path d="M9.5 20h5M12 14v6" /></Ic>,
  camera: <Ic><rect x="3" y="6.5" width="18" height="13" rx="3.5" /><circle cx="12" cy="13" r="3.3" /><circle cx="17" cy="9.5" r="0.7" /></Ic>,
  at: <Ic><circle cx="12" cy="12" r="3.5" /><path d="M15.5 12v1.2a2.6 2.6 0 0 0 5.2 0V12a8.7 8.7 0 1 0-3.5 7" /></Ic>,
  grid: <Ic><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Ic>,
  key: <Ic><circle cx="9" cy="12" r="3.5" /><path d="M12.5 12H21l-2 2 2 2M16 12v3" /></Ic>,
  workflow: <Ic><rect x="3" y="4" width="6" height="5" rx="1.5" /><rect x="15" y="15" width="6" height="5" rx="1.5" /><path d="M9 6.5h4a2 2 0 0 1 2 2v9" /></Ic>,
  dot: <Ic><circle cx="12" cy="12" r="2.5" /></Ic>,
} as const;

type IconName = keyof typeof icons;

// Ordered most-specific → generic; first keyword hit wins.
const RULES: [string[], IconName][] = [
  [["output"], "layers"],
  [["gambar", "drawing"], "pencil"],
  [["papan", "cicle", "kanban", "board"], "kanban"],
  [["alur"], "workflow"],
  [["kelola user"], "users"],
  [["master pt"], "building"],
  [["master divisi"], "grid"],
  [["master role"], "shield"],
  [["data master", "master data", "database", "data"], "database"],
  [["beranda", "ringkasan", "overview", "dashboard"], "home"],
  [["perencanaan", "proyek", "project"], "building"],
  [["legal", "perizin", "permit", "izin"], "shield"],
  [["performa", "iklan", "ads", "marketing"], "megaphone"],
  [["sales", "penjualan", "booking"], "trending"],
  [["keuangan", "kas", "revenue", "akad", "kpr"], "wallet"],
  [["teknik", "pembangunan", "konstruksi"], "wrench"],
  [["cso", "komplain", "pelanggan", "tiket"], "headset"],
  [["persetujuan", "approval", "tugas", "peninjau"], "clipboard"],
  [["kotak masuk", "inbox"], "inbox"],
  [["chat", "pesan"], "chat"],
  [["vendor"], "truck"],
  [["spk"], "file"],
  [["deadline", "tenggat"], "clock"],
  [["sync", "spreadsheet", "sheet"], "sync"],
  [["setting", "pengaturan", "setelan"], "gear"],
  [["deviasi", "spi", "kpi"], "gauge"],
  [["kurva"], "linechart"],
  [["ranking", "peringkat"], "trophy"],
  [["whatsapp"], "chat"],
  [["instagram"], "camera"],
  [["akun meta", "meta", "akun"], "at"],
  [["tim", "staff", "team", "user"], "users"],
  [["role"], "shield"],
  [["divisi"], "grid"],
  [["kunci", "key"], "key"],
];

/** Resolve a sidebar label to a matching icon (falls back to a neutral dot). */
export function navIcon(label: string): ReactNode {
  const l = label.toLowerCase();
  for (const [keys, name] of RULES) {
    if (keys.some((k) => l.includes(k))) return icons[name];
  }
  return icons.dot;
}
