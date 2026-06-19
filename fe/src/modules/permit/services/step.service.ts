import { api } from "./api";
import type { DocumentFile, ProcessStep, UpdateStepInput } from "@/modules/permit/models";

export const stepService = {
  async get(id: number): Promise<ProcessStep> {
    const { data } = await api.get<ProcessStep>(`/steps/${id}`);
    return data;
  },

  async update(id: number, input: UpdateStepInput): Promise<ProcessStep> {
    const { data } = await api.put<ProcessStep>(`/steps/${id}`, input);
    return data;
  },

  async uploadDocument(
    stepId: number,
    file: File,
    docType: string,
    confidential = false,
  ): Promise<DocumentFile> {
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    form.append("confidential", String(confidential));
    const { data } = await api.post<DocumentFile>(`/steps/${stepId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  downloadUrl(documentId: number): string {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "/api";
    return `${base}/documents/${documentId}/download`;
  },
};
