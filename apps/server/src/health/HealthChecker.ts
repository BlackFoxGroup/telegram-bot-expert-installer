import type { CheckItem, HealthReport, InstallMode } from "@expert/shared";
import type { SshClient } from "../ssh/types.js";
import type { TelegramApi } from "../telegram/TelegramApi.js";
import { ServiceManager } from "../service/ServiceManager.js";

export class HealthChecker {
  constructor(
    private ssh: SshClient,
    private telegram: TelegramApi
  ) {}

  async run(opts: {
    token: string;
    service: string;
    mode: InstallMode;
    domain?: string;
    publicIp?: string;
  }): Promise<HealthReport> {
    const items: CheckItem[] = [];
    const add = (id: string, label: string, ok: boolean, simple: string, detail: string, fixable = false) => {
      items.push({ id, label, status: ok ? "ok" : "fail", simple, detail, fixable });
    };

    const ping = await this.ssh.execute("echo ok");
    add("vps", "VPS", ping.code === 0, "سرور در دسترس است", ping.stdout, true);

    const net = await this.ssh.execute("curl -s --max-time 8 https://api.telegram.org | head -c 20");
    add("internet", "اینترنت", net.code === 0, "دسترسی اینترنت برقرار است", net.stdout, true);

    let tokenOk = false;
    try {
      await this.telegram.getMe(opts.token);
      tokenOk = true;
    } catch (e) {
      add("token", "توکن ربات", false, "توکن ربات معتبر نیست", String(e), false);
    }
    if (tokenOk) add("token", "توکن ربات", true, "توکن معتبر است", "getMe", false);
    add("telegram", "Telegram API", tokenOk, tokenOk ? "ارتباط با تلگرام برقرار است" : "ارتباط با تلگرام قطع است", "", true);

    const svc = new ServiceManager(this.ssh);
    const active = await svc.isActive(opts.service);
    add("service", "سرویس", active, active ? "ربات در حال اجرا است" : "سرویس ربات خاموش است", opts.service, true);

    if (opts.mode === "webhook" && opts.domain) {
      const dns = await this.ssh.execute(`getent hosts ${opts.domain} | awk '{print $1}' | head -1`);
      const match = !opts.publicIp || opts.publicIp === "unknown" || dns.stdout.trim() === opts.publicIp;
      add("domain", "دامنه", Boolean(dns.stdout.trim()) && match, match ? "دامنه درست است" : "دامنه به آی‌پی این سرور اشاره نمی‌کند", dns.stdout.trim(), false);
      const info = await this.telegram.getWebhookInfo(opts.token);
      add("webhook", "Webhook", Boolean(info.url), info.url ? "Webhook ثبت شده" : "Webhook ثبت نشده", info.last_error_message || info.url, true);
    }

    const mem = await this.ssh.execute("awk '/MemAvailable/ {print $2}' /proc/meminfo");
    add("ram", "حافظه آزاد", Number(mem.stdout) > 80_000, "حافظه کافی است", `${mem.stdout} kB`, false);
    return { items, healthy: items.every((i) => i.status === "ok") };
  }
}
