import { api } from "./api";
import type { DeadlineRule } from "@/modules/permit/models";

export const deadlineService = {
  async list(): Promise<DeadlineRule[]> {
    const { data } = await api.get<{ items: DeadlineRule[] }>("/deadline-master");
    return data.items;
  },
  async update(items: DeadlineRule[]): Promise<DeadlineRule[]> {
    const { data } = await api.put<{ items: DeadlineRule[] }>("/deadline-master", { items });
    return data.items;
  },
};
