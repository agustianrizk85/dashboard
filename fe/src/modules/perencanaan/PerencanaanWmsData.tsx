import { createContext, useContext } from "react";
import type { DivisionOutputs, ProjectRollup, StaffMember, Summary } from "./types";

/** Portfolio data loaded once by `PerencanaanWmsLayout` and shared with the WMS
 *  overview + section routes (mirrors what the classic `Dashboard` loads so the
 *  existing views keep working unchanged). */
export interface PerencanaanData {
  summary: Summary | null;
  projects: ProjectRollup[];
  outputs: DivisionOutputs[];
  err: string;
  /** Refetch summary/projects/outputs after a mutation. */
  reload: () => void;
  /** True for CEO / Kadep (may approve reviews & edit structure). */
  canManage: boolean;
  /** Whether the current user may edit a task owned by `pic`. */
  canEdit: (pic: string) => boolean;
  username: string;
  /** Department roster from the SSO sync (drives PIC pickers + display names). */
  roster: StaffMember[];
}

export const PerencanaanDataContext = createContext<PerencanaanData | null>(null);

export function usePerencanaanData(): PerencanaanData {
  const ctx = useContext(PerencanaanDataContext);
  if (!ctx) throw new Error("usePerencanaanData must be used within PerencanaanWmsLayout");
  return ctx;
}
