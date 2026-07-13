import { api } from "./api";
import { LEGACY_DISABLED_MESSAGE, PERMIT_LEGACY_ENABLED } from "./features";
import type { CreateSPKInput, SPK, SPKStatus, SPKType } from "@/modules/permit/models";

export const spkService = {
  async types(): Promise<SPKType[]> {
    if (!PERMIT_LEGACY_ENABLED) return [];
    const { data } = await api.get<{ types: SPKType[] }>("/spk/types");
    return data.types;
  },

  async list(status?: SPKStatus): Promise<SPK[]> {
    if (!PERMIT_LEGACY_ENABLED) return [];
    const { data } = await api.get<{ items: SPK[] }>("/spk", {
      params: status ? { status } : undefined,
    });
    return data.items;
  },

  async get(id: number): Promise<SPK> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.get<SPK>(`/spk/${id}`);
    return data;
  },

  async create(input: CreateSPKInput): Promise<SPK> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.post<SPK>("/spk", input);
    return data;
  },

  async approve(id: number, note?: string): Promise<SPK> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.post<SPK>(`/spk/${id}/approve`, { note });
    return data;
  },

  async reject(id: number, note?: string): Promise<SPK> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.post<SPK>(`/spk/${id}/reject`, { note });
    return data;
  },
};
