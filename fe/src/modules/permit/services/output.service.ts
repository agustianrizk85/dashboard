import { api } from "./api";
import { PERMIT_LEGACY_ENABLED } from "./features";
import type { DivOutputs } from "@/modules/permit/models";

export const outputService = {
  /** Legal Permit deliverables grouped by the division that consumes them
   *  (OUTBOUND). Guarded: /outputs lives on the full permit backend (:8081);
   *  the lighter Legal backend doesn't serve it yet, so return [] when off. */
  async byDivision(): Promise<DivOutputs[]> {
    if (!PERMIT_LEGACY_ENABLED) return [];
    const { data } = await api.get<DivOutputs[]>("/outputs");
    return data;
  },
};
