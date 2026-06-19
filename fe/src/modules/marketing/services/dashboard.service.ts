import { api } from "./api";
import type { Warning } from "../models";

export const dashboardService = {
  async warnings(): Promise<{ warnings: Warning[]; count: number }> {
    const { data } = await api.get<{ warnings: Warning[]; count: number }>("/dashboard/warnings");
    return data;
  },
};
