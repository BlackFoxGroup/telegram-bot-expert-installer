import { Client } from "ssh2";
import { createWriteStream, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ExecResult, SshAuth, SshClient } from "./types.js";

export class RealSshClient implements SshClient {
  private client: Client | null = null;
  private connected = false;

  isConnected(): boolean {
    return this.connected;
  }

  connect(auth: SshAuth): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const client = new Client();
      const cfg: Record<string, unknown> = {
        host: auth.host,
        port: auth.port,
        username: auth.username,
        readyTimeout: 20000,
      };
      if (auth.method === "password") cfg.password = auth.password;
      else {
        cfg.privateKey = auth.privateKey;
        if (auth.passphrase) cfg.passphrase = auth.passphrase;
      }
      client
        .on("ready", () => {
          this.client = client;
          this.connected = true;
          resolve();
        })
        .on("error", (err) => {
          this.connected = false;
          reject(err);
        })
        .connect(cfg as never);
    });
  }

  execute(command: string): Promise<ExecResult> {
    const client = this.require();
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let stdout = "";
        let stderr = "";
        stream
          .on("close", (code: number) => resolve({ code: code ?? 1, stdout, stderr }))
          .on("data", (d: Buffer) => {
            stdout += d.toString();
          });
        stream.stderr.on("data", (d: Buffer) => {
          stderr += d.toString();
        });
      });
    });
  }

  upload(localPath: string, remotePath: string): Promise<void> {
    return this.uploadBuffer(readFileSync(localPath), remotePath);
  }

  uploadBuffer(data: Buffer, remotePath: string): Promise<void> {
    const client = this.require();
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        const dir = dirname(remotePath).replace(/\\/g, "/");
        sftp.mkdir(dir, { mode: 0o755 }, () => {
          const ws = sftp.createWriteStream(remotePath);
          ws.on("close", () => resolve());
          ws.on("error", reject);
          ws.end(data);
        });
      });
    });
  }

  download(remotePath: string, localPath: string): Promise<void> {
    const client = this.require();
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        const ws = createWriteStream(localPath);
        sftp.createReadStream(remotePath).pipe(ws).on("close", resolve).on("error", reject);
      });
    });
  }

  async exists(remotePath: string): Promise<boolean> {
    const r = await this.execute(`test -e ${shellQuote(remotePath)} && echo yes || echo no`);
    return r.stdout.trim() === "yes";
  }

  async mkdir(remotePath: string): Promise<void> {
    const r = await this.execute(`mkdir -p ${shellQuote(remotePath)}`);
    if (r.code !== 0) throw new Error(r.stderr || "mkdir failed");
  }

  close(): void {
    this.client?.end();
    this.client = null;
    this.connected = false;
  }

  private require(): Client {
    if (!this.client || !this.connected) throw new Error("SSH متصل نیست");
    return this.client;
  }
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export class SshPool {
  private map = new Map<string, SshClient>();
  get(id: string): SshClient | undefined {
    return this.map.get(id);
  }
  set(id: string, client: SshClient): void {
    this.map.get(id)?.close();
    this.map.set(id, client);
  }
  drop(id: string): void {
    this.map.get(id)?.close();
    this.map.delete(id);
  }
}
