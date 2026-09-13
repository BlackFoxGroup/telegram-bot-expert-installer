import type { CheckItem } from "@expert/shared";
import type { SshClient } from "../ssh/types.js";
import { ServiceManager } from "../service/ServiceManager.js";
import { TelegramApi } from "../telegram/TelegramApi.js";
import type { SessionRecord, SessionStore } from "../store/SessionStore.js";

export class AutoRepair {
  constructor(private store: SessionStore) {}

  async fix(ssh: SshClient, session: SessionRecord, item: CheckItem): Promise<string> {
    const svc = new ServiceManager(ssh);
    const name = session.serviceName || "telegram-bot";
    if (item.id === "service" || item.id === "vps") {
      await svc.ctl(name, "restart");
      return "سرویس دوباره روشن شد";
    }
    if (item.id === "webhook" && session.bot && session.webhook) {
      const token = this.store.readToken(session);
      await new TelegramApi().setWebhook(token, session.webhook.publicUrl || `https://${session.webhook.domain}/`);
      return "Webhook دوباره ثبت شد";
    }
    if (item.id === "internet" || item.id === "telegram") {
      return "این مورد را خودکار نمی‌توان تعمیر کرد. دسترسی شبکه سرور را از پنل ابری بررسی کنید.";
    }
    return "برای این مورد تعمیر خودکار تعریف نشده است";
  }
}
