// Inline stroke-based SVG icon set (currentColor).

const ICON_PATHS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 7h2M8 11h2M8 15h2",
  truck: "M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 18a2 2 0 1 0 0 .01M18 18a2 2 0 1 0 0 .01",
  shield: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z",
  alert: "M12 3l9 16H3zM12 10v4M12 17v.01",
  home: "M3 11l9-7 9 7M5 10v10h14V10",
  cpu: "M6 6h12v12H6zM9 9h6v6H9M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  expand: "M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6",
  pattern: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  vendor: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  site: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  rec: "M12 3a6 6 0 0 1 4 10c-.7.7-1 1.4-1 2H9c0-.6-.3-1.3-1-2a6 6 0 0 1 4-10zM9 19h6M10 22h4",
  db: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export interface IconProps {
  name: string;
  size?: number;
}

export function Icon({ name, size = 16 }: IconProps) {
  const d = ICON_PATHS[name] ?? ICON_PATHS.grid;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
