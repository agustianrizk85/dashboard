import { api } from "./api";
import type { DocumentFile, Warning } from "@/modules/permit/models";

export const dashboardService = {
  async warnings(): Promise<{ warnings: Warning[]; count: number }> {
    const { data } = await api.get<{ warnings: Warning[]; count: number }>("/dashboard/warnings");
    return data;
  },

  async searchDocuments(q: string, projectId?: number): Promise<{ items: DocumentFile[]; count: number }> {
    const { data } = await api.get<{ items: DocumentFile[]; count: number }>("/dashboard/documents", {
      params: { q, project_id: projectId },
    });
    return data;
  },
};
