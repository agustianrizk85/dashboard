import { api } from "./api";
import type { OCRResult } from "@/modules/permit/models";

export const ocrService = {
  async extract(file: File, docType: string): Promise<OCRResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    const { data } = await api.post<OCRResult>("/ocr/extract", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
