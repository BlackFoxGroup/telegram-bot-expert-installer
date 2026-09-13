import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { BotConfigInput, CheckItem, InstallMode, SourceInput, VpsFacts, WebhookInput } from "@expert/shared";
import type { SshAuth } from "../ssh/types.js";
import type { Vault } from "../security/crypto.js";
import { DATA_DIR } from "../config.js";

export interface SessionRecord {
  id: string;
  mode: InstallMode | null;
  auth?: Omit<SshAuth, "password" | "privateKey"> & {
    passwordEnc?: string;
    keyEnc?: string;
    passphraseEnc?: string;
  };
  facts?: VpsFacts;
  checks: CheckItem[];
  bot?: Omit<BotConfigInput, "token"> & { tokenEnc: string };
  source?: Omit<SourceInput, "deployToken"> & { deployTokenEnc?: string };
  webhook?: WebhookInput;
  serviceName?: string;
  version?: string;
  latestVersion?: string;
}

export class SessionStore {
  constructor(public vault: Vault) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  create(): SessionRecord {
    const rec: SessionRecord = { id: randomUUID(), mode: null, checks: [] };
    this.save(rec);
    return rec;
  }

  get(id: string): SessionRecord | undefined {
    const p = this.path(id);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as SessionRecord;
  }

  save(rec: SessionRecord): void {
    writeFileSync(this.path(rec.id), JSON.stringify(rec, null, 2));
  }

  setAuth(rec: SessionRecord, auth: SshAuth): void {
    rec.auth = {
      host: auth.host,
      port: auth.port,
      username: auth.username,
      method: auth.method,
      passwordEnc: auth.password ? this.vault.encrypt(auth.password) : undefined,
      keyEnc: auth.privateKey ? this.vault.encrypt(auth.privateKey) : undefined,
      passphraseEnc: auth.passphrase ? this.vault.encrypt(auth.passphrase) : undefined,
    };
    this.save(rec);
  }

  readAuth(rec: SessionRecord): SshAuth {
    if (!rec.auth) throw new Error("اطلاعات اتصال ذخیره نشده");
    return {
      host: rec.auth.host,
      port: rec.auth.port,
      username: rec.auth.username,
      method: rec.auth.method,
      password: rec.auth.passwordEnc ? this.vault.decrypt(rec.auth.passwordEnc) : undefined,
      privateKey: rec.auth.keyEnc ? this.vault.decrypt(rec.auth.keyEnc) : undefined,
      passphrase: rec.auth.passphraseEnc ? this.vault.decrypt(rec.auth.passphraseEnc) : undefined,
    };
  }

  setBot(rec: SessionRecord, bot: BotConfigInput): void {
    rec.bot = {
      name: bot.name,
      username: bot.username,
      adminId: bot.adminId,
      supportId: bot.supportId,
      language: bot.language,
      timezone: bot.timezone,
      environment: bot.environment,
      installDir: bot.installDir,
      tokenEnc: this.vault.encrypt(bot.token),
    };
    this.save(rec);
  }

  readToken(rec: SessionRecord): string {
    if (!rec.bot) throw new Error("تنظیمات ربات ذخیره نشده");
    return this.vault.decrypt(rec.bot.tokenEnc);
  }

  private path(id: string): string {
    return join(DATA_DIR, `session-${id}.json`);
  }
}
