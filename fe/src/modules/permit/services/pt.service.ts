import { api } from "./api";
import type { CreatePTInput, PTDocument, PTMaster } from "@/modules/permit/models";

export const ptService = {
  async list(): Promise<{ items: PTMaster[]; doc_types: string[] }> {
    const { data } = await api.get<{ items: PTMaster[]; doc_types: string[] }>("/pt");
    return data;
  },

  async get(id: number): Promise<{ pt: PTMaster; doc_types: string[] }> {
    const { data } = await api.get<{ pt: PTMaster; doc_types: string[] }>(`/pt/${id}`);
    return data;
  },

  async create(input: CreatePTInput): Promise<PTMaster> {
    const { data } = await api.post<PTMaster>("/pt", input);
    return data;
  },

  async uploadDocument(ptId: number, file: File, docType: string): Promise<PTDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    const { data } = await api.post<PTDocument>(`/pt/${ptId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  downloadUrl(documentId: number): string {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "/api";
    return `${base}/pt-documents/${documentId}/download`;
  },
};
