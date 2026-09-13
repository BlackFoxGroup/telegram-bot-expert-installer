import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { existsSync, readFileSync, statSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { HOST, PORT, WEB_DIST } from "./config.js";
import { Vault } from "./security/crypto.js";
import { maskToken, redact } from "./security/redactor.js";
import { SessionStore } from "./store/SessionStore.js";
import { RealSshClient, SshPool } from "./ssh/SshManager.js";
import { VpsDetector } from "./vps/VpsDetector.js";
import { TelegramApi } from "./telegram/TelegramApi.js";
import { ServiceManager } from "./service/ServiceManager.js";
import { HealthChecker } from "./health/HealthChecker.js";
import { InstallerEngine } from "./installer/InstallerEngine.js";
import { BackupManager } from "./backup/BackupManager.js";
import { UpdateManager } from "./update/UpdateManager.js";
import { AutoRepair } from "./repair/AutoRepair.js";
import { WebhookManager } from "./webhook/WebhookManager.js";
import type { BotConfigInput, InstallMode, SourceInput, WebhookInput } from "@expert/shared";
import type { SshAuth } from "./ssh/types.js";

export async function buildApp(masterKey: string) {
  const app = Fastify({ logger: false });
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (!body || (typeof body === "string" && body.trim() === "")) return done(null, {});
    try {
      done(null, JSON.parse(String(body)));
    } catch (e) {
      done(e as Error, undefined);
    }
  });
  const vault = new Vault(masterKey);
  const store = new SessionStore(vault);
  const pool = new SshPool();
  const telegram = new TelegramApi();
  const installer = new InstallerEngine(store, telegram);
  const updater = new UpdateManager(store, installer);
  const repair = new AutoRepair(store);
  const backups = new BackupManager();
  const jobs = new Map<string, ReturnType<InstallerEngine["install"]> extends Promise<infer J> ? J : never>();

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });

  const requireSession = (id: string) => {
    const s = store.get(id);
    if (!s) throw new Error("نشست پیدا نشد");
    return s;
  };
  const requireSsh = (id: string) => {
    const c = pool.get(id);
    if (!c?.isConnected()) throw new Error("ابتدا اتصال VPS را تست کنید");
    return c;
  };

  app.post("/api/sessions", async () => store.create());

  app.get("/api/sessions/:id", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    return {
      id: s.id,
      mode: s.mode,
      connected: Boolean(pool.get(id)?.isConnected()),
      facts: s.facts,
      checks: s.checks,
      bot: s.bot
        ? { ...s.bot, tokenEnc: undefined, tokenMasked: maskToken(store.readToken(s)) }
        : undefined,
      source: s.source ? { ...s.source, deployTokenEnc: undefined } : undefined,
      webhook: s.webhook,
      serviceName: s.serviceName,
      version: s.version,
      latestVersion: s.latestVersion,
      host: s.auth?.host,
    };
  });

  app.post("/api/sessions/:id/mode", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { mode: InstallMode };
    const s = requireSession(id);
    s.mode = body.mode;
    store.save(s);
    return { ok: true, mode: s.mode };
  });

  app.post("/api/sessions/:id/connect", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const auth = req.body as SshAuth;
    store.setAuth(s, auth);
    const client = new RealSshClient();
    try {
      await client.connect(auth);
      pool.set(id, client);
      const det = new VpsDetector(client);
      s.facts = await det.detect();
      s.checks = await det.inspect(s.facts, s.mode === "webhook");
      store.save(s);
      return { ok: true, facts: s.facts, checks: s.checks };
    } catch (e) {
      client.close();
      throw e;
    }
  });

  app.post("/api/sessions/:id/bot", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const bot = req.body as BotConfigInput;
    await telegram.getMe(bot.token);
    store.setBot(s, bot);
    return { ok: true, tokenMasked: maskToken(bot.token) };
  });

  app.post("/api/sessions/:id/source", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const src = req.body as SourceInput;
    s.source = {
      kind: src.kind,
      gitUrl: src.gitUrl,
      branch: src.branch,
      existingPath: src.existingPath,
      deployTokenEnc: src.deployToken ? vault.encrypt(src.deployToken) : undefined,
    };
    store.save(s);
    return { ok: true };
  });

  app.post("/api/sessions/:id/webhook", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    s.webhook = req.body as WebhookInput;
    store.save(s);
    const ssh = requireSsh(id);
    const pre = await new WebhookManager(ssh, telegram).preflight(s.webhook.domain, s.facts?.publicIp || "");
    return { ok: pre.ok, reason: pre.reason, preview: ["Nginx نصب/به‌روز می‌شود", "فایل سایت ساخته می‌شود", "در صورت ایمیل، گواهی SSL صادر می‌شود", "Webhook تلگرام ثبت می‌شود"] };
  });

  app.post("/api/sessions/:id/install", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const ssh = requireSsh(id);
    const job = await installer.install(s, ssh);
    jobs.set(id, job);
    return job.snapshot(job.status === "success" ? "تمام" : "ناموفق");
  });

  app.post("/api/sessions/:id/install-zip", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const ssh = requireSsh(id);
    const file = await req.file();
    if (!file) throw new Error("فایل ZIP لازم است");
    const buf = await file.toBuffer();
    const tmp = join(tmpdir(), `bot-${id}.zip`);
    writeFileSync(tmp, buf);
    s.source = { kind: "zip" };
    store.save(s);
    const job = await installer.install(s, ssh, tmp);
    jobs.set(id, job);
    return job.snapshot(job.status === "success" ? "تمام" : "ناموفق");
  });

  app.get("/api/sessions/:id/job", async (req) => {
    const { id } = req.params as { id: string };
    const job = jobs.get(id);
    if (!job) return { status: "idle", steps: [], message: "" };
    return job.snapshot(job.status);
  });

  app.post("/api/sessions/:id/service/:action", async (req) => {
    const { id, action } = req.params as { id: string; action: "start" | "stop" | "restart" | "enable" | "disable" | "status" };
    const s = requireSession(id);
    const out = await new ServiceManager(requireSsh(id)).ctl(s.serviceName || "telegram-bot", action);
    return { ok: true, out: redact(out) };
  });

  app.get("/api/sessions/:id/logs", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const raw = await new ServiceManager(requireSsh(id)).logs(s.serviceName || "telegram-bot");
    return { text: redact(raw) };
  });

  app.get("/api/sessions/:id/dashboard", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    const ssh = requireSsh(id);
    const svc = new ServiceManager(ssh);
    const name = s.serviceName || "telegram-bot";
    const running = await svc.isActive(name);
    const enabled = await svc.isEnabled(name);
    let telegramOk = false;
    try {
      if (s.bot) {
        await telegram.getMe(store.readToken(s));
        telegramOk = true;
      }
    } catch {
      telegramOk = false;
    }
    return {
      botStatus: running ? "running" : "stopped",
      mode: s.mode || "polling",
      vps: {
        host: s.auth?.host || "",
        os: s.facts?.os || "",
        osVersion: s.facts?.osVersion || "",
        cpuCores: s.facts?.cpuCores || 0,
        ramMb: s.facts?.ramMb || 0,
        diskGb: s.facts?.diskGb || 0,
      },
      bot: {
        name: s.bot?.name || "",
        username: s.bot?.username || "",
        telegramOk,
        modeStatus: s.mode || "",
      },
      service: { running, enabled },
    };
  });

  app.get("/api/sessions/:id/health", async (req) => {
    const { id } = req.params as { id: string };
    const s = requireSession(id);
    return new HealthChecker(requireSsh(id), telegram).run({
      token: store.readToken(s),
      service: s.serviceName || "telegram-bot",
      mode: (s.mode || "polling") as InstallMode,
      domain: s.webhook?.domain,
      publicIp: s.facts?.publicIp,
    });
  });

  app.post("/api/sessions/:id/repair", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { item: import("@expert/shared").CheckItem };
    const msg = await repair.fix(requireSsh(id), requireSession(id), body.item);
    return { ok: true, message: msg };
  });

  app.get("/api/sessions/:id/update", async (req) => {
    const { id } = req.params as { id: string };
    return updater.check(requireSsh(id), requireSession(id));
  });

  app.post("/api/sessions/:id/update", async (req) => {
    const { id } = req.params as { id: string };
    const job = await updater.update(requireSsh(id), requireSession(id));
    return job.snapshot(String(job.status));
  });

  app.get("/api/sessions/:id/backups", async () => ({ items: backups.list() }));

  app.post("/api/sessions/:id/backups", async (req) => {
    const { id } = req.params as { id: string };
    const name = await backups.create(requireSsh(id), requireSession(id));
    return { ok: true, name };
  });

  app.post("/api/sessions/:id/backups/:bid/restore", async (req) => {
    const { id, bid } = req.params as { id: string; bid: string };
    await backups.restore(requireSsh(id), requireSession(id), bid);
    return { ok: true };
  });

  app.delete("/api/sessions/:id/backups/:bid", async (req) => {
    const { bid } = req.params as { bid: string };
    backups.remove(bid);
    return { ok: true };
  });

  app.post("/api/sessions/:id/uninstall", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { level: "app" | "app-data" | "everything" };
    const s = requireSession(id);
    const ssh = requireSsh(id);
    const name = s.serviceName || "telegram-bot";
    await ssh.execute(`systemctl stop ${name} || true; systemctl disable ${name} || true; rm -f /etc/systemd/system/${name}.service; systemctl daemon-reload`);
    if (body.level !== "app" && s.bot) await ssh.execute(`rm -rf ${s.bot.installDir}`);
    if (body.level === "everything" && s.webhook) {
      await ssh.execute(`rm -f /etc/nginx/sites-enabled/${s.webhook.domain} /etc/nginx/sites-available/${s.webhook.domain} /etc/nginx/conf.d/${s.webhook.domain}.conf; nginx -t && systemctl reload nginx || true`);
    }
    return { ok: true };
  });

  app.setErrorHandler((err: Error, _req, reply) => {
    reply.status(400).send({ error: redact(err.message), simple: human(err.message) });
  });

  app.setNotFoundHandler((req, reply) => {
    const url = decodeURIComponent((req.raw.url || "/").split("?")[0]);
    if (url.startsWith("/api")) return reply.status(404).send({ error: "not found" });
    if (!existsSync(WEB_DIST)) return reply.status(404).send({ error: "UI ساخته نشده. npm run build را بزنید." });
    const rel = url === "/" ? "index.html" : url.replace(/^\/+/, "");
    const file = normalize(join(WEB_DIST, rel));
    const root = normalize(WEB_DIST);
    if (!file.startsWith(root)) return reply.status(403).send({ error: "forbidden" });
    if (existsSync(file) && statSync(file).isFile()) {
      const types: Record<string, string> = {
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff2": "font/woff2",
      };
      reply.type(types[extname(file)] || "application/octet-stream");
      return reply.send(readFileSync(file));
    }
    reply.type("text/html; charset=utf-8");
    return reply.send(readFileSync(join(WEB_DIST, "index.html")));
  });

  return { app, port: PORT, host: HOST };
}

function human(msg: string): string {
  if (/auth|password|permission|ECONNREFUSED|Timed out/i.test(msg)) {
    return "اتصال به سرور برقرار نشد. آی‌پی، پورت، نام کاربری یا روش ورود را دوباره بررسی کنید.";
  }
  if (/token|getMe/i.test(msg)) return "توکن ربات پذیرفته نشد. توکن را از BotFather دوباره کپی کنید.";
  if (/systemctl|service/i.test(msg)) return "ربات اجرا نشد. احتمالاً یکی از تنظیمات توکن یا وابستگی‌ها مشکل دارد.";
  return msg;
}
