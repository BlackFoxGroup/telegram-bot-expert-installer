import type { SshClient } from "../ssh/types.js";
import { shellQuote } from "../ssh/SshManager.js";
import { PackageManager } from "../vps/PackageManager.js";

export type RuntimeKind = "python" | "node" | "go" | "php" | "docker" | "unknown";

export class DependencyManager {
  constructor(private ssh: SshClient) {}

  async detectRuntime(dir: string): Promise<RuntimeKind> {
    const q = shellQuote(dir);
    const r = await this.ssh.execute(
      `if test -f ${q}/docker-compose.yml -o -f ${q}/Dockerfile; then echo docker;
       elif test -f ${q}/requirements.txt -o -f ${q}/pyproject.toml; then echo python;
       elif test -f ${q}/package.json; then echo node;
       elif test -f ${q}/go.mod; then echo go;
       elif test -f ${q}/composer.json; then echo php;
       else echo unknown; fi`
    );
    const k = r.stdout.trim();
    if (k === "python" || k === "node" || k === "go" || k === "php" || k === "docker") return k;
    return "unknown";
  }

  async install(dir: string, pm: string): Promise<{ runtime: RuntimeKind; startHint: string }> {
    const runtime = await this.detectRuntime(dir);
    const pkgs = new PackageManager(this.ssh);
    if (runtime === "python") {
      await pkgs.install(pm, ["python3", "python3-venv", "python3-pip"]);
      const r = await this.ssh.execute(
        `cd ${shellQuote(dir)} && python3 -m venv .venv && . .venv/bin/activate && (test -f requirements.txt && pip install -r requirements.txt || true) && (test -f pyproject.toml && pip install . || true)`
      );
      if (r.code !== 0) throw new Error(r.stderr || "نصب پایتون شکست خورد");
      return { runtime, startHint: `${dir}/.venv/bin/python` };
    }
    if (runtime === "node") {
      await pkgs.install(pm, ["curl", "ca-certificates"]);
      await this.ssh.execute(
        "command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs) || true"
      );
      const lock = await this.ssh.execute(
        `cd ${shellQuote(dir)} && if test -f pnpm-lock.yaml; then corepack enable && pnpm i --frozen-lockfile;
         elif test -f yarn.lock; then corepack enable && yarn install --frozen-lockfile;
         else npm install; fi`
      );
      if (lock.code !== 0) throw new Error(lock.stderr || "نصب Node شکست خورد");
      return { runtime, startHint: "node" };
    }
    if (runtime === "go") {
      await pkgs.install(pm, ["golang"]);
      const r = await this.ssh.execute(`cd ${shellQuote(dir)} && go build -o bot .`);
      if (r.code !== 0) throw new Error(r.stderr || "ساخت Go شکست خورد");
      return { runtime, startHint: `${dir}/bot` };
    }
    if (runtime === "php") {
      await pkgs.install(pm, ["php", "php-cli", "composer"]);
      const r = await this.ssh.execute(`cd ${shellQuote(dir)} && composer install --no-dev --optimize-autoloader`);
      if (r.code !== 0) throw new Error(r.stderr || "نصب PHP شکست خورد");
      return { runtime, startHint: "php" };
    }
    if (runtime === "docker") {
      return { runtime, startHint: "docker" };
    }
    throw new Error("نوع پروژه تشخیص داده نشد. فایل requirements.txt، package.json، go.mod یا Dockerfile لازم است.");
  }
}
