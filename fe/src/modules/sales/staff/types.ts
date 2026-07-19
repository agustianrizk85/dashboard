// Shared types for the Sales staff tools (Konsumen Screening). They mirror the
// sales backend's domain shapes (backend/sales/internal/domain/screening.go).

export type FieldType = "text" | "textarea" | "number" | "currency" | "boolean" | "select";

export interface ScreeningQuestion {
  _id: string;
  order: number;
  label: string;
  hint?: string;
  type: FieldType;
  options?: string[] | null;
  category?: string;
  weight?: number;
  required?: boolean;
  active: boolean;
}

export interface ScreeningAnswer {
  questionId: string;
  label: string;
  value: string;
}

/** AI/rule verdict. "review" = could not be scored automatically. */
export type Verdict = "layak" | "bersyarat" | "tidak_layak" | "review";

export interface ScreeningResult {
  verdict: Verdict;
  score: number;
  summary: string;
  strengths?: string[] | null;
  risks?: string[] | null;
  recommendations?: string[] | null;
  source: "ai" | "rules";
  note?: string;
}

export interface ScreeningSubmission {
  _id: string;
  consumer: string;
  phone?: string;
  project?: string;
  unit?: string;
  price?: number;
  answers: ScreeningAnswer[];
  result: ScreeningResult;
  by: string;
  byName: string;
  createdAt: string;
}

export interface AssessRequest {
  consumer: string;
  phone?: string;
  project?: string;
  unit?: string;
  price?: number;
  answers: ScreeningAnswer[];
  /** AI verdict obtained client-side from the central auth AI gateway (Ollama).
   *  Omitted when AI is off/failed — the backend then scores with rules. */
  result?: ScreeningResult | null;
}

/** Display metadata per verdict (label + traffic-light colour). */
export const VERDICT_META: Record<Verdict, { label: string; c: string; bg: string }> = {
  layak: { label: "Layak", c: "#1F9D54", bg: "#E8F6ED" },
  bersyarat: { label: "Layak dengan Syarat", c: "#B97F09", bg: "#FCF4E2" },
  tidak_layak: { label: "Belum Layak", c: "#D6453A", bg: "#FBEAE8" },
  review: { label: "Perlu Tinjauan Manual", c: "#5A6B60", bg: "#ECEFEC" },
};
