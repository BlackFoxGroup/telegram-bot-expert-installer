import type { SshClient } from "../ssh/types.js";
import { shellQuote } from "../ssh/SshManager.js";

export type DistroFamily = "debian" | "rhel" | "unknown";

export function familyFromId(id: string): DistroFamily {
  const s = id.toLowerCase();
  if (s.includes("ubuntu") || s.includes("debian")) return "debian";
  if (s.includes("almalinux") || s.includes("rocky") || s.includes("rhel") || s.includes("centos")) return "rhel";
  return "unknown";
}

export class PackageManager {
  constructor(private ssh: SshClient) {}

  async detectPm(): Promise<"apt" | "dnf" | "yum" | "unknown"> {
    const r = await this.ssh.execute(
      "command -v apt-get >/dev/null && echo apt || (command -v dnf >/dev/null && echo dnf || (command -v yum >/dev/null && echo yum || echo unknown))"
    );
    const v = r.stdout.trim();
    if (v === "apt" || v === "dnf" || v === "yum") return v;
    return "unknown";
  }

  installCmd(pm: string, packages: string[]): string {
    const list = packages.map(shellQuote).join(" ");
    if (pm === "apt") return `DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y ${list}`;
    if (pm === "dnf") return `dnf install -y ${list}`;
    if (pm === "yum") return `yum install -y ${list}`;
    throw new Error("مدیر بسته این سیستم پشتیبانی نمی‌شود");
  }

  async install(pm: string, packages: string[]): Promise<void> {
    const r = await this.ssh.execute(this.installCmd(pm, packages));
    if (r.code !== 0) throw new Error(r.stderr || r.stdout || "نصب بسته شکست خورد");
  }
}
