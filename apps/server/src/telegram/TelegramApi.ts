export interface TelegramMe {
  id: number;
  username?: string;
  first_name: string;
}

export class TelegramApi {
  async getMe(token: string): Promise<TelegramMe> {
    const data = await this.call(token, "getMe");
    if (!data.ok) throw new Error("توکن ربات معتبر نیست");
    return data.result as TelegramMe;
  }

  async setWebhook(token: string, url: string): Promise<void> {
    const data = await this.call(token, "setWebhook", { url, drop_pending_updates: true });
    if (!data.ok) throw new Error(String(data.description || "ثبت Webhook شکست خورد"));
  }

  async deleteWebhook(token: string): Promise<void> {
    const data = await this.call(token, "deleteWebhook", { drop_pending_updates: false });
    if (!data.ok) throw new Error(String(data.description || "حذف Webhook شکست خورد"));
  }

  async getWebhookInfo(token: string): Promise<{ url: string; last_error_message?: string }> {
    const data = await this.call(token, "getWebhookInfo");
    return data.result as { url: string; last_error_message?: string };
  }

  private async call(token: string, method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; description?: string; result?: unknown }> {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  }
}
