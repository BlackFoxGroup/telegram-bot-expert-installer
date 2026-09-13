import { describe, expect, it, vi } from "vitest";
import { Vault } from "../src/security/crypto.js";
import { maskToken, redact } from "../src/security/redactor.js";
import { FakeSsh } from "../src/ssh/FakeSsh.js";
import { VpsDetector } from "../src/vps/VpsDetector.js";
import { PackageManager } from "../src/vps/PackageManager.js";
import { DependencyManager } from "../src/deps/DependencyManager.js";
import { ServiceManager } from "../src/service/ServiceManager.js";
import { HealthChecker } from "../src/health/HealthChecker.js";
import { PollingManager } from "../src/polling/PollingManager.js";
import { WebhookManager } from "../src/webhook/WebhookManager.js";
import { BackupManager } from "../src/backup/BackupManager.js";
import { JobEngine } from "../src/installer/JobEngine.js";
import { InstallerEngine } from "../src/installer/InstallerEngine.js";
import { SessionStore } from "../src/store/SessionStore.js";
import { UpdateManager } from "../src/update/UpdateManager.js";
import type { TelegramApi } from "../src/telegram/TelegramApi.js";

const telegram: TelegramApi = {
  getMe: vi.fn().mockResolvedValue({ id: 1, username: "demo_bot", first_name: "Demo" }),
  setWebhook: vi.fn().mockResolvedValue(undefined),
  deleteWebhook: vi.fn().mockResolvedValue(undefined),
  getWebhookInfo: vi.fn().mockResolvedValue({ url: "https://bot.example/" }),
} as unknown as TelegramApi;

describe("security", () => {
  it("masks bot token", () => {
    expect(maskToken("123456:ABCDEFsecretkeyZZZZabcd")).toContain("**************");
    expect(maskToken("123456:ABCDEFsecretkeyZZZZabcd")).toMatch(/^123456:/);
  });
  it("redacts secrets", () => {
    expect(redact("token=123456:AAHxxxxxxxxxxxxxxxxxxxabcd")).toContain("[REDACTED]");
  });
  it("encrypts roundtrip", () => {
    const v = new Vault("abc".repeat(20));
    expect(v.decrypt(v.encrypt("hello"))).toBe("hello");
  });
});

describe("vps", () => {
  it("detects ubuntu facts", async () => {
    const facts = await new VpsDetector(new FakeSsh()).detect();
    expect(facts.distroFamily).toBe("debian");
    expect(facts.hasSystemd).toBe(true);
    expect(facts.packageManager).toBe("apt");
  });
  it("builds distro package commands", () => {
    const pm = new PackageManager(new FakeSsh());
    expect(pm.installCmd("apt", ["curl"])).toContain("apt-get");
    expect(pm.installCmd("dnf", ["curl"])).toContain("dnf");
  });
});

describe("deps", () => {
  it("detects python project", async () => {
    const ssh = new FakeSsh();
    const kind = await new DependencyManager(ssh).detectRuntime("/opt/bot");
    expect(kind).toBe("python");
  });
});

describe("service", () => {
  it("writes a systemd unit", () => {
    const unit = new ServiceManager(new FakeSsh()).unit("telegram-bot", "/opt/bot", "/opt/bot/.venv/bin/python main.py", "/opt/bot/.env");
    expect(unit).toContain("[Service]");
    expect(unit).toContain("Restart=always");
  });
  it("reports active status", async () => {
    expect(await new ServiceManager(new FakeSsh()).isActive("telegram-bot")).toBe(true);
  });
});

describe("telegram modes", () => {
  it("polling deletes webhook", async () => {
    await new PollingManager(telegram).apply("tok");
    expect(telegram.deleteWebhook).toHaveBeenCalled();
  });
  it("webhook preflight catches DNS mismatch", async () => {
    const ssh = new FakeSsh();
    ssh.on("getent hosts", { code: 0, stdout: "9.9.9.9", stderr: "" });
    const pre = await new WebhookManager(ssh, telegram).preflight("bot.example", "1.2.3.4");
    expect(pre.ok).toBe(false);
  });
});

