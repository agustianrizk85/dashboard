import { api } from "./api";
import { LEGACY_DISABLED_MESSAGE, PERMIT_LEGACY_ENABLED } from "./features";
import type { Vendor, VendorInput } from "@/modules/permit/models";

export const vendorService = {
  async list(): Promise<{ items: Vendor[]; categories: string[] }> {
    if (!PERMIT_LEGACY_ENABLED) return { items: [], categories: [] };
    const { data } = await api.get<{ items: Vendor[]; categories: string[] }>("/vendors");
    return data;
  },

  async get(id: number): Promise<Vendor> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.get<Vendor>(`/vendors/${id}`);
    return data;
  },

  async create(input: VendorInput): Promise<Vendor> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.post<Vendor>("/vendors", input);
    return data;
  },

  async update(id: number, input: VendorInput): Promise<Vendor> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.put<Vendor>(`/vendors/${id}`, input);
    return data;
  },
};
