import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { InstallMode } from "@expert/shared";
import { DATA_DIR } from "../config.js";
import { redact } from "../security/redactor.js";
import { shellQuote } from "../ssh/SshManager.js";
import type { SshClient } from "../ssh/types.js";
import { VpsDetector } from "../vps/VpsDetector.js";
import { PackageManager } from "../vps/PackageManager.js";
import { DependencyManager } from "../deps/DependencyManager.js";
import { ServiceManager } from "../service/ServiceManager.js";
import { WebhookManager } from "../webhook/WebhookManager.js";
import { PollingManager } from "../polling/PollingManager.js";
import { HealthChecker } from "../health/HealthChecker.js";
import { TelegramApi } from "../telegram/TelegramApi.js";
import type { SessionRecord, SessionStore } from "../store/SessionStore.js";
import { JobEngine } from "./JobEngine.js";

export class InstallerEngine {
  constructor(
    private store: SessionStore,
    private telegram = new TelegramApi()
  ) {}

  async install(session: SessionRecord, ssh: SshClient, zipLocal?: string, job = new JobEngine()): Promise<JobEngine> {
    const jobId = randomUUID();
    job.start(jobId);
    const mode = session.mode as InstallMode;
    const bot = session.bot;
    if (!bot) throw new Error("تنظیمات ربات ناقص است");
    const token = this.store.readToken(session);
    const dir = bot.installDir;
    const svcName = session.serviceName || "telegram-bot";
    session.serviceName = svcName;
    this.store.save(session);

    try {
      await job.run("connect", async () => {
        if (!ssh.isConnected()) throw new Error("اتصال SSH برقرار نیست");
        return "متصل";
      });

      let facts = session.facts;
      await job.run("detect", async () => {
        const det = new VpsDetector(ssh);
        facts = await det.detect();
        session.facts = facts;
        session.checks = await det.inspect(facts, mode === "webhook");
        this.store.save(session);
        return facts.os;
      });

      const pm = new PackageManager(ssh);
      await job.run("prepare", async () => {
        await ssh.mkdir(dir);
        await pm.install(facts!.packageManager, ["curl", "ca-certificates", "git"]);
        return "ابزار پایه نصب شد";
      });

      await job.run("transfer", async () => {
        if (session.source?.kind === "git" && session.source.gitUrl) {
          const url = session.source.gitUrl;
          const branch = session.source.branch || "main";
          const r = await ssh.execute(`rm -rf ${shellQuote(dir)} && git clone --branch ${shellQuote(branch)} ${shellQuote(url)} ${shellQuote(dir)}`);
          if (r.code !== 0) throw new Error(redact(r.stderr || "کلون مخزن شکست خورد"));
          return "مخزن منتقل شد";
        }
        if (session.source?.kind === "existing" && session.source.existingPath) {
          const r = await ssh.execute(`test -d ${shellQuote(session.source.existingPath)}`);
          if (r.code !== 0) throw new Error("پوشه موجود روی سرور پیدا نشد");
          return "از پوشه موجود استفاده شد";
        }
        if (zipLocal) {
          await ssh.upload(zipLocal, "/tmp/bot-src.zip");
          const r = await ssh.execute(`rm -rf ${shellQuote(dir)} && mkdir -p ${shellQuote(dir)} && unzip -o /tmp/bot-src.zip -d ${shellQuote(dir)}`);
          if (r.code !== 0) throw new Error(r.stderr || "باز کردن ZIP شکست خورد");
          return "فایل ZIP منتقل شد";
        }
        throw new Error("منبع پروژه مشخص نشده است");
      });

      const deps = new DependencyManager(ssh);
      let startBin = "";
      await job.run("deps", async () => {
        const res = await deps.install(dir, facts!.packageManager);
        startBin = res.startHint;
        return res.runtime;
      });

      await job.run("config", async () => {
        const env = [
          `BOT_TOKEN=${token}`,
          `BOT_NAME=${bot.name}`,
          `BOT_USERNAME=${bot.username}`,
          `ADMIN_ID=${bot.adminId}`,
          `SUPPORT_ID=${bot.supportId || ""}`,
          `BOT_LANG=${bot.language}`,
          `TZ=${bot.timezone}`,
          `APP_ENV=${bot.environment}`,
          `MODE=${mode}`,
          session.webhook ? `WEBHOOK_URL=https://${session.webhook.domain}/` : "WEBHOOK_URL=",
          `PORT=${session.webhook?.listenPort || 8080}`,
        ].join("\n");
        const envPath = `${dir}/.env`;
        await ssh.execute(`cat > ${shellQuote(envPath)} <<'EOF'\n${env}\nEOF && chmod 600 ${shellQuote(envPath)}`);
        return "فایل محیط ساخته شد";
      });

      const svc = new ServiceManager(ssh);
      await job.run("service", async () => {
        const exec = await this.resolveExec(ssh, dir, startBin);
        await svc.writeAndEnable(svcName, dir, exec, `${dir}/.env`);
        return svcName;
      });

      await job.run("mode", async () => {
        if (mode === "webhook") {
          if (!session.webhook) throw new Error("تنظیمات دامنه برای Webhook ناقص است");
          const wh = new WebhookManager(ssh, this.telegram);
          const url = await wh.apply(session.webhook, token, facts!.publicIp, (pkgs) => pm.install(facts!.packageManager, pkgs));
          return url;
        }
        await new PollingManager(this.telegram).apply(token);
        return "polling";
      });

      await job.run("start", async () => {
        await svc.ctl(svcName, "restart");
        const ok = await svc.isActive(svcName);
        if (!ok) throw new Error("ربات اجرا نشد. احتمالاً توکن یا وابستگی‌ها مشکل دارد.");
        return "running";
      });

      await job.run("health", async () => {
        const h = await new HealthChecker(ssh, this.telegram).run({
          token,
          service: svcName,
          mode,
          domain: session.webhook?.domain,
          publicIp: facts?.publicIp,
        });
        if (!h.healthy) throw new Error(h.items.find((i) => i.status === "fail")?.simple || "بررسی سلامت ناموفق بود");
        return "سالم";
      });

      job.succeed();
      session.version = new Date().toISOString();
      this.store.save(session);
    } catch (e) {
      mkdirSync(join(DATA_DIR, "logs"), { recursive: true });
      writeFileSync(join(DATA_DIR, "logs", `${jobId}.log`), redact(e instanceof Error ? e.stack || e.message : String(e)));
    }
    return job;
  }