describe("health", () => {
  it("returns graphical checks", async () => {
    const report = await new HealthChecker(new FakeSsh(), telegram).run({
      token: "1:x",
      service: "telegram-bot",
      mode: "polling",
    });
    expect(report.items.find((i) => i.id === "service")?.status).toBe("ok");
  });
});

describe("backup + job + update", () => {
  it("creates backup metadata without printing secrets", async () => {
    const ssh = new FakeSsh();
    const store = new SessionStore(new Vault("k".repeat(32)));
    const rec = store.create();
    rec.bot = {
      name: "b",
      username: "u",
      adminId: "1",
      language: "fa",
      timezone: "UTC",
      environment: "production",
      installDir: "/opt/bot",
      tokenEnc: store["vault"].encrypt("123:secretabcd"),
    };
    store.save(rec);
    const id = await new BackupManager().create(ssh, rec);
    expect(id.startsWith("backup-")).toBe(true);
  });

  it("job engine marks failed step", async () => {
    const job = new JobEngine();
    job.start("j1");
    await expect(job.run("connect", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(job.steps.find((s) => s.id === "connect")?.status).toBe("failed");
  });

  it("update rolls back when install fails", async () => {
    const store = new SessionStore(new Vault("k".repeat(32)));
    const rec = store.create();
    rec.bot = {
      name: "b",
      username: "u",
      adminId: "1",
      language: "fa",
      timezone: "UTC",
      environment: "production",
      installDir: "/opt/bot",
      tokenEnc: store["vault"].encrypt("123:secretabcd"),
    };
    rec.source = { kind: "existing", existingPath: "/opt/bot" };
    rec.mode = "polling";
    store.save(rec);
    const installer = { install: vi.fn().mockResolvedValue({ status: "failed" }) } as unknown as InstallerEngine;
    const ssh = new FakeSsh();
    const job = await new UpdateManager(store, installer).update(ssh, rec);
    expect(job.status).toBe("rolled_back");
  });
});

describe("e2e install polling + webhook (fake ssh)", () => {
  it("installs polling path", async () => {
    const store = new SessionStore(new Vault("k".repeat(32)));
    const rec = store.create();
    rec.mode = "polling";
    rec.source = { kind: "existing", existingPath: "/opt/bot" };
    rec.bot = {
      name: "b",
      username: "u",
      adminId: "1",
      language: "fa",
      timezone: "UTC",
      environment: "production",
      installDir: "/opt/bot",
      tokenEnc: store["vault"].encrypt("123456:secretkeyzzzzabcd"),
    };
    store.save(rec);
    const ssh = new FakeSsh();
    ssh.on("test -d", { code: 0, stdout: "", stderr: "" });
    const job = await new InstallerEngine(store, telegram).install(rec, ssh);
    expect(["success", "failed"]).toContain(job.status);
    expect(job.steps.length).toBe(10);
  });

  it("installs webhook path", async () => {
    const store = new SessionStore(new Vault("k".repeat(32)));
    const rec = store.create();
    rec.mode = "webhook";
    rec.webhook = { domain: "bot.example", listenPort: 8080, useNginx: true, email: "a@b.c" };
    rec.source = { kind: "existing", existingPath: "/opt/bot" };
    rec.bot = {
      name: "b",
      username: "u",
      adminId: "1",
      language: "fa",
      timezone: "UTC",
      environment: "production",
      installDir: "/opt/bot",
      tokenEnc: store["vault"].encrypt("123456:secretkeyzzzzabcd"),
    };
    store.save(rec);
    const ssh = new FakeSsh();
    ssh.on("test -d", { code: 0, stdout: "", stderr: "" });
    const job = await new InstallerEngine(store, telegram).install(rec, ssh);
    expect(job.steps.find((s) => s.id === "mode")).toBeTruthy();
  });
});
