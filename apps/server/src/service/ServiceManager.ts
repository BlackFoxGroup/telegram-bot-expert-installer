import type { SshClient } from "../ssh/types.js";
import { shellQuote } from "../ssh/SshManager.js";

export class ServiceManager {
  constructor(private ssh: SshClient) {}

  unit(name: string, workdir: string, exec: string, envFile: string): string {
    return `[Unit]
Description=Telegram Bot ${name}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${workdir}
EnvironmentFile=${envFile}
ExecStart=${exec}
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
`;
  }

  async writeAndEnable(name: string, workdir: string, exec: string, envFile: string): Promise<void> {
    const unitPath = `/etc/systemd/system/${name}.service`;
    const body = this.unit(name, workdir, exec, envFile);
    await this.ssh.execute(`cat > ${shellQuote(unitPath)} <<'EOF'\n${body}\nEOF`);
    const r = await this.ssh.execute(`systemctl daemon-reload && systemctl enable ${shellQuote(name)} && systemctl restart ${shellQuote(name)}`);
    if (r.code !== 0) throw new Error(r.stderr || "راه‌اندازی سرویس شکست خورد");
  }

  async ctl(name: string, action: "start" | "stop" | "restart" | "enable" | "disable" | "status"): Promise<string> {
    const r = await this.ssh.execute(`systemctl ${action} ${shellQuote(name)} --no-pager`);
    return (r.stdout + r.stderr).trim();
  }

  async isActive(name: string): Promise<boolean> {
    const r = await this.ssh.execute(`systemctl is-active ${shellQuote(name)} || true`);
    return r.stdout.trim() === "active";
  }

  async isEnabled(name: string): Promise<boolean> {
    const r = await this.ssh.execute(`systemctl is-enabled ${shellQuote(name)} || true`);
    return r.stdout.trim() === "enabled";
  }

  async logs(name: string, lines = 200): Promise<string> {
    const r = await this.ssh.execute(`journalctl -u ${shellQuote(name)} -n ${lines} --no-pager`);
    return r.stdout || r.stderr;
  }
}
