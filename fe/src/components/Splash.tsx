import type { ReactNode } from "react";

/** Centered loading / status screen used while the session is resolving. */
export function Splash({ tone, children }: { tone?: "error"; children: ReactNode }) {
  return <div className={`gp-splash ${tone ?? ""}`}>{children}</div>;
}

export function LoadingSplash({ label = "Memuat…" }: { label?: string }) {
  return (
    <Splash>
      <div className="gp-spinner" />
      {label}
    </Splash>
  );
}
