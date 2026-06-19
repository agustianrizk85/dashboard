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
};
