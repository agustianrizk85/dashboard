import { api } from "./api";
import type { DACIConfig, NotificationConfig } from "@/modules/permit/models";

export const settingsService = {
  async getDACI(): Promise<DACIConfig> {
    const { data } = await api.get<DACIConfig>("/settings/daci");
    return data;
  },
  async setDACI(cfg: DACIConfig): Promise<DACIConfig> {
    const { data } = await api.put<DACIConfig>("/settings/daci", cfg);
    return data;
  },
  async getNotification(): Promise<NotificationConfig> {
    const { data } = await api.get<NotificationConfig>("/settings/notification");
    return data;
  },
  async setNotification(cfg: NotificationConfig): Promise<NotificationConfig> {
    const { data } = await api.put<NotificationConfig>("/settings/notification", cfg);
    return data;
  },
};
