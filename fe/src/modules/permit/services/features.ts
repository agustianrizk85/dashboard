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
 * Flip to `true` (or wire to an env var) once `greenparklegalbe` implements
 * /spk, /vendors, /pt, /spk/types and /dashboard/{warnings,documents}.
 */
export const PERMIT_LEGACY_ENABLED = false;

/** Thrown by legacy write actions while the feature is disabled. */
export const LEGACY_DISABLED_MESSAGE =
  "Fitur ini (SPK / Vendor / PT / Early-Warning) belum didukung backend Legal saat ini.";
