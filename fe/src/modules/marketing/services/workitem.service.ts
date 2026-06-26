import { api } from "./api";
import type { CreateWorkItemInput, WorkItem, WorkItemProgress } from "../models";

export const workItemService = {
  async list(): Promise<WorkItem[]> {
    const { data } = await api.get<WorkItem[]>("/work-items");
    return data;
  },

  async get(id: number): Promise<WorkItem> {
    const { data } = await api.get<WorkItem>(`/work-items/${id}`);
    return data;
  },

  async create(input: CreateWorkItemInput): Promise<WorkItem> {
    const { data } = await api.post<WorkItem>("/work-items", input);
    return data;
  },

  async progress(id: number): Promise<WorkItemProgress> {
    const { data } = await api.get<WorkItemProgress>(`/work-items/${id}/progress`);
    return data;
  },

  // Destructive: delete ALL work items, steps and documents (keeps accounts).
  // Kadep only — returns 403 otherwise.
  async reset(): Promise<{ deleted: { work_items: number; work_steps: number; documents: number }; warning?: string }> {
    const { data } = await api.post("/work-items/reset");
    return data;
  },
};
