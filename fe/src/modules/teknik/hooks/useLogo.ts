import { useCallback, useState } from "react";

const STORAGE_KEY = "gp_logo";

/** Persist a drag-and-dropped logo image in localStorage as a data URL. */
export function useLogo(): [string, (e: React.DragEvent) => void] {
  const [logo, setLogo] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "");

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f || !f.type.startsWith("image")) return;
    const r = new FileReader();
    r.onload = () => {
      const result = typeof r.result === "string" ? r.result : "";
      setLogo(result);
      try {
        localStorage.setItem(STORAGE_KEY, result);
      } catch {
        /* storage quota — keep in-memory only */
      }
    };
    r.readAsDataURL(f);
  }, []);

  return [logo, onDrop];
}
