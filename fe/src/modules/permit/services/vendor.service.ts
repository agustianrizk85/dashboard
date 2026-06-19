import { api } from "./api";
import type { Vendor, VendorInput } from "@/modules/permit/models";

export const vendorService = {
  async list(): Promise<{ items: Vendor[]; categories: string[] }> {
    const { data } = await api.get<{ items: Vendor[]; categories: string[] }>("/vendors");
    return data;
  },

  async get(id: number): Promise<Vendor> {
    const { data } = await api.get<Vendor>(`/vendors/${id}`);
    return data;
  },

  async create(input: VendorInput): Promise<Vendor> {
    const { data } = await api.post<Vendor>("/vendors", input);
    return data;
  },

  async update(id: number, input: VendorInput): Promise<Vendor> {
    const { data } = await api.put<Vendor>(`/vendors/${id}`, input);
    return data;
  },
};
