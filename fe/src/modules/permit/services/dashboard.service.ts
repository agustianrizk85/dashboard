import { api } from "./api";
import { PERMIT_LEGACY_ENABLED } from "./features";
import type { DocumentFile, Warning } from "@/modules/permit/models";

export const dashboardService = {
  async warnings(): Promise<{ warnings: Warning[]; count: number }> {
    // Guarded: /dashboard/warnings lives in the legacy permit backend.
    if (!PERMIT_LEGACY_ENABLED) return { warnings: [], count: 0 };
    const { data } = await api.get<{ warnings: Warning[]; count: number }>("/dashboard/warnings");
    return data;
  },

  async searchDocuments(q: string, projectId?: number): Promise<{ items: DocumentFile[]; count: number }> {
    if (!PERMIT_LEGACY_ENABLED) return { items: [], count: 0 };
    const { data } = await api.get<{ items: DocumentFile[]; count: number }>("/dashboard/documents", {
      params: { q, project_id: projectId },
    });
    return data;
  },
};
