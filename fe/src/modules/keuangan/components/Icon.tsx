// Inline stroke-based SVG icon set (currentColor).

const ICON_PATHS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 7h2M8 11h2M8 15h2",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  alert: "M12 3l9 16H3zM12 10v4M12 17v.01",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  cpu: "M6 6h12v12H6zM9 9h6v6H9M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3",
  expand: "M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6",
  rec: "M12 3a6 6 0 0 1 4 10c-.7.7-1 1.4-1 2H9c0-.6-.3-1.3-1-2a6 6 0 0 1 4-10zM9 19h6M10 22h4",
  // finance-specific
  wallet: "M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2M16 12h.01",
  cash: "M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 9v.01M18 15v.01",
  coins: "M8 8a5 3 0 1 0 0-.01M3 5v6c0 1.7 2.2 3 5 3s5-1.3 5-3V5M13 13c0 1.7 2.2 3 5 3s3-1.3 3-3v-3c0-1.7-1.3-3-3-3",
  bank: "M3 9l9-5 9 5M4 9v9M9 9v9M15 9v9M20 9v9M2 21h20",
  receipt: "M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3l-2 1.4L14 3l-2 1.4L10 3 8 4.4 6 3zM8 8h8M8 12h8M8 16h5",
  scale: "M12 3v18M7 21h10M12 6l-7 2 2.5 5a3 3 0 0 1-5 0L12 6m0 0l7 2-2.5 5a3 3 0 0 0 5 0L12 6",
  pie: "M12 3a9 9 0 1 0 9 9h-9z M12 3v9h9",
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
