import { api } from "./api";
import type { DocumentFile, MineStep, WorkStep, UpdateStepInput } from "../models";

const apiBase = ((import.meta.env.VITE_MARKETING_API as string | undefined) ?? "http://localhost:8086").replace(/\/$/, "");

export const stepService = {
  async get(id: number): Promise<WorkStep> {
    const { data } = await api.get<WorkStep>(`/steps/${id}`);
    return data;
  },

  async mine(position: string): Promise<MineStep[]> {
    const { data } = await api.get<{ steps: MineStep[] }>("/my-steps", { params: { position } });
    return data.steps ?? [];
  },

  async update(id: number, input: UpdateStepInput): Promise<WorkStep> {
    const { data } = await api.put<WorkStep>(`/steps/${id}`, input);
    return data;
  },

  async uploadDocument(stepId: number, file: File, docType: string): Promise<DocumentFile> {
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    const { data } = await api.post<DocumentFile>(`/steps/${stepId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  downloadUrl(documentId: number): string {
    return `${apiBase}/api/documents/${documentId}/download`;
  },
};
