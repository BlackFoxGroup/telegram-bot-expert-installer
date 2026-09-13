import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ExecResult, SshAuth, SshClient } from "./types.js";

export class FakeSsh implements SshClient {
  connected = false;
  files = new Map<string, string>();
  commands: string[] = [];
  responses = new Map<string, ExecResult>();
  defaultOk = true;
  serviceActive = true;

  async connect(_auth: SshAuth): Promise<void> {
    this.connected = true;
  }
  isConnected(): boolean {
    return this.connected;
  }
  close(): void {
    this.connected = false;
  }

  on(match: string, result: ExecResult): void {
    this.responses.set(match, result);
  }

  async execute(command: string): Promise<ExecResult> {
    this.commands.push(command);
    for (const [k, v] of this.responses) {
      if (command.includes(k)) return v;
    }
    if (command.includes("cat /etc/os-release")) {
      return { code: 0, stdout: 'ID=ubuntu\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04"', stderr: "" };
    }
    if (command.includes("uname -m")) return { code: 0, stdout: "x86_64", stderr: "" };
    if (command.includes("uname -r")) return { code: 0, stdout: "6.8.0", stderr: "" };
    if (command.includes("nproc")) return { code: 0, stdout: "2", stderr: "" };
    if (command.includes("MemTotal")) return { code: 0, stdout: "2048000", stderr: "" };
    if (command.includes("MemAvailable")) return { code: 0, stdout: "1024000", stderr: "" };
    if (command.includes("df -P")) return { code: 0, stdout: "20971520", stderr: "" };
    if (command.includes("ifconfig.me") || command.includes("icanhazip")) return { code: 0, stdout: "1.2.3.4", stderr: "" };
    if (command.includes("command -v apt-get")) return { code: 0, stdout: "apt", stderr: "" };
    if (command.includes("ps -p 1")) return { code: 0, stdout: "systemd", stderr: "" };
    if (command.includes("command -v docker")) return { code: 0, stdout: "no", stderr: "" };
    if (command.includes("python3 --version")) return { code: 0, stdout: "Python 3.12.0", stderr: "" };
    if (command.includes("node --version")) return { code: 0, stdout: "", stderr: "" };
    if (command.includes("go version") || command.includes("php -v")) return { code: 0, stdout: "", stderr: "" };
    if (command.includes("ufw") || command.includes("firewall")) return { code: 0, stdout: "ufw", stderr: "" };
    if (command.includes("ss -lnt")) return { code: 0, stdout: "22,80", stderr: "" };
    if (command.includes("systemctl list-units")) return { code: 0, stdout: "no", stderr: "" };
    if (command.includes("command -v nginx") || command.includes("letsencrypt")) return { code: 0, stdout: "no", stderr: "" };
    if (command.includes("api.telegram.org")) return { code: 0, stdout: "ok", stderr: "" };
    if (command.includes("systemctl is-active")) return { code: 0, stdout: this.serviceActive ? "active" : "inactive", stderr: "" };
    if (command.includes("systemctl is-enabled")) return { code: 0, stdout: "enabled", stderr: "" };
    if (command.includes("journalctl")) return { code: 0, stdout: "bot started", stderr: "" };
    if (command.includes("requirements.txt") && command.includes("echo python")) return { code: 0, stdout: "python", stderr: "" };
    if (command.includes("package.json") && command.includes("echo node")) return { code: 0, stdout: "node", stderr: "" };
    if (command.includes("echo yes || echo no")) return { code: 0, stdout: this.files.has(command) ? "yes" : "no", stderr: "" };
    if (command.startsWith("test -e")) return { code: 0, stdout: "yes", stderr: "" };
    if (command.includes("getent hosts")) return { code: 0, stdout: "1.2.3.4", stderr: "" };
    if (command.includes("nginx -t") || command.includes("systemctl") || command.includes("apt-get") || command.includes("mkdir") || command.includes("git clone") || command.includes("unzip") || command.includes("venv") || command.includes("npm") || command.includes("pip") || command.includes("cat >")) {
      return { code: 0, stdout: "ok", stderr: "" };
    }
    return { code: this.defaultOk ? 0 : 1, stdout: "ok", stderr: "" };
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    this.files.set(remotePath, readFileSync(localPath, "utf8"));
  }
  async uploadBuffer(data: Buffer, remotePath: string): Promise<void> {
    this.files.set(remotePath, data.toString("utf8"));
  }
  async download(remotePath: string, localPath: string): Promise<void> {
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, this.files.get(remotePath) || "backup");
  }
  async exists(remotePath: string): Promise<boolean> {
    return this.files.has(remotePath);
  }
  async mkdir(remotePath: string): Promise<void> {
    this.files.set(remotePath, "");
  }
}
