import { useEffect, useMemo, useRef, useState } from "react";

export interface SsOpt {
  value: string;
  label: string;
  sub?: string;
}

/** Dropdown-search: ketik untuk memfilter, klik untuk pilih. Self-contained
 *  (no portal) — good enough for a form field that isn't inside a scroll trap. */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "— Pilih —",
}: {
  options: SsOpt[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return options;
    return options.filter((o) => (o.label + " " + (o.sub ?? "")).toLowerCase().includes(n));
  }, [options, q]);

  return (
    <div className="skp-ss" ref={ref}>
      <input
        className="skp-ss-input"
        value={open ? q : (selected?.label ?? "")}
        placeholder={selected ? selected.label : placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <span className="skp-ss-caret">▾</span>
      {open && (
        <div className="skp-ss-menu">
          {filtered.length === 0 ? (
            <div className="skp-ss-empty">Tidak ada</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`skp-ss-opt ${o.value === value ? "on" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="skp-ss-opt-label">{o.label}</span>
                {o.sub && <span className="skp-ss-opt-sub">{o.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
