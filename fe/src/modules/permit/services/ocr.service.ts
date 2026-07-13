import { api } from "./api";
import { LEGACY_DISABLED_MESSAGE, PERMIT_LEGACY_ENABLED } from "./features";
import type { OCRResult } from "@/modules/permit/models";

export const ocrService = {
  async extract(file: File, docType: string): Promise<OCRResult> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    const { data } = await api.post<OCRResult>("/ocr/extract", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
