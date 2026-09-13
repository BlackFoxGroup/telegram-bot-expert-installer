import type { TelegramApi } from "../telegram/TelegramApi.js";

export class PollingManager {
  constructor(private telegram: TelegramApi) {}

  async apply(token: string): Promise<void> {
    await this.telegram.deleteWebhook(token);
  }
}
