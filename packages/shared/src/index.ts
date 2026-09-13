export type InstallMode = "webhook" | "polling";
export type AuthMethod = "password" | "key";
export type CheckStatus = "ok" | "warn" | "fail" | "pending";
export type BotRunStatus = "running" | "stopped" | "starting" | "error" | "unknown";
export type JobStatus = "idle" | "running" | "success" | "failed" | "rolled_back";

export interface VpsFacts {
  os: string;
  osVersion: string;
  distroFamily: "debian" | "rhel" | "unknown";
  arch: string;
  kernel: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  publicIp: string;
  packageManager: "apt" | "dnf" | "yum" | "unknown";
  hasSystemd: boolean;
  hasDocker: boolean;
  python?: string;
  node?: string;
  go?: string;
  php?: string;
  firewall: string;
  openPorts: number[];
  existingBot: boolean;
  existingProxy: boolean;
  existingSsl: boolean;
}

export interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  simple: string;
  fixable: boolean;
}

export interface WizardSession {
  id: string;
  mode: InstallMode | null;
  connected: boolean;
  facts?: VpsFacts;
  checks: CheckItem[];
}

export interface BotConfigInput {
  token: string;
  name: string;
  username: string;
  adminId: string;
  supportId?: string;
  language: string;
  timezone: string;
  environment: "production" | "staging";
  installDir: string;
}

export interface SourceInput {
  kind: "zip" | "git" | "existing";
  gitUrl?: string;
  branch?: string;
  deployToken?: string;
  existingPath?: string;
}

export interface WebhookInput {
  domain: string;
  publicUrl?: string;
  listenPort: number;
  useNginx: boolean;
  email?: string;
}

export interface JobStep {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  detail?: string;
}

export interface JobEvent {
  jobId: string;
  status: JobStatus;
  steps: JobStep[];
  message: string;
  failedStep?: string;
}

export interface HealthReport {
  items: CheckItem[];
  healthy: boolean;
}

export interface DashboardSnapshot {
  botStatus: BotRunStatus;
  mode: InstallMode;
  vps: Pick<VpsFacts, "os" | "osVersion" | "cpuCores" | "ramMb" | "diskGb"> & {
    host: string;
  };
  bot: { name: string; username: string; telegramOk: boolean; modeStatus: string };
  service: { running: boolean; enabled: boolean };
}

export const INSTALL_STEPS = [
  { id: "connect", title: "اتصال به VPS" },
  { id: "detect", title: "بررسی سیستم" },
  { id: "prepare", title: "آماده‌سازی VPS" },
  { id: "deps", title: "نصب Dependency" },
  { id: "transfer", title: "انتقال Bot" },
  { id: "config", title: "تنظیم Configuration" },
  { id: "service", title: "تنظیم Service" },
  { id: "mode", title: "تنظیم Webhook / Polling" },
  { id: "start", title: "اجرای Bot" },
  { id: "health", title: "Health Check" },
] as const;

export function maskToken(token: string): string {
  const t = token.trim();
  const i = t.indexOf(":");
  if (i === -1) {
    if (t.length < 8) return "********";
    return `${t.slice(0, 4)}**************${t.slice(-4)}`;
  }
  return `${t.slice(0, i)}:**************${t.slice(-4)}`;
}
