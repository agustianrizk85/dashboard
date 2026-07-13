import { api } from "./api";
import { LEGACY_DISABLED_MESSAGE, PERMIT_LEGACY_ENABLED } from "./features";
import type { DACIConfig, NotificationConfig } from "@/modules/permit/models";

const EMPTY_DACI: DACIConfig = { drivers: [], approver: [], consulting: [], informed: [] };
const EMPTY_NOTIF: NotificationConfig = {
  whatsapp_enabled: false,
  audit_ai_enabled: false,
  reminder_hour: 8,
  whatsapp_api_url: "",
};

export const settingsService = {
  async getDACI(): Promise<DACIConfig> {
    if (!PERMIT_LEGACY_ENABLED) return EMPTY_DACI;
    const { data } = await api.get<DACIConfig>("/settings/daci");
    return data;
  },
  async setDACI(cfg: DACIConfig): Promise<DACIConfig> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.put<DACIConfig>("/settings/daci", cfg);
    return data;
  },
  async getNotification(): Promise<NotificationConfig> {
    if (!PERMIT_LEGACY_ENABLED) return EMPTY_NOTIF;
    const { data } = await api.get<NotificationConfig>("/settings/notification");
    return data;
  },
  async setNotification(cfg: NotificationConfig): Promise<NotificationConfig> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.put<NotificationConfig>("/settings/notification", cfg);
    return data;
  },
};
