// Reusable UI primitives for the Sales staff tools (Screening + Simulasi Kredit).
// One set of controls shared across every staff view so they stay consistent and
// DRY — styles live in staff.css (`.sales-staff` scope).
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { parseDigits } from "./credit";

/** Card with an optional header (title + right-aligned slot). */
export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`st-card ${className}`}>
      {(title || right) && (
        <div className="st-card-head">
          {title ? <h3>{title}</h3> : <span />}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/** Labelled form row (label · required mark · control · hint). */
export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`st-field ${className}`}>
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Plain text input. */
export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

/** Multi-line text input. */
export function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

/** Rupiah amount input — thousands separators + "Rp" prefix, emits a number. */
export function CurrencyInput({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  return (
    <div className="st-currency">
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString("id-ID") : ""}
        onChange={(e) => onChange(parseDigits(e.target.value))}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Dropdown; `placeholder` becomes an empty first option when provided. */
export function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Ya / Tidak segmented toggle (stores "true" / "false" / ""). */
export function BoolToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="st-seg">
      <button type="button" className={value === "true" ? "on" : ""} onClick={() => onChange("true")}>
        Ya
      </button>
      <button type="button" className={value === "false" ? "on" : ""} onClick={() => onChange("false")}>
        Tidak
      </button>
    </div>
  );
}

/** Themed button (primary / ghost / danger). `loading` shows a spinner. */
export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...rest
}: {
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`st-btn ${variant} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="st-spin" />}
      {children}
    </button>
  );
}

/** Friendly empty / error state with an optional action. */
export function EmptyState({ icon = "📋", title, message, action }: { icon?: string; title?: string; message: ReactNode; action?: ReactNode }) {
  return (
    <div className="st-empty">
      <div className="st-empty-ic">{icon}</div>
      {title && <div className="st-empty-title">{title}</div>}
      <div className="st-empty-msg">{message}</div>
      {action && <div className="st-empty-act">{action}</div>}
    </div>
  );
}
