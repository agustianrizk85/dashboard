import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./datatable.css";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * SearchSelect — a searchable dropdown (combobox) for relation pickers (tipe,
 * blok, GP, PIC, divisi). The popup renders through a portal with position:fixed
 * so it never clips inside scrollable tables. Lightweight (no external lib).
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "— pilih —",
  clearable = true,
  disabled = false,
  size = "md",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = q.trim()
    ? options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(q.trim().toLowerCase()))
    : options;

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (b) setRect({ left: b.left, top: b.bottom + 4, width: b.width });
  };

  const openMenu = () => {
    if (disabled) return;
    place();
    setOpen(true);
    setQ("");
    setActive(0);
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const host = btnRef.current?.closest<HTMLElement>(".pr-scope") ?? document.body;

  return (
    <div className={`ss ss-${size} ${disabled ? "ss-disabled" : ""}`}>
      <button ref={btnRef} type="button" className="ss-btn" disabled={disabled} onClick={() => (open ? setOpen(false) : openMenu())}>
        <span className={selected ? "ss-val" : "ss-ph"}>{selected ? selected.label : placeholder}</span>
        <span className="ss-caret">▾</span>
      </button>
      {open &&
        rect &&
        createPortal(
          <div ref={popRef} className="ss-pop" style={{ position: "fixed", left: rect.left, top: rect.top, width: Math.max(rect.width, 200) }}>
            <input
              ref={inputRef}
              className="ss-search"
              placeholder="Cari…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
            <div className="ss-list">
              {clearable && (
                <button type="button" className={`ss-opt ${value === "" ? "on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick("")}>
                  <span className="ss-opt-lbl ss-ph">{placeholder}</span>
                </button>
              )}
              {filtered.map((o, i) => (
                <button
                  type="button"
                  key={o.value}
                  className={`ss-opt ${o.value === value ? "on" : ""} ${i === active ? "active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value)}
                >
                  <span className="ss-opt-lbl">{o.label}</span>
                  {o.hint && <span className="ss-opt-hint">{o.hint}</span>}
                </button>
              ))}
              {filtered.length === 0 && <div className="ss-nores">Tak ada hasil untuk “{q}”.</div>}
            </div>
          </div>,
          host,
        )}
    </div>
  );
}
