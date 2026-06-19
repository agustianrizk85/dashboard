// Inline stroke-based SVG icon set (currentColor), finance-style.

const ICON_PATHS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  layers: "M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5",
  gauge: "M12 14 17 9M3.34 19a10 10 0 1 1 17.32 0",
  alert: "M12 3l9 16H3zM12 10v4M12 17v.01",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V4",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  check: "M20 6 9 17l-5-5",
  block: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5 5l14 14",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  x: "M18 6 6 18M6 6l12 12",
  expand: "M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a7 7 0 0 1-7 7zM11 20v-4",
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
      dangerouslySetInnerHTML={{ __html: `<path d="${d}"/>` }}
    />
  );
}
