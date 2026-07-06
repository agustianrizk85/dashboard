import { useEffect, useRef } from "react";
import { mountMonev } from "./engine";
import "./monev.css";

/**
 * Sales Monev Control — native module wrapper.
 *
 * The whole app (parsing, metrics, 7 sub-pages, Chart.js charts, Google-Sheets
 * sync) lives in engine.ts and mounts into this div. React just owns the
 * lifecycle: mount on show, tear down (timers + charts) on unmount.
 */
export function MonevView() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const cleanup = mountMonev(ref.current);
    return cleanup;
  }, []);
  return <div ref={ref} className="monev-mount" />;
}

export default MonevView;
