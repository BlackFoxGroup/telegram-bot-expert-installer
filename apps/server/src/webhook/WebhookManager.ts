import type { SshClient } from "../ssh/types.js";
import { shellQuote } from "../ssh/SshManager.js";
import type { TelegramApi } from "../telegram/TelegramApi.js";
import type { WebhookInput } from "@expert/shared";

export class WebhookManager {
  constructor(
    private ssh: SshClient,
    private telegram: TelegramApi
  ) {}

  async preflight(domain: string, expectedIp: string): Promise<{ ok: boolean; reason: string }> {
    if (!domain) return { ok: false, reason: "دامنه وارد نشده است. یا دامنه بدهید یا نصب بدون Webhook را انتخاب کنید." };
    const r = await this.ssh.execute(`getent hosts ${shellQuote(domain)} | awk '{print $1}' | head -1`);
    const ip = r.stdout.trim();
    if (!ip) return { ok: false, reason: "DNS دامنه به هیچ آی‌پی‌ای اشاره نمی‌کند." };
    if (expectedIp && expectedIp !== "unknown" && ip !== expectedIp) {
      return { ok: false, reason: `دامنه به ${ip} اشاره می‌کند، نه به آی‌پی این سرور (${expectedIp}).` };
    }
    return { ok: true, reason: "DNS با سرور هم‌خوان است." };
  }

  nginxConf(domain: string, upstream: number): string {
    return `server {
  listen 80;
  server_name ${domain};
  location / {
    proxy_pass http://127.0.0.1:${upstream};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`;
  }

  async apply(cfg: WebhookInput, token: string, publicIp: string, pmInstall: (pkgs: string[]) => Promise<void>): Promise<string> {
    const pre = await this.preflight(cfg.domain, publicIp);
    if (!pre.ok) throw new Error(pre.reason);
    await pmInstall(["nginx"]);
    const conf = this.nginxConf(cfg.domain, cfg.listenPort);
    await this.ssh.execute(`cat > /etc/nginx/sites-available/${cfg.domain} <<'EOF'\n${conf}\nEOF || cat > /etc/nginx/conf.d/${cfg.domain}.conf <<'EOF'\n${conf}\nEOF`);
    await this.ssh.execute(`ln -sf /etc/nginx/sites-available/${cfg.domain} /etc/nginx/sites-enabled/${cfg.domain} 2>/dev/null || true`);
    const test = await this.ssh.execute("nginx -t && systemctl enable nginx && systemctl reload nginx");
    if (test.code !== 0) throw new Error(test.stderr || "تنظیم Nginx شکست خورد");
    if (cfg.email) {
      await pmInstall(["certbot", "python3-certbot-nginx"]);
      const ssl = await this.ssh.execute(
        `certbot --nginx -d ${shellQuote(cfg.domain)} --non-interactive --agree-tos -m ${shellQuote(cfg.email)} --redirect`
      );
      if (ssl.code !== 0) throw new Error(ssl.stderr || "صدور گواهی SSL شکست خورد");
    }
    const url = cfg.publicUrl || `https://${cfg.domain}/`;
    await this.telegram.setWebhook(token, url);
    return url;
  }
}
