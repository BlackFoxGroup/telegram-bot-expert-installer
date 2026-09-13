import { BackupManager } from "../backup/BackupManager.js";
import { InstallerEngine } from "../installer/InstallerEngine.js";
import type { SessionRecord, SessionStore } from "../store/SessionStore.js";
import type { SshClient } from "../ssh/types.js";
import { JobEngine } from "../installer/JobEngine.js";
import { shellQuote } from "../ssh/SshManager.js";

export class UpdateManager {
  constructor(
    private store: SessionStore,
    private installer: InstallerEngine
  ) {}

  async check(ssh: SshClient, session: SessionRecord): Promise<{ current: string; latest: string }> {
    const current = session.version || "unknown";
    let latest = current;
    if (session.source?.kind === "git" && session.source.gitUrl) {
      const r = await ssh.execute(
        `git ls-remote ${shellQuote(session.source.gitUrl)} ${shellQuote(session.source.branch || "HEAD")} | awk '{print $1}'`
      );
      latest = r.stdout.trim().slice(0, 12) || current;
    }
    session.latestVersion = latest;
    this.store.save(session);
    return { current, latest };
  }

  async update(ssh: SshClient, session: SessionRecord): Promise<JobEngine> {
    const backups = new BackupManager();
    const snap = await backups.create(ssh, session);
    try {
      const job = await this.installer.install(session, ssh);
      if (job.status !== "success") {
        await backups.restore(ssh, session, snap);
        job.status = "rolled_back";
      }
      return job;
    } catch {
      await backups.restore(ssh, session, snap);
      const job = new JobEngine();
      job.status = "rolled_back";
      return job;
    }
  }
}
