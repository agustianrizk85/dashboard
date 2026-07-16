/**
 * Legacy Permit feature gate.
 *
 * SPK, Vendor, PT-master, the AI Early-Warning panel, and document search belong
 * to the older `greenparkpermit` backend. The Legal backend currently running on
 * :8081 (`greenparklegalbe`) does NOT implement those endpoints yet, so calling
 * them returns 404 and floods the Network tab (and can spin retry/realtime
 * loops). Until the backend serves them, we guard those calls behind this flag —
 * the affected panels/pages render empty instead of erroring.
 *
 * Wired to an env var so it can be enabled per-environment: the full
 * `greenparkpermit`/`legalpermit` backend (running locally on :8081) DOES serve
 * /spk, /vendors, /pt, /spk/types and /dashboard/{warnings,documents}, so set
 * `VITE_PERMIT_LEGACY=true` (e.g. in `.env.local`) to turn the panels on. It
 * stays OFF by default so production — still pointed at the lighter
 * `greenparklegalbe` — doesn't 404 until that backend catches up.
 */
export const PERMIT_LEGACY_ENABLED = import.meta.env.VITE_PERMIT_LEGACY === "true";

/** Thrown by legacy write actions while the feature is disabled. */
export const LEGACY_DISABLED_MESSAGE =
  "Fitur ini (SPK / Vendor / PT / Early-Warning) belum didukung backend Legal saat ini.";
