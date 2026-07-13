import { api } from "./api";
import { LEGACY_DISABLED_MESSAGE, PERMIT_LEGACY_ENABLED } from "./features";
import type { DeadlineRule } from "@/modules/permit/models";

export const deadlineService = {
  async list(): Promise<DeadlineRule[]> {
    if (!PERMIT_LEGACY_ENABLED) return [];
    const { data } = await api.get<{ items: DeadlineRule[] }>("/deadline-master");
    return data.items;
  },
  async update(items: DeadlineRule[]): Promise<DeadlineRule[]> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.put<{ items: DeadlineRule[] }>("/deadline-master", { items });
    return data.items;
  },
};