  private async resolveExec(ssh: SshClient, dir: string, hint: string): Promise<string> {
    const q = shellQuote(dir);
    if (hint.endsWith("/bot") || hint.includes(".venv")) {
      if (hint.includes(".venv")) {
        const r = await ssh.execute(`cd ${q} && if test -f main.py; then echo ${dir}/.venv/bin/python main.py; elif test -f bot.py; then echo ${dir}/.venv/bin/python bot.py; else echo ${dir}/.venv/bin/python -m bot; fi`);
        return r.stdout.trim();
      }
      return hint;
    }
    if (hint === "node") {
      const r = await ssh.execute(`cd ${q} && node -p "require('./package.json').scripts?.start ? 'npm start' : (require('fs').existsSync('index.js') ? 'node index.js' : 'node .')"`);
      const cmd = r.stdout.trim();
      return cmd.startsWith("npm") ? `/bin/bash -lc 'cd ${dir} && npm start'` : `/bin/bash -lc 'cd ${dir} && ${cmd}'`;
    }
    if (hint === "php") return `/bin/bash -lc 'cd ${dir} && php artisan serve --host=127.0.0.1 --port=8080'`;
    if (hint === "docker") return `/bin/bash -lc 'cd ${dir} && docker compose up'`;
    return hint;
  }
}
