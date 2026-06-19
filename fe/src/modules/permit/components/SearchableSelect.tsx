import { useEffect, useMemo, useRef, useState } from "react";

export interface SSOption {
  value: number;
  label: string;
  sub?: string;
}

/**
 * Searchable single-select dropdown for "acuan"/relation fields (Vendor, Lahan,
 * PT, …): type to filter, click to pick. Falls back to the standard `.field`
 * input look so it blends with the rest of the forms.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Pilih —",
  allowClear = true,
  emptyText = "Tidak ada hasil",
}: {
  options: SSOption[];
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  allowClear?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const pick = (o: SSOption) => {
    onChange(o.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`ss ${open ? "ss-open" : ""}`} ref={wrapRef}>
      <div className="ss-control">
        <input
          className="ss-input"
          value={open ? query : selected?.label ?? ""}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {allowClear && selected && !open && (
          <button
            type="button"
            className="ss-clear"
            title="Kosongkan"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
          >
            ×
          </button>
        )}
        <span className="ss-caret">▾</span>
      </div>
      {open && (
        <div className="ss-menu">
          {filtered.length === 0 ? (
            <div className="ss-empty">{emptyText}</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`ss-option ${o.value === value ? "on" : ""}`}
                onClick={() => pick(o)}
              >
                <span className="ss-option-label">{o.label}</span>
                {o.sub && <span className="ss-option-sub">{o.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
