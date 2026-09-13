import { mkdirSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.js";
import type { SshClient } from "../ssh/types.js";
import { shellQuote } from "../ssh/SshManager.js";
import type { SessionRecord } from "../store/SessionStore.js";

export class BackupManager {
  list(): string[] {
    const dir = join(DATA_DIR, "backups");
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith(".tgz") || f.endsWith(".meta.json"));
  }

  async create(ssh: SshClient, session: SessionRecord): Promise<string> {
    const dir = session.bot?.installDir;
    if (!dir) throw new Error("مسیر نصب مشخص نیست");
    const name = `backup-${Date.now()}`;
    const remote = `/tmp/${name}.tgz`;
    const r = await ssh.execute(`tar -czf ${remote} --exclude='.venv' --exclude='node_modules' ${shellQuote(dir)} /etc/systemd/system/${session.serviceName || "telegram-bot"}.service 2>/dev/null || tar -czf ${remote} ${shellQuote(dir)}`);
    if (r.code !== 0) throw new Error(r.stderr || "پشتیبان ساخته نشد");
    mkdirSync(join(DATA_DIR, "backups"), { recursive: true });
    const local = join(DATA_DIR, "backups", `${name}.tgz`);
    await ssh.download(remote, local);
    writeFileSync(
      join(DATA_DIR, "backups", `${name}.meta.json`),
      JSON.stringify({ id: name, createdAt: new Date().toISOString(), dir, secrets: "stored-on-server-only" })
    );
    return name;
  }

  async restore(ssh: SshClient, session: SessionRecord, id: string): Promise<void> {
    const local = join(DATA_DIR, "backups", `${id}.tgz`);
    if (!existsSync(local)) throw new Error("این پشتیبان پیدا نشد");
    await ssh.upload(local, `/tmp/${id}.tgz`);
    const r = await ssh.execute(`tar -xzf /tmp/${id}.tgz -C /`);
    if (r.code !== 0) throw new Error(r.stderr || "بازگردانی شکست خورد");
    if (session.serviceName) await ssh.execute(`systemctl daemon-reload && systemctl restart ${session.serviceName}`);
  }

  remove(id: string): void {
    const a = join(DATA_DIR, "backups", `${id}.tgz`);
    const b = join(DATA_DIR, "backups", `${id}.meta.json`);
    if (existsSync(a)) unlinkSync(a);
    if (existsSync(b)) unlinkSync(b);
  }
}
