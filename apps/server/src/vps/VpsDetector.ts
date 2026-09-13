import type { CheckItem, VpsFacts } from "@expert/shared";
import type { SshClient } from "../ssh/types.js";
import { familyFromId, PackageManager } from "./PackageManager.js";

export class VpsDetector {
  constructor(private ssh: SshClient) {}

  async detect(): Promise<VpsFacts> {
    const sh = async (c: string) => (await this.ssh.execute(c)).stdout.trim();
    const osRelease = await sh("cat /etc/os-release 2>/dev/null || true");
    const id = pick(osRelease, "ID") || "unknown";
    const pretty = pick(osRelease, "PRETTY_NAME") || id;
    const version = pick(osRelease, "VERSION_ID") || "";
    const family = familyFromId(id);
    const pm = new PackageManager(this.ssh);
    const portsRaw = await sh("ss -lnt 2>/dev/null | awk 'NR>1 {print $4}' | sed 's/.*://' | sort -n | uniq | tr '\\n' ','");
    const openPorts = portsRaw
      .split(",")
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);

    return {
      os: pretty,
      osVersion: version,
      distroFamily: family,
      arch: await sh("uname -m"),
      kernel: await sh("uname -r"),
      cpuCores: Number(await sh("nproc")) || 1,
      ramMb: Math.round(Number(await sh("awk '/MemTotal/ {print $2}' /proc/meminfo")) / 1024) || 0,
      diskGb: Math.round(Number(await sh("df -P / | awk 'NR==2 {print $2}'")) / 1024 / 1024) || 0,
      publicIp: await sh("curl -4 -s --max-time 8 ifconfig.me || curl -4 -s --max-time 8 icanhazip.com || echo unknown"),
      packageManager: await pm.detectPm(),
      hasSystemd: (await sh("ps -p 1 -o comm= 2>/dev/null || true")) === "systemd",
      hasDocker: (await sh("command -v docker >/dev/null && echo yes || echo no")) === "yes",
      python: await sh("python3 --version 2>/dev/null || true"),
      node: await sh("node --version 2>/dev/null || true"),
      go: await sh("go version 2>/dev/null || true"),
      php: await sh("php -v 2>/dev/null | head -1 || true"),
      firewall: await sh("command -v ufw >/dev/null && echo ufw || (command -v firewall-cmd >/dev/null && echo firewalld || echo none)"),
      openPorts,
      existingBot: (await sh("systemctl list-units --type=service --all 2>/dev/null | grep -i telegram-bot && echo yes || echo no")).includes("yes"),
      existingProxy: (await sh("command -v nginx >/dev/null && echo yes || echo no")) === "yes",
      existingSsl: (await sh("test -d /etc/letsencrypt/live && echo yes || echo no")) === "yes",
    };
  }

  async inspect(facts: VpsFacts, needWebhook: boolean): Promise<CheckItem[]> {
    const items: CheckItem[] = [];
    const add = (id: string, label: string, ok: boolean, simple: string, detail: string, fixable = false, warn = false) => {
      items.push({
        id,
        label,
        status: ok ? "ok" : warn ? "warn" : "fail",
        simple,
        detail,
        fixable,
      });
    };
    add("os", "سیستم‌عامل", facts.distroFamily !== "unknown", facts.distroFamily !== "unknown" ? "سیستم پشتیبانی می‌شود" : "این توزیع شناخته نشد", facts.os);
    add("pm", "مدیر بسته", facts.packageManager !== "unknown", "نصب بسته ممکن است", facts.packageManager);
    add("systemd", "systemd", facts.hasSystemd, facts.hasSystemd ? "سرویس پس‌زمینه قابل ساخت است" : "بدون systemd ربات بعد از خاموش شدن سرور خودکار بالا نمی‌آید", "pid 1", true);
    add("ram", "حافظه", facts.ramMb >= 256, facts.ramMb >= 512 ? "حافظه کافی است" : "حافظه کم است", `${facts.ramMb} MB`, false, facts.ramMb >= 256 && facts.ramMb < 512);
    add("disk", "دیسک", facts.diskGb >= 2, "فضای دیسک کافی است", `${facts.diskGb} GB`);
    const net = await this.ssh.execute("curl -s --max-time 8 https://api.telegram.org >/dev/null && echo ok || echo fail");
    add("net", "اینترنت و تلگرام", net.stdout.trim() === "ok", net.stdout.trim() === "ok" ? "دسترسی به تلگرام برقرار است" : "سرور به API تلگرام دسترسی ندارد", net.stderr || net.stdout, true);
    if (needWebhook) {
      add("pubip", "آی‌پی عمومی", Boolean(facts.publicIp && facts.publicIp !== "unknown"), "آی‌پی عمومی مشخص شد", facts.publicIp);
    }
    return items;
  }
}

function pick(text: string, key: string): string {
  const m = text.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^"|"$/g, "");
}
